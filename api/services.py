from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from .models import (
    AI_PENDING_REQUEST_STATUSES,
    Account,
    AuditLog,
    BloodBag,
    BloodInventory,
    BloodRequest,
    DisposalLog,
    HospitalDeliveryRecord,
    PendingDonor,
    StorageConfig,
    StorageFridge,
    StorageRoom,
)

BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

DEFAULT_CRITICAL_LIMITS = {
    'A+': 30,
    'A-': 15,
    'B+': 25,
    'B-': 15,
    'AB+': 20,
    'AB-': 10,
    'O+': 40,
    'O-': 25,
}


def push_audit(user, role, action, details):
    now = timezone.localtime()
    time_str = now.strftime('%Y-%m-%d %H:%M')
    return AuditLog.objects.create(
        time=time_str,
        user=user or 'system',
        role=role or 'System',
        action=action,
        details=details,
    )


def ensure_blood_inventory():
    for blood_type in BLOOD_TYPES:
        BloodInventory.objects.get_or_create(
            blood_type=blood_type,
            defaults={
                'available': 0,
                'reserved': 0,
                'issued': 0,
                'expired': 0,
                'critical_limit': DEFAULT_CRITICAL_LIMITS[blood_type],
            },
        )


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
    Account.objects.exclude(username=SUPERADMIN_USERNAME).delete()

    ensure_blood_inventory()
    BloodInventory.objects.all().update(
        available=0,
        reserved=0,
        issued=0,
        expired=0,
    )

    config = get_storage_config()
    if not config.details:
        config.total_rooms = 3
        config.total_fridges_per_room = 2
        config.total_shelves_per_fridge = 4
        config.capacity_per_shelf = 100
        config.room_names = ['Room A', 'Room B', 'Room C']
        config.details = default_storage_details(3, 2, 4)
        config.save()
    rebuild_storage_rooms(config)
    Session.objects.all().delete()


def get_storage_config():
    config, _ = StorageConfig.objects.get_or_create(pk='default')
    return config


def rebuild_storage_rooms(config):
    StorageFridge.objects.all().delete()
    StorageRoom.objects.all().delete()
    for detail in config.details:
        room_name = detail['room']
        room = StorageRoom.objects.create(room=room_name, used=0, capacity=100)
        for fridge_name in detail.get('fridges', []):
            StorageFridge.objects.create(room=room, fridge_id=fridge_name, used=0)


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


def ensure_default_superadmin():
    from django.contrib.auth.hashers import make_password

    if Account.objects.filter(username=SUPERADMIN_USERNAME).exists():
        return

    Account.objects.create(
        username=SUPERADMIN_USERNAME,
        name='مدير النظام',
        role='superadmin',
        email='admin@drop4life.org',
        password=make_password(DEFAULT_SUPERADMIN_PASSWORD),
        status='active',
    )


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
            email='admin@drop4life.org',
            password=make_password(superadmin_password),
            status='active',
        )
        push_audit('system', 'Engine', 'تهيئة النظام', 'تم إنشاء حساب superadmin الافتراضي.')


def _generate_bag_id():
    import random

    for _ in range(50):
        bag_id = f'BAG-{random.randint(1000, 9999)}'
        if not BloodBag.objects.filter(bag_id=bag_id).exists():
            return bag_id
    raise ValueError('تعذر إنشاء رقم كيس فريد.')


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
    prefix = f'{room_name} / {fridge_name} / {shelf_name}'
    return BloodBag.objects.filter(location__icontains=prefix).count()


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


@transaction.atomic
def add_donation_bags(blood_type, qty, room_name, fridge_name, shelf_name, username, role):
    config = get_storage_config()
    shelf_used = get_shelf_used_count(room_name, fridge_name, shelf_name)
    if shelf_used + qty > config.capacity_per_shelf:
        raise ValueError('هذا الرف لا يتسع لهذه الكمية.')
    room = StorageRoom.objects.filter(room=room_name).select_related().first()
    fridge = StorageFridge.objects.filter(room=room, fridge_id=fridge_name).first() if room else None
    if not fridge:
        raise ValueError('موقع التخزين غير صالح.')
    fridge_capacity = config.capacity_per_shelf * config.total_shelves_per_fridge
    if fridge.used + qty > fridge_capacity:
        raise ValueError('الثلاجة لا تتسع لهذه الكمية.')

    today = date.today()
    expiry = today + timedelta(days=42)
    location = f'{room_name} / {fridge_name} / {shelf_name}'
    created = []
    for _ in range(qty):
        bag = BloodBag.objects.create(
            bag_id=_generate_bag_id(),
            donor='مجهول',
            blood_type=blood_type or 'Unknown',
            qty=1,
            date=today,
            expiry=expiry,
            location=location,
            status='Pending',
        )
        created.append(bag)
    _update_fridge_usage(room_name, fridge_name, qty)
    push_audit(username, role, 'إضافة أكياس تبرع', f'تم إضافة {qty} أكياس وإرسالها للمعمل.')
    return created


