from datetime import date, timedelta
import re

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.core.cache import cache

from .blood_constants import (
    BLOOD_TYPES,
    DEFAULT_CRITICAL_LIMITS,
    PENDING_BLOOD_TYPE,
    UNKNOWN_DONOR_NAME,
    PRODUCT_TYPES,
    PRODUCT_TYPE_RBC,
    PRODUCT_TYPE_WHOLE,
    build_inventory_payload,
    compute_expiry_date,
    get_product_label,
    inventory_key,
    normalize_product_type,
    parse_inventory_key,
    validate_blood_type,
)
from .models import (
    AI_PENDING_REQUEST_STATUSES,
    Account,
    AuditLog,
    Beneficiary,
    BloodBag,
    BloodInventory,
    BloodRequest,
    DisposalLog,
    Donor,
    Hospital,
    HospitalDeliveryRecord,
    PendingDonor,
    REQUEST_STATUS_APPROVED,
    REQUEST_STATUS_DELIVERED,
    REQUEST_STATUS_REJECTED,
    REQUEST_STATUS_REVIEW,
    StorageConfig,
    StorageFridge,
    StorageRoom,
    SystemMetricsConfig,
    Notification,
)
from .role_utils import normalize_role_code


BLOOD_TYPES = BLOOD_TYPES  # re-export for callers
DEFAULT_CRITICAL_LIMITS = DEFAULT_CRITICAL_LIMITS

STORAGE_OCCUPYING_STATUSES = frozenset({'Pending', 'Approved', 'Rejected', 'Reserved'})
ACTIVE_BAG_STATUSES = frozenset({'Pending', 'Approved', 'Reserved'})
TERMINAL_BAG_STATUSES = frozenset({'Delivered', 'Expired', 'Rejected'})
WHOLE_BLOOD_STORAGE_UNITS = 3


def get_inventory_record(blood_type, product_type=None):
    ensure_blood_inventory()
    return BloodInventory.objects.filter(blood_type=inventory_key(blood_type, product_type)).first()


def get_or_create_inventory_record(blood_type, product_type=None):
    ensure_blood_inventory()
    return BloodInventory.objects.get_or_create(
        blood_type=inventory_key(blood_type, product_type),
        defaults={'critical_limit': DEFAULT_CRITICAL_LIMITS.get(blood_type, 20)},
    )


def sum_inventory_by_blood_type(blood_type):
    totals = {
        'available': 0,
        'reserved': 0,
        'issued': 0,
        'expired': 0,
        'critical_limit': DEFAULT_CRITICAL_LIMITS.get(blood_type, 20),
    }
    for product_type in PRODUCT_TYPES:
        inv = get_inventory_record(blood_type, product_type)
        if not inv:
            continue
        totals['available'] += inv.available
        totals['reserved'] += inv.reserved
        totals['issued'] += inv.issued
        totals['expired'] += inv.expired
    return totals


def invalidate_runtime_caches():
    cache.clear()


def _normalize_request_status(status):
    mapping = {
        'Pending Approval': REQUEST_STATUS_REVIEW,
        'Ready for Delivery': REQUEST_STATUS_APPROVED,
        'Rejected': REQUEST_STATUS_REJECTED,
        'Completed': REQUEST_STATUS_DELIVERED,
    }
    return mapping.get(status, status)


def push_audit(user, role, action, details):
    from .role_utils import get_role_label, normalize_role_code

    now = timezone.localtime()
    time_str = now.strftime('%Y-%m-%d %H:%M')
    display_role = get_role_label(normalize_role_code(role) or role)
    return AuditLog.objects.create(
        time=time_str,
        user=user or 'system',
        role=display_role or 'System',
        action=action,
        details=details,
    )


def ensure_blood_inventory():
    for blood_type in BLOOD_TYPES:
        for product_type in PRODUCT_TYPES:
            BloodInventory.objects.get_or_create(
                blood_type=inventory_key(blood_type, product_type),
                defaults={
                    'available': 0,
                    'reserved': 0,
                    'issued': 0,
                    'expired': 0,
                    'critical_limit': DEFAULT_CRITICAL_LIMITS[blood_type],
                },
            )


@transaction.atomic
def process_expired_bags():
    """معالجة الأكياس منتهية الصلاحية: تسجيل إتلاف ثم حذفها من النظام."""
    today = date.today()
    expired_bags = list(
        BloodBag.objects.filter(
            expiry__lt=today,
            status__in=['Approved', 'Available', 'Pending', 'Reserved'],
        )
    )

    expired_details = {}
    inventory_adjustments = {}
    processed = 0

    for bag in expired_bags:
        if bag.status in STORAGE_OCCUPYING_STATUSES:
            _release_bag_storage(bag)
        if bag.status == 'Reserved':
            for req in BloodRequest.objects.filter(status=REQUEST_STATUS_APPROVED):
                reserved_ids = list(req.reserved_bag_ids or [])
                if bag.bag_id in reserved_ids:
                    reserved_ids.remove(bag.bag_id)
                    req.reserved_bag_ids = reserved_ids
                    req.save(update_fields=['reserved_bag_ids'])

        DisposalLog.objects.create(
            bag_code=bag.bag_id,
            disposal_type=get_product_label(bag.product_type),
            blood=bag.blood_type,
            product_type=normalize_product_type(bag.product_type),
            date=today,
            reason='انتهاء الصلاحية — إتلاف تلقائي',
            worker='النظام',
            donor_name=(bag.donor or '').strip(),
            detected_diseases=[],
        )

        if bag.blood_type not in expired_details:
            expired_details[bag.blood_type] = 0
        expired_details[bag.blood_type] += bag.qty or 1

        if bag.blood_type in (PENDING_BLOOD_TYPE, 'Unknown', ''):
            bag._skip_inventory_signal = True
            bag.delete()
            processed += 1
            continue

        adjustment_key = inventory_key(bag.blood_type, bag.product_type)
        adjustment = inventory_adjustments.setdefault(
            adjustment_key,
            {'available': 0, 'reserved': 0, 'total': 0},
        )
        qty = bag.qty or 1
        adjustment['total'] += qty
        if bag.status == 'Approved':
            adjustment['available'] += qty
        elif bag.status == 'Reserved':
            adjustment['reserved'] += qty

        bag._skip_inventory_signal = True
        bag.delete()
        processed += 1

    for inv_key, adjustment in inventory_adjustments.items():
        if adjustment['total'] <= 0:
            continue
        try:
            inv = BloodInventory.objects.get(blood_type=inv_key)
            inv.available = max(0, inv.available - adjustment['available'])
            inv.reserved = max(0, inv.reserved - adjustment['reserved'])
            inv.expired += adjustment['total']
            inv.save()
        except BloodInventory.DoesNotExist:
            pass

    invalidate_runtime_caches()

    return {
        'processed': processed,
        'details': [(bt, qty) for bt, qty in expired_details.items()],
    }


@transaction.atomic
def sync_inventory_from_bags():
    """مزامنة شاملة للمخزون من واقع الأكياس:
    - حسب الأكياس المعتمدة (Approved) = available
    - حسب الأكياس المسلمة (Delivered) = issued
    - حسب الأكياس منتهية (Expired) = expired
    
    ملاحظة: هذا للإصلاح في حالة عدم تطابق البيانات
    
    Returns:
        dict: التغييرات التي تمت
    """
    ensure_blood_inventory()
    results = {}
    
    for bt in BLOOD_TYPES:
        for pt in PRODUCT_TYPES:
            key = inventory_key(bt, pt)
            available_count = BloodBag.objects.filter(
                blood_type=bt, product_type=pt, status='Approved'
            ).count()
            reserved_count = BloodBag.objects.filter(
                blood_type=bt, product_type=pt, status='Reserved'
            ).count()
            from django.db.models import Sum
            from .models import Beneficiary, HospitalDeliveryRecord

            hospital_issued = (
                HospitalDeliveryRecord.objects.filter(blood=bt, product_type=pt)
                .aggregate(total=Sum('qty'))['total'] or 0
            )
            beneficiary_issued = (
                Beneficiary.objects.filter(blood_type_received=bt, product_type_received=pt)
                .aggregate(total=Sum('bags_consumed'))['total'] or 0
            )
            issued_count = int(hospital_issued) + int(beneficiary_issued)
            expired_count = DisposalLog.objects.filter(blood=bt, product_type=pt).count()

            inv = BloodInventory.objects.get(blood_type=key)
            old_state = {
                'available': inv.available,
                'reserved': inv.reserved,
                'issued': inv.issued,
                'expired': inv.expired,
            }

            inv.available = available_count
            inv.reserved = reserved_count
            inv.issued = issued_count
            inv.expired = expired_count
            inv.save()

            results[key] = {
                'before': old_state,
                'after': {
                    'available': available_count,
                    'reserved': reserved_count,
                    'issued': issued_count,
                    'expired': expired_count,
                },
            }

    invalidate_runtime_caches()
    
    return results



def reset_operational_data():
    """Delete all user-added records; zero inventory and rebuild empty storage."""
    from django.contrib.sessions.models import Session

    from .models import Donor, Hospital, Message, Notification

    PendingDonor.objects.all().delete()
    BloodBag.objects.all().delete()
    Donor.objects.all().delete()
    BloodRequest.objects.all().delete()
    Hospital.objects.all().delete()
    HospitalDeliveryRecord.objects.all().delete()
    DisposalLog.objects.all().delete()
    AuditLog.objects.all().delete()
    Notification.objects.all().delete()
    Message.objects.all().delete()
    Account.objects.exclude(username__in=PROTECTED_USERNAMES).delete()

    ensure_blood_inventory()
    BloodInventory.objects.all().update(
        available=0,
        reserved=0,
        issued=0,
        expired=0,
    )

    config = get_storage_config()
    config.total_rooms = 0
    config.total_fridges_per_room = 0
    config.total_shelves_per_fridge = 0
    config.capacity_per_shelf = 100
    config.room_names = []
    config.details = []
    config.save()
    StorageFridge.objects.all().delete()
    StorageRoom.objects.all().delete()
    Session.objects.all().delete()
    invalidate_runtime_caches()


def get_storage_config():
    config, _ = StorageConfig.objects.get_or_create(pk='default')
    return config


def _storage_location_prefixes(room_name, fridge_name=None, shelf_name=None):
    room_name = str(room_name or '').strip()
    if not room_name:
        return []

    prefixes = [room_name, f'تخزين رئيسي: {room_name}']
    if fridge_name is not None:
        fridge_name = str(fridge_name).strip()
        base = f'{room_name} / {fridge_name}'
        prefixes.extend([base, f'تخزين رئيسي: {base}'])
    if shelf_name is not None and fridge_name is not None:
        shelf_name = str(shelf_name).strip()
        base = f'{room_name} / {fridge_name} / {shelf_name}'
        prefixes.extend([base, f'تخزين رئيسي: {base}'])
    return prefixes


def _storage_location_has_bags(room_name, fridge_name=None, shelf_name=None):
    prefixes = _storage_location_prefixes(room_name, fridge_name=fridge_name, shelf_name=shelf_name)
    if not prefixes:
        return False

    query = Q()
    for prefix in prefixes:
        query |= Q(location__startswith=prefix)
    return BloodBag.objects.filter(query).exists()


def _normalize_storage_details(details, fridges_per_room, shelves_per_fridge):
    if details is not None and len(details) == 0:
        return []
    if not details:
        return default_storage_details(3, fridges_per_room, shelves_per_fridge)

    normalized = []
    for index, detail in enumerate(details, start=1):
        room_name = str(detail.get('room') or f'Room {index}').strip() or f'Room {index}'
        room_key = str(detail.get('roomKey') or detail.get('room_key') or room_name).strip() or room_name
        fridge_names = [str(fridge).strip() for fridge in (detail.get('fridges') or []) if str(fridge).strip()]
        if not fridge_names:
            fridge_count = int(detail.get('fridgesCount') or fridges_per_room or 1)
            fridge_names = [f'Fridge {i}' for i in range(1, fridge_count + 1)]

        shelves_map = detail.get('shelves') if isinstance(detail.get('shelves'), dict) else {}
        fridge_settings = detail.get('fridgeSettings') if isinstance(detail.get('fridgeSettings'), dict) else {}
        default_cap = int(detail.get('capacityPerShelf') or 100)
        normalized_shelves = {}
        normalized_fridge_settings = {}
        for fridge_name in fridge_names:
            fs = fridge_settings.get(fridge_name) or {}
            shelves = shelves_map.get(fridge_name) or shelves_map.get(str(fridge_name)) or []
            shelves = [str(shelf).strip() for shelf in shelves if str(shelf).strip()]
            try:
                shelf_count = int(fs.get('shelves')) if fs.get('shelves') is not None else None
            except (TypeError, ValueError):
                shelf_count = None
            if shelf_count is None or shelf_count < 1:
                shelf_count = len(shelves) if shelves else int(detail.get('shelvesPerFridge') or shelves_per_fridge or 1)
            shelf_count = max(shelf_count, 1)
            try:
                cap_per_shelf = int(fs.get('capacityPerShelf')) if fs.get('capacityPerShelf') is not None else default_cap
            except (TypeError, ValueError):
                cap_per_shelf = default_cap
            cap_per_shelf = max(cap_per_shelf, 1)
            normalized_shelves[fridge_name] = [f'Shelf {i}' for i in range(1, shelf_count + 1)]
            normalized_fridge_settings[fridge_name] = {
                'shelves': shelf_count,
                'capacityPerShelf': cap_per_shelf,
            }

        room_detail = {
            'fridges': fridge_names,
            'shelves': normalized_shelves,
            'fridgeSettings': normalized_fridge_settings,
        }
        room_capacity = detail.get('roomCapacity', detail.get('capacity'))
        try:
            room_capacity = int(room_capacity) if room_capacity is not None else None
        except (TypeError, ValueError):
            room_capacity = None
        if room_capacity is None or room_capacity < 1:
            room_capacity = _room_capacity(room_detail, default_cap)

        normalized.append({
            'roomKey': room_key,
            'room': room_name,
            'roomCapacity': room_capacity,
            'fridges': fridge_names,
            'shelves': normalized_shelves,
            'fridgeSettings': normalized_fridge_settings,
        })

    return normalized


def _validate_storage_change(existing_details, new_details):
    existing_by_room = {detail.get('roomKey') or detail.get('room'): detail for detail in existing_details or [] if detail.get('room')}
    new_by_room = {detail.get('roomKey') or detail.get('room'): detail for detail in new_details or [] if detail.get('room')}

    for room_name in set(existing_by_room) - set(new_by_room):
        if _storage_location_has_bags(room_name):
            raise ValueError(f'لا يمكن حذف الغرفة {room_name} لأنها تحتوي على أكياس مخزنة.')

    for room_name in set(existing_by_room) & set(new_by_room):
        existing_room = existing_by_room[room_name]
        new_room = new_by_room[room_name]

        for fridge_name in set(existing_room.get('fridges', []) or []) - set(new_room.get('fridges', []) or []):
            if _storage_location_has_bags(room_name, fridge_name=fridge_name):
                raise ValueError(f'لا يمكن حذف الثلاجة {fridge_name} من الغرفة {room_name} لأنها تحتوي على أكياس مخزنة.')

        existing_shelves = existing_room.get('shelves', {}) or {}
        new_shelves = new_room.get('shelves', {}) or {}
        for fridge_name in set(existing_room.get('fridges', []) or []) & set(new_room.get('fridges', []) or []):
            for shelf_name in set(existing_shelves.get(fridge_name, []) or []) - set(new_shelves.get(fridge_name, []) or []):
                if _storage_location_has_bags(room_name, fridge_name=fridge_name, shelf_name=shelf_name):
                    raise ValueError(f'لا يمكن حذف الرف {shelf_name} من الثلاجة {fridge_name} في الغرفة {room_name} لأنه يحتوي على أكياس مخزنة.')


def _room_capacity(detail, capacity_per_shelf=100):
    if detail.get('roomCapacity'):
        try:
            return max(int(detail.get('roomCapacity')), 1)
        except (TypeError, ValueError):
            pass
    fridge_settings = detail.get('fridgeSettings') or {}
    shelves_map = detail.get('shelves', {}) or {}
    total = 0
    for fridge_name in detail.get('fridges', []) or []:
        fs = fridge_settings.get(fridge_name) or {}
        shelves = shelves_map.get(fridge_name, []) or []
        shelf_count = len(shelves) or int(fs.get('shelves') or 1)
        cap = int(fs.get('capacityPerShelf') or capacity_per_shelf or 100)
        total += max(shelf_count, 1) * max(cap, 1)
    return max(total, 1)


def _update_storage_room_location(old_room_name, new_room_name):
    if not old_room_name or not new_room_name or old_room_name == new_room_name:
        return

    pattern = re.compile(rf'^(?P<prefix>تخزين رئيسي:\s*)?(?P<room>{re.escape(old_room_name)})(?P<rest>(?:\s*/.*)?)$')
    changed_bags = []
    for bag in BloodBag.objects.all():
        current_location = str(bag.location or '')
        match = pattern.match(current_location)
        if not match:
            continue
        new_location = f"{match.group('prefix') or ''}{new_room_name}{match.group('rest') or ''}"
        if new_location != current_location:
            bag.location = new_location
            changed_bags.append(bag)

    if changed_bags:
        BloodBag.objects.bulk_update(changed_bags, ['location'])
        invalidate_runtime_caches()


def rebuild_storage_rooms(config):
    StorageFridge.objects.all().delete()
    StorageRoom.objects.all().delete()
    for detail in config.details or []:
        room_name = detail['room']
        room = StorageRoom.objects.create(
            room=room_name,
            used=0,
            capacity=_room_capacity(detail, config.capacity_per_shelf),
        )
        for fridge_name in detail.get('fridges', []):
            StorageFridge.objects.create(room=room, fridge_id=fridge_name, used=0)
    sync_storage_from_bags()


def default_storage_details(total_rooms, fridges_per_room, shelves_per_fridge):
    details = []
    for room_index in range(1, total_rooms + 1):
        room_name = f'Room {chr(64 + room_index)}'
        fridges = []
        shelves_map = {}
        for fridge_index in range(1, fridges_per_room + 1):
            fridge_name = f'Fridge {fridge_index}'
            fridges.append(fridge_name)
            shelves_map[fridge_name] = [f'Shelf {s}' for s in range(1, shelves_per_fridge + 1)]
        details.append({'room': room_name, 'fridges': fridges, 'shelves': shelves_map})
    return details


import os

DEFAULT_SUPERADMIN_PASSWORD = os.environ.get('DROP4LIFE_SUPERADMIN_PASSWORD', 'a1234!')
SUPERADMIN_USERNAME = 'superadmin'
PROTECTED_USERNAMES = frozenset({SUPERADMIN_USERNAME})


def ensure_default_superadmin():
    from django.contrib.auth.hashers import make_password

    if Account.objects.filter(username=SUPERADMIN_USERNAME).exists():
        return

    Account.objects.create(
        username=SUPERADMIN_USERNAME,
        name='مدير النظام',
        role='superadmin',
        role_code='DR',
        email='admin@drop4life.org',
        phone='',
        password=make_password(DEFAULT_SUPERADMIN_PASSWORD),
        status='active',
    )


def remove_default_it_account():
    Account.objects.filter(username='it').delete()


def setup_empty_system(superadmin_password=DEFAULT_SUPERADMIN_PASSWORD):
    ensure_blood_inventory()
    config = get_storage_config()
    if not config.details:
        config.total_rooms = 3
        config.total_fridges_per_room = 2
        config.total_shelves_per_fridge = 4
        config.capacity_per_shelf = 100
        config.room_names = ['Room A', 'Room B', 'Room C']
        config.details = default_storage_details(3, 2, 4)
        config.save()
    if not StorageRoom.objects.exists():
        rebuild_storage_rooms(config)
    if not Account.objects.filter(username='superadmin').exists():
        from django.contrib.auth.hashers import make_password

        Account.objects.create(
            username='superadmin',
            name='مدير النظام',
            role='superadmin',
            role_code='DR',
            email='admin@drop4life.org',
            phone='',
            password=make_password(superadmin_password),
            status='active',
        )
        push_audit('system', 'Engine', 'تهيئة النظام', 'تم إنشاء حساب superadmin الافتراضي.')
    remove_default_it_account()


def _generate_bag_id():
    max_number = 0
    for bag_id in BloodBag.objects.values_list('bag_id', flat=True):
        match = re.match(r'^BAG-(\d+)$', str(bag_id or ''))
        if not match:
            continue
        try:
            max_number = max(max_number, int(match.group(1)))
        except ValueError:
            continue

    return f'BAG-{max_number + 1:04d}'


def _generate_donor_id():
    import random

    for _ in range(50):
        donor_id = f'D-{random.randint(100, 999)}'
        if not Donor.objects.filter(donor_id=donor_id).exists():
            return donor_id
    raise ValueError('تعذر إنشاء رقم متبرع فريد.')


def _generate_request_id():
    import random

    for _ in range(50):
        request_id = f'REQ-{random.randint(100, 999)}'
        if not BloodRequest.objects.filter(request_id=request_id).exists():
            return request_id
    raise ValueError('تعذر إنشاء رقم طلب فريد.')