@transaction.atomic
def add_donation_donor(name, national_id, age, phone, address, known_blood, room_name, fridge_name, username, role):
    config = get_storage_config()
    room = StorageRoom.objects.filter(room=room_name).first()
    fridge = StorageFridge.objects.filter(room=room, fridge_id=fridge_name).first() if room else None
    if not fridge:
        raise ValueError('موقع التخزين غير صالح.')
    fridge_capacity = config.capacity_per_shelf * config.total_shelves_per_fridge
    if fridge.used >= fridge_capacity:
        raise ValueError('الثلاجة ممتلئة.')

    today = date.today()
    expiry = today + timedelta(days=42)
    location = f'{room_name} / {fridge_name}'
    existing = Donor.objects.filter(national_id=national_id).first()
    if not existing and phone:
        existing = Donor.objects.filter(phone=phone).first()

    bag_id = _generate_bag_id()
    if existing:
        BloodBag.objects.create(
            bag_id=bag_id,
            donor=existing.name,
            blood_type=known_blood or existing.blood or 'Unknown',
            qty=1,
            date=today,
            expiry=expiry,
            location=location,
            status='Pending',
        )
        existing.total_count += 1
        existing.last_date = today
        existing.save(update_fields=['total_count', 'last_date'])
        _update_fridge_usage(room_name, fridge_name, 1)
        push_audit(username, role, 'إضافة تبرع لمتبرع موجود', f'كيس {bag_id} للمتبرع {existing.name}.')
        return bag_id

    BloodBag.objects.create(
        bag_id=bag_id,
        donor=name,
        blood_type=known_blood or 'Unknown',
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
    _update_fridge_usage(room_name, fridge_name, 1)
    push_audit(username, role, 'تسجيل متبرع مؤقت', f'متبرع {name} — عينة {bag_id}.')
    return bag_id


@transaction.atomic
def submit_lab_result(bag_id, decision, final_type, reason, user_name, username, role):
    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    if not bag:
        raise ValueError('الكيس غير موجود.')

    bag.status = decision
    bag.blood_type = final_type
    today = date.today()

    if decision == 'Approved':
        inventory, _ = BloodInventory.objects.get_or_create(
            blood_type=final_type,
            defaults={'critical_limit': DEFAULT_CRITICAL_LIMITS.get(final_type, 20)},
        )
        inventory.available += 1
        inventory.save(update_fields=['available'])
        if not bag.location.startswith('تخزين رئيسي:'):
            bag.location = f'تخزين رئيسي: {bag.location}'
        bag.save()

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
        push_audit(username, role, 'اعتماد معملي ناجح', f'كيس {bag_id} — {final_type}.')
        return bag

    bag.save()
    DisposalLog.objects.create(
        bag_code=bag_id,
        disposal_type='كيس كامل مشتق',
        blood=final_type,
        date=today,
        reason=reason or 'فشل في أحد الاختبارات الفيروسية',
        worker=user_name,
    )
    push_audit(username, role, 'استبعاد معملي وتوجيه اتلاف', f'كيس {bag_id}: {reason}')
    return bag


@transaction.atomic
def dispose_bag(bag_id, disposal_type, blood, reason, worker, username, role):
    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    DisposalLog.objects.create(
        bag_code=bag_id,
        disposal_type=disposal_type,
        blood=blood or (bag.blood_type if bag else 'Unknown'),
        date=date.today(),
        reason=reason,
        worker=worker,
    )
    if bag:
        bag.status = 'Rejected'
        bag.save(update_fields=['status'])
    push_audit(username, role, 'تسجيل تخلص', f'كيس {bag_id}: {reason}')
    return True


@transaction.atomic
def deliver_request(request_id, recipient_name, recipient_phone, notes, delivered_by, username, role):
    req = BloodRequest.objects.filter(request_id=request_id).first()
    if not req:
        raise ValueError('الطلب غير موجود.')
    if req.status == 'Completed':
        raise ValueError('الطلب مُسلّم مسبقاً.')

    inventory = BloodInventory.objects.filter(blood_type=req.blood).first()
    if not inventory or inventory.available < req.qty:
        available = inventory.available if inventory else 0
        raise ValueError(f'المخزون غير كافٍ. المطلوب {req.qty} والمتاح {available}.')

    inventory.available -= req.qty
    inventory.issued += req.qty
    inventory.save(update_fields=['available', 'issued'])
    req.status = 'Completed'
    req.save(update_fields=['status'])

    HospitalDeliveryRecord.objects.create(
        record_id=req.request_id,
        hospital=req.hospital,
        blood=req.blood,
        qty=req.qty,
        priority=req.priority,
        recipient=recipient_name,
        recipient_phone=recipient_phone,
        delivery_notes=notes or '',
        delivered_by=delivered_by,
        delivered_at=date.today(),
    )
    push_audit(
        username,
        role,
        'تسليم طلب مستشفى',
        f'طلب {request_id} — {recipient_name} ({recipient_phone}).',
    )
    return req


@transaction.atomic
def approve_request_status(request_id, new_status, username, role):
    req = BloodRequest.objects.filter(request_id=request_id).first()
    if not req:
        raise ValueError('الطلب غير موجود.')
    req.status = new_status
    req.save(update_fields=['status'])
    push_audit(username, role, 'تحديث حالة طلب', f'طلب {request_id} → {new_status}')
    return req


@transaction.atomic
def save_storage_config(total_rooms, fridges_per_room, shelves_per_fridge, capacity_per_shelf):
    config = get_storage_config()
    config.total_rooms = total_rooms
    config.total_fridges_per_room = fridges_per_room
    config.total_shelves_per_fridge = shelves_per_fridge
    config.capacity_per_shelf = capacity_per_shelf
    config.details = default_storage_details(total_rooms, fridges_per_room, shelves_per_fridge)
    config.room_names = [d['room'] for d in config.details]
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
        'activeBags': BloodBag.objects.exclude(status='Rejected').count(),
        'pendingLabBags': BloodBag.objects.filter(status='Pending').count(),
        'disposalRecords': DisposalLog.objects.count(),
    }


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
        inventory = BloodInventory.objects.filter(blood_type=blood_type).first()
        available = inventory.available if inventory else 0
        critical_limit = (
            inventory.critical_limit if inventory else DEFAULT_CRITICAL_LIMITS[blood_type]
        )
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