def get_shelf_used_count(room_name, fridge_name, shelf_name):
    total = 0
    for bag in BloodBag.objects.filter(status__in=STORAGE_OCCUPYING_STATUSES):
        room, fridge, shelf = _parse_bag_location_parts(bag.location)
        if room == room_name and fridge == fridge_name and shelf == shelf_name:
            total += _bag_storage_qty(bag)
    return total


def _storage_units_for_donation(qty, product_type=None):
    qty = max(int(qty or 1), 1)
    product_type = normalize_product_type(product_type or PRODUCT_TYPE_WHOLE)
    if product_type == PRODUCT_TYPE_WHOLE:
        return qty * WHOLE_BLOOD_STORAGE_UNITS
    return qty


def find_shelf_with_units(room_name, fridge_name, units_needed, config=None):
    config = config or get_storage_config()
    detail = _find_room_detail(room_name, config)
    units_needed = max(int(units_needed or 1), 1)

    fridge_order = []
    if detail:
        all_fridges = list(detail.get('fridges') or [])
        if fridge_name in all_fridges:
            fridge_order = [fridge_name] + [name for name in all_fridges if name != fridge_name]
        else:
            fridge_order = [fridge_name] if fridge_name else all_fridges
    else:
        fridge_order = [fridge_name] if fridge_name else []

    for fn in fridge_order:
        shelves, cap_per_shelf = _get_fridge_settings(detail or {}, fn, config)
        for shelf in shelves:
            used = get_shelf_used_count(room_name, fn, shelf)
            if cap_per_shelf - used >= units_needed:
                return room_name, fn, shelf

    available_total = count_available_shelf_slots(room_name, fridge_name, config)
    raise ValueError(
        f'⚠️ لا توجد سعة كافية في {room_name} / {fridge_name}. '
        f'مطلوب {units_needed} مكان (وحدة كاملة = {WHOLE_BLOOD_STORAGE_UNITS} أماكن)، متاح {available_total} فقط.'
    )


def _find_room_detail(room_name, config=None):
    config = config or get_storage_config()
    for detail in config.details or []:
        if detail.get('room') == room_name:
            return detail
    return None


def _get_fridge_settings(detail, fridge_name, config):
    detail = detail or {}
    settings = (detail.get('fridgeSettings') or {}).get(fridge_name) or {}
    shelves_map = detail.get('shelves') or {}
    shelves = shelves_map.get(fridge_name) or []
    try:
        shelf_count = int(settings.get('shelves')) if settings.get('shelves') is not None else None
    except (TypeError, ValueError):
        shelf_count = None
    if shelf_count is None or shelf_count < 1:
        shelf_count = len(shelves) if shelves else int(config.total_shelves_per_fridge or 1)
    shelf_count = max(shelf_count, 1)
    try:
        capacity_per_shelf = int(settings.get('capacityPerShelf')) if settings.get('capacityPerShelf') is not None else int(config.capacity_per_shelf or 100)
    except (TypeError, ValueError):
        capacity_per_shelf = int(config.capacity_per_shelf or 100)
    capacity_per_shelf = max(capacity_per_shelf, 1)
    if not shelves:
        shelves = [f'Shelf {i}' for i in range(1, shelf_count + 1)]
    return shelves, capacity_per_shelf


def _fridge_capacity(config, room_name=None, fridge_name=None):
    if room_name and fridge_name:
        detail = _find_room_detail(room_name, config)
        if detail:
            shelves, cap_per_shelf = _get_fridge_settings(detail, fridge_name, config)
            return len(shelves) * cap_per_shelf
    return max(int(config.capacity_per_shelf or 100), 1) * max(int(config.total_shelves_per_fridge or 1), 1)


def count_available_shelf_slots(room_name, fridge_name=None, config=None):
    config = config or get_storage_config()
    detail = _find_room_detail(room_name, config)
    total = 0
    fridge_names = []
    if detail:
        all_fridges = list(detail.get('fridges') or [])
        if fridge_name and fridge_name in all_fridges:
            fridge_names = [fridge_name] + [name for name in all_fridges if name != fridge_name]
        elif fridge_name:
            fridge_names = [fridge_name] + all_fridges
        else:
            fridge_names = all_fridges
    elif fridge_name:
        fridge_names = [fridge_name]

    for fn in fridge_names:
        shelves, cap_per_shelf = _get_fridge_settings(detail or {}, fn, config)
        for shelf in shelves:
            used = get_shelf_used_count(room_name, fn, shelf)
            total += max(cap_per_shelf - used, 0)
    return total


def allocate_shelf_slots(room_name, fridge_name, qty, config=None):
    config = config or get_storage_config()
    detail = _find_room_detail(room_name, config)
    qty = max(int(qty or 1), 1)

    fridge_order = []
    if detail:
        all_fridges = list(detail.get('fridges') or [])
        if fridge_name in all_fridges:
            fridge_order = [fridge_name] + [name for name in all_fridges if name != fridge_name]
        else:
            fridge_order = [fridge_name] if fridge_name else all_fridges
    else:
        fridge_order = [fridge_name] if fridge_name else []

    slots = []
    for fn in fridge_order:
        if len(slots) >= qty:
            break
        shelves, cap_per_shelf = _get_fridge_settings(detail or {}, fn, config)
        for shelf in shelves:
            if len(slots) >= qty:
                break
            used = get_shelf_used_count(room_name, fn, shelf)
            available = cap_per_shelf - used
            while available > 0 and len(slots) < qty:
                slots.append((room_name, fn, shelf))
                available -= 1

    if len(slots) < qty:
        available_total = count_available_shelf_slots(room_name, fridge_name, config)
        raise ValueError(
            f'⚠️ لا توجد أرفف كافية في {room_name} / {fridge_name}. '
            f'مطلوب {qty} مكان، متاح {available_total} فقط.'
        )
    return slots[:qty]


def _is_fridge_full(fridge, config):
    room_name = fridge.room.room if getattr(fridge, 'room_id', None) else None
    capacity = _fridge_capacity(config, room_name, fridge.fridge_id)
    return fridge.used >= capacity


def _is_room_full(room, config):
    fridges = list(StorageFridge.objects.filter(room=room))
    if not fridges:
        return room.used >= room.capacity
    return all(_is_fridge_full(fridge, config) for fridge in fridges)


def _is_all_storage_full(config=None):
    config = config or get_storage_config()
    rooms = list(StorageRoom.objects.all())
    if not rooms:
        return False
    return all(_is_room_full(room, config) for room in rooms)


def _available_fridges_in_room(room, exclude_fridge_id, config):
    return [
        fridge.fridge_id
        for fridge in StorageFridge.objects.filter(room=room)
        if not _is_fridge_full(fridge, config) and fridge.fridge_id != exclude_fridge_id
    ]


def validate_storage_for_bags(room_name, fridge_name, qty=1, shelf_name=None, product_type=None):
    config = get_storage_config()
    qty = max(int(qty or 1), 1)
    storage_units = _storage_units_for_donation(qty, product_type)

    if _is_all_storage_full(config):
        raise ValueError(
            '⚠️ المخزون ممتلئ بالكامل — لا يمكن إدخال أي أكياس دم جديدة.'
        )

    room = StorageRoom.objects.filter(room=room_name).select_related().first()
    fridge = (
        StorageFridge.objects.filter(room=room, fridge_id=fridge_name).first()
        if room
        else None
    )
    if not room or not fridge:
        raise ValueError('موقع التخزين غير صالح.')

    if _is_room_full(room, config):
        raise ValueError(
            '⚠️ هذه الغرفة ممتلئة بالكامل — جميع الثلاجات فيها ممتلئة.\n\n'
            'يرجى اختيار غرفة أخرى.'
        )

    if room.used + storage_units > room.capacity:
        remaining = max(room.capacity - room.used, 0)
        raise ValueError(
            f'⚠️ الغرفة {room_name} لا تتسع لـ {qty} وحدة (تحتاج {storage_units} مكان — المتبقي {remaining}).'
        )

    fridge_capacity = _fridge_capacity(config, room_name, fridge_name)
    if _is_fridge_full(fridge, config):
        available = _available_fridges_in_room(room, fridge_name, config)
        suggestion = (
            f"\n\nثلاجات متاحة في نفس الغرفة: {', '.join(available)}."
            if available
            else ''
        )
        raise ValueError(
            f'⚠️ الثلاجة {fridge_name} ممتلئة.{suggestion}\n\nيرجى اختيار ثلاجة أخرى.'
        )

    if fridge.used + storage_units > fridge_capacity:
        remaining = max(fridge_capacity - fridge.used, 0)
        available = _available_fridges_in_room(room, fridge_name, config)
        suggestion = (
            f"\n\nثلاجات متاحة في نفس الغرفة: {', '.join(available)}."
            if available
            else ''
        )
        raise ValueError(
            f'⚠️ الثلاجة {fridge_name} لا تتسع لـ {qty} وحدة '
            f'(تحتاج {storage_units} مكان — المتبقي {remaining} فقط).{suggestion}'
        )

    if shelf_name:
        detail = _find_room_detail(room_name, config)
        shelves, cap_per_shelf = _get_fridge_settings(detail or {}, fridge_name, config)
        if shelf_name not in shelves:
            raise ValueError('⚠️ الرف المحدد غير موجود في هذه الثلاجة.')
        shelf_used = get_shelf_used_count(room_name, fridge_name, shelf_name)
        if shelf_used + storage_units > cap_per_shelf:
            raise ValueError('⚠️ هذا الرف لا يتسع لهذه الكمية.')
    else:
        available_slots = count_available_shelf_slots(room_name, fridge_name, config)
        if available_slots < storage_units:
            raise ValueError(
                f'⚠️ لا توجد أماكن كافية في {room_name}. '
                f'مطلوب {storage_units} مكان لوحدة الدم الكاملة، متاح {available_slots} فقط.'
            )


def _update_fridge_usage(room_name, fridge_name, delta):
    room = StorageRoom.objects.filter(room=room_name).first()
    if not room:
        return
    fridge = StorageFridge.objects.filter(room=room, fridge_id=fridge_name).first()
    if fridge:
        fridge.used = max(0, fridge.used + delta)
        fridge.save(update_fields=['used'])
    room.used = max(0, min(room.capacity, room.used + delta))
    room.save(update_fields=['used'])


def _parse_bag_location(location):
    """استخراج (اسم الغرفة، اسم الثلاجة) من حقل موقع الكيس."""
    room_name, fridge_name, _ = _parse_bag_location_parts(location)
    return room_name, fridge_name


def _parse_bag_location_parts(location):
    if not location:
        return None, None, None
    loc = str(location).strip()
    if loc.startswith('تخزين رئيسي:'):
        loc = loc[len('تخزين رئيسي:'):].strip()
    parts = [part.strip() for part in loc.split('/')]
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    if len(parts) >= 2:
        return parts[0], parts[1], None
    if len(parts) == 1:
        return parts[0], None, None
    return None, None, None


def _bag_storage_qty(bag):
    if bag.status not in STORAGE_OCCUPYING_STATUSES:
        return 0
    product_type = normalize_product_type(getattr(bag, 'product_type', None))
    if bag.status == 'Pending' or product_type == PRODUCT_TYPE_WHOLE:
        return WHOLE_BLOOD_STORAGE_UNITS
    return max(int(getattr(bag, 'qty', None) or 1), 1)


def _release_bag_storage(bag):
    """تحرير مكان التخزين عند خروج الكيس من الثلاجة."""
    room_name, fridge_name = _parse_bag_location(bag.location)
    if room_name and fridge_name:
        _update_fridge_usage(room_name, fridge_name, -_bag_storage_qty(bag))


def _occupy_bag_storage(bag):
    """حجز مكان تخزين عند إعادة الكيس للثلاجة."""
    room_name, fridge_name = _parse_bag_location(bag.location)
    if room_name and fridge_name:
        _update_fridge_usage(room_name, fridge_name, _bag_storage_qty(bag))


def _release_bags_storage(bags):
    for bag in bags:
        _release_bag_storage(bag)


def _remove_bag_on_exit(bag):
    """إزالة الكيس نهائياً من النظام بعد خروجه (تسليم/استهلاك)."""
    bag_id = bag.bag_id
    if bag.status in STORAGE_OCCUPYING_STATUSES:
        _release_bag_storage(bag)
    _unlink_bag_from_requests(bag_id)
    bag._skip_inventory_signal = True
    bag.delete()
    return bag_id


def issue_approved_bags(blood_type, qty, product_type=None):
    """تسليم أقدم الأكياس المعتمدة: تحرير التخزين ثم حذفها من النظام."""
    product_type = normalize_product_type(product_type)
    qty = max(int(qty or 1), 1)
    bags = list(
        BloodBag.objects.filter(
            blood_type=blood_type,
            product_type=product_type,
            status='Approved',
        )
        .order_by('expiry', 'date')[:qty]
    )
    if len(bags) < qty:
        raise ValueError(
            f'لا توجد أكياس {get_product_label(product_type)} معتمدة كافية. '
            f'المطلوب {qty} والمتاح {len(bags)} كيس.'
        )
    bag_ids = []
    for bag in bags:
        bag_ids.append(_remove_bag_on_exit(bag))
    invalidate_runtime_caches()
    return bag_ids


def restore_issued_bags(bag_ids):
    """لا يُعاد إنشاء أكياس مُخرَجة — تُعدَّل أرقام المخزون فقط."""
    return []


def reserve_bags_for_request(req):
    """حجز أكياس لطلب مستشفى: Approved → Reserved + available → reserved."""
    product_type = normalize_product_type(getattr(req, 'product_type', None))
    qty = max(int(req.qty or 1), 1)
    inventory = BloodInventory.objects.select_for_update().filter(
        blood_type=inventory_key(req.blood, product_type)
    ).first()
    if not inventory or inventory.available < qty:
        available = inventory.available if inventory else 0
        raise ValueError(
            f'المخزون غير كافٍ للحجز ({get_product_label(product_type)}). '
            f'المطلوب {qty} والمتاح {available}.'
        )

    bags = list(
        BloodBag.objects.filter(
            blood_type=req.blood,
            product_type=product_type,
            status='Approved',
        )
        .order_by('expiry', 'date')[:qty]
    )
    if len(bags) < qty:
        raise ValueError(
            f'لا توجد أكياس معتمدة كافية للحجز. المطلوب {qty} والمتاح {len(bags)}.'
        )

    bag_ids = []
    for bag in bags:
        bag.status = 'Reserved'
        bag.save(update_fields=['status'])
        bag_ids.append(bag.bag_id)

    inventory.available -= qty
    inventory.reserved += qty
    inventory.save(update_fields=['available', 'reserved'])

    req.reserved_bag_ids = bag_ids
    req.save(update_fields=['reserved_bag_ids'])
    return bag_ids


def release_request_reservation(req):
    """إلغاء حجز طلب: Reserved → Approved + reserved → available."""
    bag_ids = list(req.reserved_bag_ids or [])
    if not bag_ids:
        return []

    released = []
    for bag_id in bag_ids:
        bag = BloodBag.objects.filter(bag_id=bag_id, status='Reserved').first()
        if not bag:
            continue
        bag.status = 'Approved'
        bag.save(update_fields=['status'])
        released.append(bag.bag_id)

    qty = len(released)
    if qty:
        inventory = get_inventory_record(req.blood, product_type)
        if inventory:
            inventory.reserved = max(0, inventory.reserved - qty)
            inventory.available += qty
            inventory.save(update_fields=['available', 'reserved'])

    req.reserved_bag_ids = []
    req.save(update_fields=['reserved_bag_ids'])
    return released


def deliver_reserved_bags(bag_ids):
    """تسليم أكياس محجوزة: تحرير التخزين ثم حذفها من النظام."""
    delivered = []
    for bag_id in bag_ids or []:
        bag = BloodBag.objects.filter(bag_id=bag_id, status='Reserved').first()
        if not bag:
            continue
        delivered.append(_remove_bag_on_exit(bag))
    invalidate_runtime_caches()
    return delivered


def _build_bag_location(room_name, fridge_name, shelf_name=None, approved=False):
    if shelf_name:
        location = f'{room_name} / {fridge_name} / {shelf_name}'
    else:
        location = f'{room_name} / {fridge_name}'
    if approved:
        location = f'تخزين رئيسي: {location}'
    return location


@transaction.atomic
def transfer_bag(bag_id, room_name, fridge_name, shelf_name=None, username=None, role=None):
    """نقل كيس بين مواقع التخزين مع تحديث سعة الثلاجات."""
    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    if not bag:
        raise ValueError('الكيس غير موجود.')
    if bag.status in ('Delivered', 'Expired'):
        raise ValueError('لا يمكن نقل كيس مُسلَّم أو منتهي الصلاحية.')

    room_name = str(room_name or '').strip()
    fridge_name = str(fridge_name or '').strip()
    if not room_name or not fridge_name:
        raise ValueError('يجب تحديد الغرفة والثلاجة.')

    approved_prefix = str(bag.location or '').startswith('تخزين رئيسي:')
    new_location = _build_bag_location(
        room_name,
        fridge_name,
        shelf_name=str(shelf_name).strip() if shelf_name else None,
        approved=approved_prefix or bag.status in ('Approved', 'Reserved'),
    )

    old_room, old_fridge = _parse_bag_location(bag.location)
    qty = _bag_storage_qty(bag)
    same_fridge = old_room == room_name and old_fridge == fridge_name

    if same_fridge:
        if bag.location != new_location:
            bag.location = new_location
            bag.save(update_fields=['location'])
        push_audit(username, role, 'نقل كيس', f'كيس {bag_id} → {new_location}')
        return bag

    if bag.status in STORAGE_OCCUPYING_STATUSES:
        _release_bag_storage(bag)

    validate_storage_for_bags(
        room_name,
        fridge_name,
        qty,
        shelf_name,
        product_type=normalize_product_type(bag.product_type),
    )

    bag.location = new_location
    bag.save(update_fields=['location'])
    _occupy_bag_storage(bag)
    push_audit(username, role, 'نقل كيس', f'كيس {bag_id} → {new_location}')
    invalidate_runtime_caches()
    return bag


@transaction.atomic
def sync_storage_from_bags():
    """إعادة حساب used في الغرف والثلاجات من مواقع الأكياس الفعلية."""
    StorageFridge.objects.all().update(used=0)
    StorageRoom.objects.all().update(used=0)

    fridge_usage = {}
    room_usage = {}
    for bag in BloodBag.objects.filter(status__in=STORAGE_OCCUPYING_STATUSES):
        room_name, fridge_name = _parse_bag_location(bag.location)
        if not room_name or not fridge_name:
            continue
        qty = _bag_storage_qty(bag)
        fridge_key = (room_name, fridge_name)
        fridge_usage[fridge_key] = fridge_usage.get(fridge_key, 0) + qty
        room_usage[room_name] = room_usage.get(room_name, 0) + qty

    for (room_name, fridge_name), count in fridge_usage.items():
        room = StorageRoom.objects.filter(room=room_name).first()
        if not room:
            continue
        fridge = StorageFridge.objects.filter(room=room, fridge_id=fridge_name).first()
        if fridge:
            fridge.used = count
            fridge.save(update_fields=['used'])

    for room_name, count in room_usage.items():
        room = StorageRoom.objects.filter(room=room_name).first()
        if room:
            room.used = min(count, room.capacity)
            room.save(update_fields=['used'])

    invalidate_runtime_caches()
    return {
        'fridges_updated': len(fridge_usage),
        'rooms_updated': len(room_usage),
    }


@transaction.atomic
def add_donation_bags(blood_type, qty, room_name, fridge_name, shelf_name=None, username=None, role=None, product_type=None):
    qty = max(int(qty or 1), 1)
    product_type = normalize_product_type(product_type or PRODUCT_TYPE_WHOLE)
    config = get_storage_config()
    validate_storage_for_bags(room_name, fridge_name, qty, shelf_name, product_type=product_type)

    today = date.today()
    expiry = compute_expiry_date(product_type, today)
    created = []
    for _ in range(qty):
        if shelf_name:
            room, fridge, shelf = room_name, fridge_name, shelf_name
        else:
            room, fridge, shelf = find_shelf_with_units(
                room_name,
                fridge_name,
                WHOLE_BLOOD_STORAGE_UNITS,
                config,
            )
        location = f'{room} / {fridge} / {shelf}'
        bag = BloodBag.objects.create(
            bag_id=_generate_bag_id(),
            donor=UNKNOWN_DONOR_NAME,
            blood_type=PENDING_BLOOD_TYPE,
            product_type=product_type,
            qty=1,
            date=today,
            expiry=expiry,
            location=location,
            status='Pending',
        )
        created.append(bag)
    sync_storage_from_bags()
    push_audit(
        username,
        role,
        'إضافة أكياس تبرع',
        f'تم إضافة {qty} وحدة دم كاملة وإرسالها للمعمل.',
    )
    return created