def build_smart_recommendations(insights, wastage):
    recommendations = []
    priority = 1

    shortages = sorted(
        [item for item in insights if item['type'] == 'shortage'],
        key=lambda item: -item.get('gap', 0),
    )
    for shortage in shortages:
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'shortage',
            'bloodType': shortage.get('bloodType'),
            'text': (
                f'أولوية عاجلة: توريد فصيلة {shortage["bloodType"]} — '
                f'استهداف متبرعي {shortage["bloodType"]} في المناطق الحيوية بأسيوط.'
            ),
        })
        priority += 1

    for critical in [item for item in insights if item['type'] == 'critical_stock']:
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'critical_stock',
            'bloodType': critical.get('bloodType'),
            'text': (
                f'تعزيز مخزون {critical["bloodType"]} قبل بلوغ مستوى العجز الحرج '
                f'(المتاح حالياً {critical.get("available", 0)} كيس).'
            ),
        })
        priority += 1

    if any(item['type'] == 'expiry' for item in insights):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'expiry',
            'text': 'صرف الأكياس قرب انتهاء الصلاحية أولاً (FIFO) لتقليل الهدر.',
        })
        priority += 1

    if any(item['type'] == 'lab_backlog' for item in insights):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'lab_backlog',
            'text': 'تسريع الفحص المعملي للأكياس المعلّقة لإتاحتها للتسليم.',
        })
        priority += 1

    if wastage and wastage.get('level') in ('moderate', 'high'):
        recommendations.append({
            'priority': priority,
            'active': True,
            'category': 'wastage',
            'text': 'مراجعة ظروف التخزين وسلسلة التبريد — معدل الهدر يتجاوز المستوى المقبول.',
        })
        priority += 1

    urgent_types = {item['type'] for item in insights if item['type'] != 'stable'}
    if not recommendations and urgent_types:
        recommendations.append({
            'priority': 1,
            'active': False,
            'category': 'monitoring',
            'text': 'الوضع المخزوني مستقر حالياً — استمر في المراقبة الدورية.',
        })

    return recommendations


def build_ai_predictions_payload():
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
            'summary': compute_operational_summary(),
        }

    insights = []
    insights.extend(analyze_shortage_risks())
    insights.extend(analyze_expiring_bags())
    insights.extend(analyze_lab_backlog())

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

    recommendations = build_smart_recommendations(insights, wastage)

    return {
        'hasData': True,
        'modelStatus': 'active',
        'modelStatusText': 'نموذج الاستهلاك الذكي نشط',
        'insights': insights,
        'recommendations': recommendations,
        'wastageRate': wastage,
        'summary': compute_operational_summary(),
    }