@transaction.atomic
def add_donation_donor(name, national_id, age, phone, address, known_blood, room_name, fridge_name, username, role, product_type=None):
    from .validators import validate_egypt_phone, validate_national_id

    national_id = validate_national_id(national_id)
    if phone:
        phone = validate_egypt_phone(phone)
    validate_storage_for_bags(room_name, fridge_name, 1, product_type=PRODUCT_TYPE_WHOLE)

    product_type = normalize_product_type(product_type or PRODUCT_TYPE_WHOLE)
    today = date.today()
    expiry = compute_expiry_date(product_type, today)
    config = get_storage_config()
    room, fridge, shelf = find_shelf_with_units(
        room_name,
        fridge_name,
        WHOLE_BLOOD_STORAGE_UNITS,
        config,
    )
    location = f'{room} / {fridge} / {shelf}'
    existing = Donor.objects.filter(national_id=national_id).first()
    if not existing and phone:
        existing = Donor.objects.filter(phone=phone).first()

    bag_id = _generate_bag_id()
    if existing:
        BloodBag.objects.create(
            bag_id=bag_id,
            donor=existing.name,
            blood_type=PENDING_BLOOD_TYPE,
            product_type=product_type,
            qty=1,
            date=today,
            expiry=expiry,
            location=location,
            status='Pending',
        )
        existing.total_count += 1
        existing.last_date = today
        existing.save(update_fields=['total_count', 'last_date'])
        sync_storage_from_bags()
        push_audit(username, role, 'إضافة تبرع لمتبرع موجود', f'كيس {bag_id} للمتبرع {existing.name}.')
        return bag_id

    BloodBag.objects.create(
        bag_id=bag_id,
        donor=name,
        blood_type=PENDING_BLOOD_TYPE,
        product_type=product_type,
        qty=1,
        date=today,
        expiry=expiry,
        location=location,
        status='Pending',
    )
    PendingDonor.objects.create(
        bag_id=bag_id,
        name=name,
        national_id=national_id,
        age=age,
        phone=phone or '',
        address=address or '',
        room=room_name,
        fridge=fridge_name,
    )
    sync_storage_from_bags()
    push_audit(username, role, 'تسجيل متبرع مؤقت', f'متبرع {name} — عينة {bag_id}.')
    return bag_id


@transaction.atomic
def _normalize_lab_diseases(diseases):
    if not diseases:
        return []
    if isinstance(diseases, str):
        candidates = re.split(r'[\n,،;]+', diseases)
    else:
        candidates = diseases
    cleaned = []
    for item in candidates:
        disease = str(item or '').strip()
        if disease and disease not in cleaned:
            cleaned.append(disease)
    return cleaned


def submit_lab_result(bag_id, decision, final_type, reason, user_name, username, role, diseases=None):
    if normalize_role_code(role) not in ('DR', 'MLS'):
        raise ValueError('فقط المعمل أو السوبر أدمن يمكنه تنفيذ التحليل.')

    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    if not bag:
        raise ValueError('الكيس غير موجود.')

    if bag.status != 'Pending':
        raise ValueError('هذا الكيس ليس بانتظار المعمل — لا يمكن إعادة تحليله.')

    disease_list = _normalize_lab_diseases(diseases)
    disease_text = '، '.join(disease_list) if disease_list else ''
    final_type = validate_blood_type(final_type)
    today = date.today()
    product_type = normalize_product_type(bag.product_type)
    product_label = get_product_label(product_type)

    if decision == 'Approved' and disease_list:
        raise ValueError('لا يمكن اعتماد عينة تحتوي على أمراض مكتشفة. اختر رفضاً بدلاً من ذلك.')

    if decision == 'Approved':
        donor_name = bag.donor
        parent_room, parent_fridge, _ = _parse_bag_location_parts(bag.location)
        parent_bag_id = bag.bag_id

        pending = PendingDonor.objects.filter(bag_id=bag_id).first()
        if pending:
            donor_id = _generate_donor_id()
            Donor.objects.create(
                donor_id=donor_id,
                name=pending.name,
                national_id=pending.national_id,
                blood=final_type,
                phone=pending.phone,
                age=pending.age,
                address=pending.address,
                status='Active',
                total_count=1,
                last_date=today,
            )
            pending.delete()
            push_audit(username, role, 'ترقية متبرع جديد', f'المتبرع {pending.name} — {donor_id}.')

        # Remove pending whole-blood bag before allocating split slots so shelf
        # counts reflect freed space (3 units in → 3 component units out).
        bag._skip_inventory_signal = True
        bag.delete()

        config = get_storage_config()
        if not parent_room or not parent_fridge:
            raise ValueError('موقع التخزين الأصلي للعينة غير صالح.')
        split_slots = allocate_shelf_slots(parent_room, parent_fridge, len(PRODUCT_TYPES), config)

        created_bags = []
        for pt, (slot_room, slot_fridge, slot_shelf) in zip(PRODUCT_TYPES, split_slots):
            inventory, _ = get_or_create_inventory_record(final_type, pt)
            inventory.available += 1
            inventory.save(update_fields=['available'])
            location = f'تخزين رئيسي: {slot_room} / {slot_fridge} / {slot_shelf}'
            new_bag = BloodBag.objects.create(
                bag_id=_generate_bag_id(),
                donor=donor_name,
                blood_type=final_type,
                product_type=pt,
                qty=1,
                date=today,
                expiry=compute_expiry_date(pt, today),
                location=location,
                status='Approved',
            )
            created_bags.append(new_bag)

        split_ids = ', '.join(b.bag_id for b in created_bags)
        push_audit(
            username,
            role,
            'اعتماد معملي وتقسيم',
            f'العينة {parent_bag_id} → {final_type}: {split_ids}. الأمراض: {disease_text or "لا يوجد"}.',
        )
        Notification.objects.create(
            title='✅ اعتماد وتقسيم عينة',
            notification_type='lab',
            time=timezone.localtime().strftime('%Y-%m-%d %H:%M'),
            message=(
                f'تم اعتماد {parent_bag_id} وتقسيمها إلى 3 مكونات ({final_type}): '
                f'كرات + بلازما + صفائح — {split_ids}.'
            ),
            read=False,
        )
        invalidate_runtime_caches()
        sync_storage_from_bags()
        return created_bags

    rejection_reason = (reason or '').strip()
    if disease_text and not rejection_reason:
        rejection_reason = f'الأمراض المكتشفة: {disease_text}'
    elif disease_text and rejection_reason:
        rejection_reason = f'{rejection_reason} — الأمراض: {disease_text}'
    if not rejection_reason:
        raise ValueError('يجب كتابة سبب الرفض أو تحديد الأمراض المكتشفة.')

    donor_name = (bag.donor or '').strip()
    pending = PendingDonor.objects.filter(bag_id=bag_id).first()
    if pending and pending.name:
        donor_name = pending.name.strip()

    DisposalLog.objects.create(
        bag_code=bag_id,
        disposal_type=product_label,
        blood=final_type,
        product_type=product_type,
        date=today,
        reason=rejection_reason,
        worker=user_name,
        donor_name=donor_name,
        detected_diseases=disease_list,
    )
    bag.blood_type = final_type
    bag._skip_inventory_signal = True
    bag.delete()

    push_audit(
        username,
        role,
        'رفض معملي واتلاف فوري',
        f'كيس {bag_id} ({product_label}): {rejection_reason}',
    )
    Notification.objects.create(
        title='❌ عينة مرفوضة وتم اتلافها',
        notification_type='lab',
        time=timezone.localtime().strftime('%Y-%m-%d %H:%M'),
        message=f'تم رفض واتلاف الكيس {bag_id}. السبب: {rejection_reason}',
        read=False,
    )
    invalidate_runtime_caches()
    sync_storage_from_bags()
    return None


def _unlink_bag_from_requests(bag_id):
    """إزالة الكيس من قوائم الحجز في طلبات المستشفيات."""
    for req in BloodRequest.objects.all():
        reserved_ids = list(req.reserved_bag_ids or [])
        if bag_id not in reserved_ids:
            continue
        reserved_ids.remove(bag_id)
        req.reserved_bag_ids = reserved_ids
        req.save(update_fields=['reserved_bag_ids'])


def _unlink_bag_from_beneficiaries(bag_id):
    """إزالة الكيس من سجلات المستفيدين وتحديث العدد."""
    for ben in Beneficiary.objects.all():
        ids = list(ben.consumed_bag_ids or [])
        if bag_id not in ids:
            continue
        ids.remove(bag_id)
        ben.consumed_bag_ids = ids
        ben.bags_consumed = len(ids)
        if ben.bags_consumed <= 0:
            ben.delete()
        else:
            ben.save(update_fields=['consumed_bag_ids', 'bags_consumed'])


def _deduct_bag_from_inventory(bag):
    """خصم الكيس من المخزون حسب حالته."""
    if bag.blood_type in (PENDING_BLOOD_TYPE, 'Unknown', '', None):
        return
    inventory = get_inventory_record(bag.blood_type, bag.product_type)
    if not inventory:
        return
    qty = _bag_storage_qty(bag)
    if bag.status == 'Approved':
        inventory.available = max(0, inventory.available - qty)
        inventory.save(update_fields=['available'])
    elif bag.status == 'Reserved':
        inventory.reserved = max(0, inventory.reserved - qty)
        inventory.save(update_fields=['reserved'])
    elif bag.status == 'Delivered':
        inventory.issued = max(0, inventory.issued - qty)
        inventory.save(update_fields=['issued'])
    elif bag.status == 'Expired':
        inventory.expired = max(0, inventory.expired - qty)
        inventory.save(update_fields=['expired'])


def _purge_bag_everywhere(bag):
    """إزالة أثر الكيس من المخزون والتخزين والطلبات والمستفيدين."""
    _unlink_bag_from_requests(bag.bag_id)
    _unlink_bag_from_beneficiaries(bag.bag_id)
    _deduct_bag_from_inventory(bag)
    if bag.status in STORAGE_OCCUPYING_STATUSES:
        _release_bag_storage(bag)


@transaction.atomic
def delete_bag(bag_id, username, role, audit_note=None):
    """حذف كيس بالكامل: مخزون + تخزين + حجوزات + مستفيدين + السجل."""
    if normalize_role_code(role) != 'DR':
        raise ValueError('فقط السوبر أدمن يمكنه حذف أكياس الدم.')

    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    if not bag:
        raise ValueError('الكيس غير موجود.')

    _purge_bag_everywhere(bag)
    bag._skip_inventory_signal = True
    bag.delete()

    push_audit(
        username,
        role,
        'حذف كيس',
        audit_note or f'تم حذف الكيس {bag_id} وإزالته من المخزون والتخزين وجميع الارتباطات.',
    )
    invalidate_runtime_caches()
    return True


@transaction.atomic
def dispose_bag(bag_id, disposal_type, blood, reason, worker, username, role):
    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    if not bag:
        raise ValueError('الكيس غير موجود في المخزون.')
    if bag.status not in ACTIVE_BAG_STATUSES:
        raise ValueError('الكيس غير موجود في المخزون النشط.')

    DisposalLog.objects.create(
        bag_code=bag_id,
        disposal_type=disposal_type or get_product_label(bag.product_type),
        blood=blood or bag.blood_type,
        product_type=normalize_product_type(bag.product_type),
        date=date.today(),
        reason=reason,
        worker=worker,
        donor_name=(bag.donor or '').strip(),
        detected_diseases=[],
    )

    _purge_bag_everywhere(bag)
    bag._skip_inventory_signal = True
    bag.delete()
    push_audit(username, role, 'تسجيل تخلص', f'كيس {bag_id}: {reason}')
    invalidate_runtime_caches()
    return True


@transaction.atomic
def purge_terminal_bags():
    """حذف أي أكياس متبقية بحالات نهائية (Delivered/Expired/Rejected)."""
    removed = 0
    for bag in BloodBag.objects.filter(status__in=TERMINAL_BAG_STATUSES):
        bag._skip_inventory_signal = True
        bag.delete()
        removed += 1
    if removed:
        sync_storage_from_bags()
        invalidate_runtime_caches()
    return removed


@transaction.atomic
def deliver_request(request_id, recipient_name, recipient_phone, notes, delivered_by, username, role):
    from .role_utils import normalize_role_code
    from .validators import validate_egypt_phone

    if recipient_phone:
        recipient_phone = validate_egypt_phone(recipient_phone, 'رقم هاتف المستلم')
    req = BloodRequest.objects.filter(request_id=request_id).first()
    if not req:
        raise ValueError('الطلب غير موجود.')
    current_status = _normalize_request_status(req.status)
    if current_status == REQUEST_STATUS_DELIVERED:
        raise ValueError('الطلب مُسلّم مسبقاً.')
    if current_status == REQUEST_STATUS_REJECTED:
        raise ValueError('الطلب مرفوض ولا يمكن تسليمه.')
    if current_status == REQUEST_STATUS_REVIEW:
        raise ValueError('الطلب بانتظار موافقة السوبر أدمن.')
    if normalize_role_code(role) == 'ADM' and current_status != REQUEST_STATUS_APPROVED:
        raise ValueError('الطلب غير جاهز للتسليم.')

    product_type = normalize_product_type(req.product_type)
    inv_key = inventory_key(req.blood, product_type)
    inventory = BloodInventory.objects.select_for_update().filter(blood_type=inv_key).first()
    reserved_ids = list(req.reserved_bag_ids or [])
    qty = max(int(req.qty or 1), 1)

    if reserved_ids and len(reserved_ids) >= qty:
        if not inventory or inventory.reserved < qty:
            reserved = inventory.reserved if inventory else 0
            raise ValueError(f'الأكياس المحجوزة غير كافية. المطلوب {qty} والمحجوز {reserved}.')
        inventory.reserved -= qty
        inventory.issued += qty
        inventory.save(update_fields=['reserved', 'issued'])
        delivered_bag_ids = deliver_reserved_bags(reserved_ids[:qty])
    else:
        if not inventory or inventory.available < qty:
            available = inventory.available if inventory else 0
            raise ValueError(
                f'المخزون غير كافٍ ({get_product_label(product_type)}). '
                f'المطلوب {qty} والمتاح {available}.'
            )
        inventory.available -= qty
        inventory.issued += qty
        inventory.save(update_fields=['available', 'issued'])
        delivered_bag_ids = issue_approved_bags(req.blood, qty, product_type)

    req.status = REQUEST_STATUS_DELIVERED
    req.reserved_bag_ids = []
    req.save(update_fields=['status', 'reserved_bag_ids'])

    HospitalDeliveryRecord.objects.create(
        record_id=req.request_id,
        hospital=req.hospital,
        blood=req.blood,
        product_type=product_type,
        qty=req.qty,
        priority=req.priority,
        recipient=recipient_name,
        recipient_phone=recipient_phone,
        delivery_notes=notes or '',
        delivered_by=delivered_by,
        delivered_at=date.today(),
    )
    bag_note = f' — أكياس: {", ".join(delivered_bag_ids)}' if delivered_bag_ids else ''
    push_audit(
        username,
        role,
        'تسليم طلب مستشفى',
        f'طلب {request_id} — {recipient_name} ({recipient_phone}). الحالة: {REQUEST_STATUS_DELIVERED}.{bag_note}',
    )
    Notification.objects.create(
        title='🚚 تسليم طلب مستشفى',
        notification_type='delivery',
        time=timezone.localtime().strftime('%Y-%m-%d %H:%M'),
        message=(
            f'تم تسليم {req.qty} كيس {req.blood} إلى {req.hospital}'
            f' — المستلم: {recipient_name}.'
        ),
        read=False,
    )
    invalidate_runtime_caches()
    sync_storage_from_bags()
    return req


@transaction.atomic
def approve_request_status(request_id, new_status, username, role):
    req = BloodRequest.objects.select_for_update().filter(request_id=request_id).first()
    if not req:
        raise ValueError('الطلب غير موجود.')
    current_status = _normalize_request_status(req.status)
    new_status = _normalize_request_status(new_status)
    if new_status not in {REQUEST_STATUS_APPROVED, REQUEST_STATUS_REJECTED}:
        raise ValueError('يمكن فقط اعتماد الطلب أو رفضه.')

    if new_status == REQUEST_STATUS_APPROVED:
        if current_status == REQUEST_STATUS_APPROVED:
            return req
        if current_status != REQUEST_STATUS_REVIEW:
            raise ValueError('لا يمكن قبول الطلب في حالته الحالية.')
        reserved_ids = reserve_bags_for_request(req)
        req.status = new_status
        req.save(update_fields=['status'])
        push_audit(
            username,
            role,
            'قبول طلب مستشفى',
            f'طلب {request_id} → {new_status} — محجوز: {", ".join(reserved_ids)}',
        )
        return req

    if current_status == REQUEST_STATUS_APPROVED:
        release_request_reservation(req)
    req.status = new_status
    req.save(update_fields=['status'])
    push_audit(username, role, 'رفض طلب مستشفى', f'طلب {request_id} → {new_status}')
    return req


@transaction.atomic
def save_storage_config(total_rooms, fridges_per_room, shelves_per_fridge, capacity_per_shelf, details=None):
    config = get_storage_config()
    normalized_details = _normalize_storage_details(details, fridges_per_room, shelves_per_fridge)
    _validate_storage_change(config.details, normalized_details)

    existing_by_key = {detail.get('roomKey') or detail.get('room'): detail for detail in config.details or [] if detail.get('room')}
    new_by_key = {detail.get('roomKey') or detail.get('room'): detail for detail in normalized_details or [] if detail.get('room')}
    for room_key in set(existing_by_key) & set(new_by_key):
        old_room = existing_by_key[room_key].get('room')
        new_room = new_by_key[room_key].get('room')
        _update_storage_room_location(old_room, new_room)

    config.total_rooms = total_rooms
    config.total_fridges_per_room = fridges_per_room
    config.total_shelves_per_fridge = shelves_per_fridge
    config.capacity_per_shelf = capacity_per_shelf
    config.details = normalized_details
    config.total_rooms = len(normalized_details)
    config.total_fridges_per_room = max((len(detail.get('fridges', [])) for detail in normalized_details), default=fridges_per_room)
    shelf_counts = [
        int((detail.get('fridgeSettings') or {}).get(fridge_name, {}).get('shelves') or len((detail.get('shelves') or {}).get(fridge_name, []) or []))
        for detail in normalized_details
        for fridge_name in detail.get('fridges', [])
    ]
    config.total_shelves_per_fridge = max(shelf_counts or [shelves_per_fridge], default=shelves_per_fridge)
    config.room_names = [detail['room'] for detail in normalized_details]
    config.save()
    rebuild_storage_rooms(config)
    return config


def system_has_operational_data():
    ensure_blood_inventory()
    totals = BloodInventory.aggregate_totals()
    if totals['available'] > 0 or totals['reserved'] > 0 or totals['issued'] > 0:
        return True
    if BloodRequest.pending_requests().exists():
        return True
    if BloodBag.objects.exclude(status='Rejected').exists():
        return True
    if DisposalLog.objects.exists():
        return True
    if HospitalDeliveryRecord.objects.exists():
        return True
    return False


def compute_operational_summary():
    ensure_blood_inventory()
    totals = BloodInventory.aggregate_totals()
    pending_requests = BloodRequest.pending_requests()
    return {
        'totalAvailable': totals['available'],
        'totalReserved': totals['reserved'],
        'totalIssued': totals['issued'],
        'pendingRequests': pending_requests.count(),
        'pendingRequestUnits': sum(request.qty for request in pending_requests),
        'activeBags': BloodBag.objects.filter(status__in=ACTIVE_BAG_STATUSES).count(),
        'pendingLabBags': BloodBag.objects.filter(status='Pending').count(),
        'disposalRecords': DisposalLog.objects.count(),
    }


def compute_dashboard_stats():
    ensure_blood_inventory()
    totals = BloodInventory.aggregate_totals()
    return {
        'totalAvailableBags': totals['available'],
        'totalDonors': Donor.objects.count(),
        'pendingLabBags': BloodBag.objects.filter(status='Pending').count(),
        'hospitalCount': Hospital.objects.count(),
        'hospitalBloodRequestOrders': BloodRequest.objects.count(),
    }


def _get_blood_output_cleared_at():
    config, _ = SystemMetricsConfig.objects.get_or_create(singleton_key='default')
    return config.blood_output_cleared_at


def compute_blood_output_stats(months=12):
    from calendar import monthrange

    cleared_at = _get_blood_output_cleared_at()
    today = date.today()
    month_start = today.replace(day=1)

    hospital_qs = HospitalDeliveryRecord.objects.all()
    beneficiary_qs = Beneficiary.objects.all()
    if cleared_at:
        hospital_qs = hospital_qs.filter(delivered_at__gte=cleared_at.date())
        beneficiary_qs = beneficiary_qs.filter(created_at__gte=cleared_at)

    current_month_hospital = (
        hospital_qs.filter(delivered_at__gte=month_start).aggregate(total=Sum('qty'))['total'] or 0
    )
    current_month_beneficiary = (
        beneficiary_qs.filter(created_at__date__gte=month_start).aggregate(total=Sum('bags_consumed'))['total'] or 0
    )
    total_hospital = hospital_qs.aggregate(total=Sum('qty'))['total'] or 0
    total_beneficiary = beneficiary_qs.aggregate(total=Sum('bags_consumed'))['total'] or 0

    monthly = []
    year = today.year
    month = today.month
    for offset in range(max(int(months or 12), 1)):
        m = month - offset
        y = year
        while m <= 0:
            m += 12
            y -= 1
        month_begin = date(y, m, 1)
        month_end = date(y, m, monthrange(y, m)[1])
        hospital_units = (
            hospital_qs.filter(delivered_at__gte=month_begin, delivered_at__lte=month_end)
            .aggregate(total=Sum('qty'))['total'] or 0
        )
        beneficiary_units = (
            beneficiary_qs.filter(created_at__date__gte=month_begin, created_at__date__lte=month_end)
            .aggregate(total=Sum('bags_consumed'))['total'] or 0
        )
        monthly.append({
            'month': month_begin.strftime('%Y-%m'),
            'label': month_begin.strftime('%m/%Y'),
            'hospital': int(hospital_units),
            'beneficiary': int(beneficiary_units),
            'total': int(hospital_units) + int(beneficiary_units),
        })
    monthly.reverse()

    recent_deliveries = []
    for record in hospital_qs.order_by('-delivered_at', '-pk')[:20]:
        recent_deliveries.append({
            'source': 'مستشفى',
            'name': record.hospital,
            'blood': record.blood,
            'productType': record.product_type,
            'qty': record.qty,
            'date': record.delivered_at.isoformat() if record.delivered_at else None,
        })
    for record in beneficiary_qs.order_by('-created_at', '-pk')[:20]:
        recent_deliveries.append({
            'source': 'مستفيد',
            'name': record.name,
            'blood': record.blood_type_received,
            'productType': record.product_type_received,
            'qty': record.bags_consumed,
            'date': record.created_at.date().isoformat() if record.created_at else None,
        })
    recent_deliveries.sort(key=lambda item: item.get('date') or '', reverse=True)

    return {
        'currentMonthTotal': int(current_month_hospital + current_month_beneficiary),
        'currentMonthHospital': int(current_month_hospital),
        'currentMonthBeneficiary': int(current_month_beneficiary),
        'totalSinceReset': int(total_hospital + total_beneficiary),
        'totalHospital': int(total_hospital),
        'totalBeneficiary': int(total_beneficiary),
        'monthly': monthly,
        'recentDeliveries': recent_deliveries[:25],
        'clearedAt': cleared_at.isoformat() if cleared_at else None,
    }


@transaction.atomic
def clear_blood_output_stats(username, role):
    config, _ = SystemMetricsConfig.objects.get_or_create(singleton_key='default')
    config.blood_output_cleared_at = timezone.now()
    config.save(update_fields=['blood_output_cleared_at'])
    push_audit(username, role, 'تصفير إحصائيات إخراج الدم', 'تم تصفير عدّاد الأكياس المُخرَجة من النظام.')
    invalidate_runtime_caches()
    return config.blood_output_cleared_at


def analyze_shortage_risks():
    ensure_blood_inventory()
    insights = []
    pending = BloodRequest.pending_requests()

    demand_by_type = {}
    demand_by_hospital_type = {}
    for request in pending:
        demand_by_type[request.blood] = demand_by_type.get(request.blood, 0) + request.qty
        hospital_key = (request.hospital, request.blood)
        demand_by_hospital_type[hospital_key] = (
            demand_by_hospital_type.get(hospital_key, 0) + request.qty
        )

    for blood_type in BLOOD_TYPES:
        inventory = sum_inventory_by_blood_type(blood_type)
        available = inventory['available']
        critical_limit = inventory['critical_limit']
        demand = demand_by_type.get(blood_type, 0)

        if demand > available:
            hospital_breakdown = [
                (hospital, qty)
                for (hospital, blood), qty in demand_by_hospital_type.items()
                if blood == blood_type
            ]
            hospital_breakdown.sort(key=lambda item: -item[1])
            sources = '، '.join(f'{hospital} ({qty} كيس)' for hospital, qty in hospital_breakdown[:3])
            gap = demand - available
            insights.append({
                'type': 'shortage',
                'severity': 'high' if gap > critical_limit else 'medium',
                'bloodType': blood_type,
                'gap': gap,
                'demand': demand,
                'available': available,
                'text': (
                    f'تنبؤ عجز في فصيلة {blood_type} خلال 48 ساعة: الطلب المعلّق {demand} كيس '
                    f'والمتاح {available} كيس (عجز متوقع {gap} كيس).'
                    f'{f" المصادر: {sources}." if sources else ""}'
                ),
            })
        elif available > 0 and available <= critical_limit:
            insights.append({
                'type': 'critical_stock',
                'severity': 'medium',
                'bloodType': blood_type,
                'available': available,
                'criticalLimit': critical_limit,
                'text': (
                    f'فصيلة {blood_type} عند حد الخطر: المتاح {available} كيس '
                    f'(الحد الحرج {critical_limit} كيس).'
                ),
            })

    return insights


def analyze_expiring_bags():
    today = date.today()
    threshold = today + timedelta(days=7)
    expiring = BloodBag.objects.filter(
        status='Approved',
        expiry__lte=threshold,
        expiry__gte=today,
    )
    if not expiring.exists():
        return []

    by_type = {}
    for bag in expiring:
        by_type[bag.blood_type] = by_type.get(bag.blood_type, 0) + bag.qty

    breakdown = '، '.join(f'{blood_type}: {count} كيس' for blood_type, count in sorted(by_type.items()))
    return [{
        'type': 'expiry',
        'severity': 'medium',
        'count': expiring.count(),
        'text': f'تنبيه صلاحية: {expiring.count()} كيس تنتهي خلال 7 أيام ({breakdown}).',
    }]


def analyze_lab_backlog():
    pending_count = BloodBag.objects.filter(status='Pending').count()
    if pending_count <= 0:
        return []

    return [{
        'type': 'lab_backlog',
        'severity': 'high' if pending_count >= 5 else 'medium',
        'count': pending_count,
        'text': (
            f'اختناق معملي: {pending_count} كيس بانتظار نتائج الفحص '
            f'— يؤخر دخولها للمخزون المتاح.'
        ),
    }]


def compute_wastage_rate():
    ensure_blood_inventory()
    inventory_totals = BloodInventory.aggregate_totals()
    disposed_units = DisposalLog.objects.count()

    wasted_units = inventory_totals['expired'] + disposed_units
    total_stock = inventory_totals['total_units'] + disposed_units

    if total_stock == 0 or wasted_units == 0:
        return None

    percentage = round((wasted_units / total_stock) * 100, 2)
    formatted = f'{percentage:.2f}%'

    if percentage <= 1.0:
        level = 'low'
        color = 'success'
        text = f'معدل الهدر العام منخفض جداً بنسبة {formatted} ({wasted_units} من {total_stock} وحدة).'
    elif percentage <= 3.0:
        level = 'moderate'
        color = 'warning'
        text = f'معدل الهدر العام متوسط بنسبة {formatted} ({wasted_units} من {total_stock} وحدة).'
    else:
        level = 'high'
        color = 'danger'
        text = (
            f'معدل الهدر العام مرتفع بنسبة {formatted} ({wasted_units} من {total_stock} وحدة) '
            f'— يُنصح بمراجعة إجراءات التخزين.'
        )

    return {
        'percentage': percentage,
        'formatted': formatted,
        'wastedUnits': wasted_units,
        'totalStock': total_stock,
        'expiredUnits': inventory_totals['expired'],
        'disposedUnits': disposed_units,
        'level': level,
        'color': color,
        'text': text,
    }


INSIGHT_META = {
    'shortage': {'icon': '🚨', 'title': 'عجز متوقع', 'confidence': 92},
    'critical_stock': {'icon': '⚠️', 'title': 'مخزون حرج', 'confidence': 88},
    'expiry': {'icon': '⏰', 'title': 'صلاحية قريبة', 'confidence': 95},
    'lab_backlog': {'icon': '🔬', 'title': 'اختناق معملي', 'confidence': 90},
    'wastage': {'icon': '📉', 'title': 'معدل الهدر', 'confidence': 85},
    'donor_gap': {'icon': '👥', 'title': 'فجوة متبرعين', 'confidence': 78},
    'stable': {'icon': '✅', 'title': 'وضع مستقر', 'confidence': 96},
}

RISK_ORDER = {'shortage': 0, 'critical': 1, 'watch': 2, 'safe': 3}


def compute_weekly_burn_rates():
    today = date.today()
    since = today - timedelta(days=30)
    deliveries = HospitalDeliveryRecord.objects.filter(delivered_at__gte=since)

    by_type = {blood_type: 0 for blood_type in BLOOD_TYPES}
    for delivery in deliveries:
        if delivery.blood in by_type:
            by_type[delivery.blood] += delivery.qty

    weeks = max(1.0, (today - since).days / 7)
    return {blood_type: round(total / weeks, 2) for blood_type, total in by_type.items()}


def compute_consumption_trend():
    today = date.today()
    trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        total = (
            HospitalDeliveryRecord.objects.filter(delivered_at=day).aggregate(total=Sum('qty'))['total']
            or 0
        )
        trend.append({
            'date': day.isoformat(),
            'label': day.strftime('%a'),
            'units': int(total),
        })
    return trend


def compute_blood_forecasts():
    ensure_blood_inventory()
    burn_rates = compute_weekly_burn_rates()
    pending = BloodRequest.pending_requests()

    demand_by_type = {}
    for request in pending:
        demand_by_type[request.blood] = demand_by_type.get(request.blood, 0) + request.qty

    forecasts = []
    for blood_type in BLOOD_TYPES:
        inventory = sum_inventory_by_blood_type(blood_type)
        available = inventory['available']
        reserved = inventory['reserved']
        critical_limit = inventory['critical_limit']
        demand = demand_by_type.get(blood_type, 0)
        weekly_burn = burn_rates.get(blood_type, 0)
        daily_burn = weekly_burn / 7 if weekly_burn > 0 else 0
        net_available = max(0, available - demand)

        if daily_burn > 0:
            days_until_depletion = round(net_available / daily_burn, 1)
        elif available == 0:
            days_until_depletion = 0
        elif available <= critical_limit:
            days_until_depletion = 3
        else:
            days_until_depletion = None

        if demand > available:
            risk_level = 'shortage'
        elif available == 0 or (days_until_depletion is not None and days_until_depletion <= 5):
            risk_level = 'critical'
        elif available <= critical_limit or (
            days_until_depletion is not None and days_until_depletion <= 14
        ):
            risk_level = 'watch'
        else:
            risk_level = 'safe'

        coverage_percent = round(min(100, (available / demand) * 100), 1) if demand > 0 else 100
        stock_percent = round(min(100, (available / max(critical_limit * 2, 1)) * 100), 1)

        forecasts.append({
            'bloodType': blood_type,
            'available': available,
            'reserved': reserved,
            'demand': demand,
            'gap': max(0, demand - available),
            'criticalLimit': critical_limit,
            'weeklyBurn': weekly_burn,
            'daysUntilDepletion': days_until_depletion,
            'riskLevel': risk_level,
            'coveragePercent': coverage_percent,
            'stockPercent': stock_percent,
            'forecast7d': max(0, round(available - weekly_burn, 1)),
            'forecast14d': max(0, round(available - (weekly_burn * 2), 1)),
        })

    forecasts.sort(
        key=lambda item: (
            RISK_ORDER.get(item['riskLevel'], 9),
            -item.get('gap', 0),
            -item.get('demand', 0),
        )
    )
    return forecasts


def analyze_donor_gaps(forecasts):
    donor_counts = {
        row['blood']: row['count']
        for row in Donor.objects.filter(status='Active').values('blood').annotate(count=Count('pk'))
    }
    insights = []
    for forecast in forecasts:
        blood_type = forecast['bloodType']
        donor_count = donor_counts.get(blood_type, 0)
        if forecast['riskLevel'] in ('shortage', 'critical', 'watch') and donor_count < 5:
            insights.append({
                'type': 'donor_gap',
                'severity': 'medium' if donor_count > 0 else 'high',
                'bloodType': blood_type,
                'donorCount': donor_count,
                'text': (
                    f'فجوة متبرعين لفصيلة {blood_type}: {donor_count} متبرع نشط فقط '
                    f'— يُنصح بحملة استهداف فورية.'
                ),
            })
    return insights


def enrich_insight(insight):
    meta = INSIGHT_META.get(insight.get('type'), {'icon': '💡', 'title': 'ملاحظة', 'confidence': 80})
    enriched = dict(insight)
    enriched['icon'] = meta['icon']
    enriched['title'] = meta['title']
    enriched['confidence'] = meta['confidence']
    return enriched


def compute_health_score(forecasts, insights):
    score = 100
    for forecast in forecasts:
        if forecast['riskLevel'] == 'shortage':
            score -= 16
        elif forecast['riskLevel'] == 'critical':
            score -= 9
        elif forecast['riskLevel'] == 'watch':
            score -= 4

    for insight in insights:
        severity = insight.get('severity')
        if severity == 'high':
            score -= 6
        elif severity == 'medium':
            score -= 3

    return max(0, min(100, score))


def health_score_label(score):
    if score >= 85:
        return 'ممتاز'
    if score >= 70:
        return 'جيد'
    if score >= 50:
        return 'يحتاج انتباه'
    return 'حرج'


def compute_ai_kpis(summary, forecasts, wastage, health_score):
    at_risk = sum(
        1 for forecast in forecasts if forecast['riskLevel'] in ('shortage', 'critical')
    )
    watch_count = sum(1 for forecast in forecasts if forecast['riskLevel'] == 'watch')
    coverage_values = [forecast['coveragePercent'] for forecast in forecasts if forecast['demand'] > 0]
    avg_coverage = round(sum(coverage_values) / len(coverage_values), 1) if coverage_values else 100

    return {
        'healthScore': health_score,
        'healthLabel': health_score_label(health_score),
        'bloodTypesAtRisk': at_risk,
        'bloodTypesWatch': watch_count,
        'avgCoverage': avg_coverage,
        'weeklyConsumption': round(sum(forecast['weeklyBurn'] for forecast in forecasts), 1),
        'pendingRequestUnits': summary.get('pendingRequestUnits', 0),
        'wastagePercent': wastage.get('percentage') if wastage else 0,
        'activeDonors': Donor.objects.filter(status='Active').count(),
    }


def build_smart_recommendations(insights, wastage, forecasts=None):
    recommendations = []
    priority = 1

    shortages = sorted(
        [item for item in insights if item['type'] == 'shortage'],
        key=lambda item: -item.get('gap', 0),
    )
    for shortage in shortages:
        gap = shortage.get('gap', 0)
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'shortage',
            'bloodType': shortage.get('bloodType'),
            'impact': 'عالي',
            'timeframe': '48 ساعة',
            'text': (
                f'توريد عاجل لفصيلة {shortage["bloodType"]} — عجز {gap} كيس. '
                f'فعّل حملة SMS/WhatsApp لمتبرعي {shortage["bloodType"]} في أسيوط.'
            ),
        })
        priority += 1

    watch_added = 0
    if forecasts:
        shortage_types = {item.get('bloodType') for item in shortages}
        for forecast in forecasts:
            if watch_added >= 2:
                break
            if forecast['riskLevel'] != 'watch' or forecast['bloodType'] in shortage_types:
                continue
            recommendations.append({
                'priority': priority,
                'active': True,
                'category': 'forecast_watch',
                'bloodType': forecast['bloodType'],
                'impact': 'متوسط',
                'timeframe': '7–14 يوم',
                'text': (
                    f'مراقبة فصيلة {forecast["bloodType"]}: المخزون يكفي تقريباً '
                    f'{forecast["daysUntilDepletion"] or "≤14"} يوماً — خطط لتعزيز وقائي.'
                ),
            })
            priority += 1
            watch_added += 1

    for critical in [item for item in insights if item['type'] == 'critical_stock']:
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'critical_stock',
            'bloodType': critical.get('bloodType'),
            'impact': 'عالي',
            'timeframe': '72 ساعة',
            'text': (
                f'تعزيز مخزون {critical["bloodType"]} قبل بلوغ مستوى العجز الحرج '
                f'(المتاح حالياً {critical.get("available", 0)} كيس).'
            ),
        })
        priority += 1

    for donor_gap in [item for item in insights if item['type'] == 'donor_gap']:
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'donor_gap',
            'bloodType': donor_gap.get('bloodType'),
            'impact': 'متوسط',
            'timeframe': 'أسبوع',
            'text': (
                f'توسيع قاعدة متبرعي {donor_gap["bloodType"]} — '
                f'المسجّلون النشطون: {donor_gap.get("donorCount", 0)} فقط.'
            ),
        })
        priority += 1

    if any(item['type'] == 'expiry' for item in insights):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'expiry',
            'impact': 'متوسط',
            'timeframe': '7 أيام',
            'text': 'صرف الأكياس قرب انتهاء الصلاحية أولاً (FIFO) لتقليل الهدر.',
        })
        priority += 1

    if any(item['type'] == 'lab_backlog' for item in insights):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'lab_backlog',
            'impact': 'عالي',
            'timeframe': '24 ساعة',
            'text': 'تسريع الفحص المعملي للأكياس المعلّقة لإتاحتها للتسليم.',
        })
        priority += 1

    if wastage and wastage.get('level') in ('moderate', 'high'):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'wastage',
            'impact': 'متوسط',
            'timeframe': 'مستمر',
            'text': 'مراجعة ظروف التخزين وسلسلة التبريد — معدل الهدر يتجاوز المستوى المقبول.',
        })
        priority += 1

    urgent_types = {item['type'] for item in insights if item['type'] != 'stable'}
    if not recommendations:
        recommendations.append({
            'priority': 1,
            'active': False,
            'category': 'monitoring',
            'impact': 'منخفض',
            'timeframe': 'يومي',
            'text': 'الوضع المخزوني مستقر — استمر في المراقبة الدورية وتحديث التوقعات.',
        })

    return recommendations


def build_ai_predictions_payload():
    summary = compute_operational_summary()
    if not system_has_operational_data():
        return {
            'hasData': False,
            'modelStatus': 'waiting',
            'modelStatusText': 'في انتظار البيانات التشغيلية',
            'statusMessage': (
                'النظام جاهز. سيُفعَّل التحليل الذكي تلقائياً عند إضافة تبرعات أو طلبات أو مخزون.'
            ),
            'insights': [],
            'recommendations': [],
            'wastageRate': None,
            'summary': summary,
            'healthScore': None,
            'kpis': None,
            'forecasts': [],
            'consumptionTrend': [],
            'generatedAt': timezone.now().isoformat(),
        }

    forecasts = compute_blood_forecasts()
    insights = []
    insights.extend(analyze_shortage_risks())
    insights.extend(analyze_expiring_bags())
    insights.extend(analyze_lab_backlog())
    insights.extend(analyze_donor_gaps(forecasts))

    wastage = compute_wastage_rate()
    if wastage:
        insights.append({
            'type': 'wastage',
            'severity': wastage['level'],
            'text': wastage['text'],
        })

    if not insights:
        insights.append({
            'type': 'stable',
            'severity': 'low',
            'text': (
                'لا توجد مخاطر عاجلة — جميع الفصائل ضمن المستويات الآمنة '
                'والطلبات المعلّقة مغطاة بالمخزون.'
            ),
        })

    insights = [enrich_insight(item) for item in insights]
    health_score = compute_health_score(forecasts, insights)
    kpis = compute_ai_kpis(summary, forecasts, wastage, health_score)
    recommendations = build_smart_recommendations(insights, wastage, forecasts)

    return {
        'hasData': True,
        'modelStatus': 'active',
        'modelStatusText': 'نموذج التنبؤ الذكي نشط',
        'insights': insights,
        'recommendations': recommendations,
        'wastageRate': wastage,
        'summary': summary,
        'healthScore': health_score,
        'kpis': kpis,
        'forecasts': forecasts,
        'consumptionTrend': compute_consumption_trend(),
        'generatedAt': timezone.now().isoformat(),
    }


def verify_account_password(account, raw_password):
    from django.contrib.auth.hashers import check_password

    if not account or not raw_password:
        return False
    return check_password(raw_password, account.password)


@transaction.atomic
def clear_all_notifications(username, role):
    from .models import Notification

    count = Notification.objects.count()
    Notification.objects.all().delete()
    push_audit(username, role, 'مسح الإشعارات', f'تم حذف {count} إشعار من النظام.')
    return count


@transaction.atomic
def clear_all_audit_logs(username, role):
    audit_count = AuditLog.objects.count()
    disposal_count = DisposalLog.objects.count()
    AuditLog.objects.all().delete()
    DisposalLog.objects.all().delete()
    return audit_count + disposal_count


@transaction.atomic
def clear_all_messages(username, role):
    from .models import Message

    count = Message.objects.count()
    Message.objects.all().delete()
    push_audit(username, role, 'مسح الرسائل', f'تم حذف {count} رسالة من النظام.')
    return count
