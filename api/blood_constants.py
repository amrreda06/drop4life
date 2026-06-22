"""ثوابت فصائل الدم ومكوناته (كرات / بلازما / صفائح) ومواعيد الصلاحية."""
from datetime import date, timedelta

BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

PRODUCT_TYPE_RBC = 'RBC'
PRODUCT_TYPE_PLASMA = 'Plasma'
PRODUCT_TYPE_PLATELETS = 'Platelets'
PRODUCT_TYPE_WHOLE = 'Whole'

PRODUCT_TYPES = [PRODUCT_TYPE_RBC, PRODUCT_TYPE_PLASMA, PRODUCT_TYPE_PLATELETS]
INVENTORY_PRODUCT_TYPES = PRODUCT_TYPES

PRODUCT_TYPE_LABELS = {
    PRODUCT_TYPE_WHOLE: 'وحدة دم كاملة',
    PRODUCT_TYPE_RBC: 'كرات دم حمراء',
    PRODUCT_TYPE_PLASMA: 'بلازما',
    PRODUCT_TYPE_PLATELETS: 'صفائح دموية',
}

PRODUCT_EXPIRY_DAYS = {
    PRODUCT_TYPE_RBC: 42,
    PRODUCT_TYPE_PLASMA: 365,
    PRODUCT_TYPE_PLATELETS: 5,
}

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

PENDING_BLOOD_TYPE = 'Unknown'
UNKNOWN_DONOR_NAME = 'Unknown'


def normalize_product_type(value):
    raw = str(value or PRODUCT_TYPE_RBC).strip()
    aliases = {
        'whole': PRODUCT_TYPE_WHOLE,
        'whole blood': PRODUCT_TYPE_WHOLE,
        'وحدة كاملة': PRODUCT_TYPE_WHOLE,
        'وحدة دم كاملة': PRODUCT_TYPE_WHOLE,
        'rbc': PRODUCT_TYPE_RBC,
        'red': PRODUCT_TYPE_RBC,
        'red cells': PRODUCT_TYPE_RBC,
        'whole blood': PRODUCT_TYPE_RBC,
        'plasma': PRODUCT_TYPE_PLASMA,
        'platelets': PRODUCT_TYPE_PLATELETS,
        'platelet': PRODUCT_TYPE_PLATELETS,
        'كرات': PRODUCT_TYPE_RBC,
        'كرات دم حمراء': PRODUCT_TYPE_RBC,
        'بلازما': PRODUCT_TYPE_PLASMA,
        'صفائح': PRODUCT_TYPE_PLATELETS,
        'صفائح دموية': PRODUCT_TYPE_PLATELETS,
    }
    if raw in PRODUCT_TYPES or raw == PRODUCT_TYPE_WHOLE:
        return raw
    return aliases.get(raw.lower(), PRODUCT_TYPE_RBC)


def get_product_label(product_type):
    return PRODUCT_TYPE_LABELS.get(normalize_product_type(product_type), product_type)


def inventory_key(blood_type, product_type=PRODUCT_TYPE_RBC):
    return f'{blood_type}|{normalize_product_type(product_type)}'


def parse_inventory_key(key):
    raw = str(key or '').strip()
    if '|' in raw:
        blood_type, product_type = raw.split('|', 1)
        return blood_type.strip(), normalize_product_type(product_type)
    return raw, PRODUCT_TYPE_RBC


def validate_blood_type(value, *, required=True):
    blood_type = str(value or '').strip()
    if not blood_type:
        if required:
            raise ValueError('يجب على المعمل اختيار وتأكيد فصيلة الدم.')
        return blood_type
    if blood_type in (PENDING_BLOOD_TYPE, 'غير محدد', 'Unknown', '---'):
        raise ValueError('يجب على المعمل تحديد فصيلة الدم — لا يُقبل "غير محدد".')
    if blood_type not in BLOOD_TYPES:
        raise ValueError(f'فصيلة الدم "{blood_type}" غير صالحة.')
    return blood_type


def compute_expiry_date(product_type, from_date=None):
    start = from_date or date.today()
    days = PRODUCT_EXPIRY_DAYS.get(normalize_product_type(product_type), 42)
    return start + timedelta(days=days)


def build_inventory_payload():
    """هيكل مخزون متداخل: { 'A+': { 'RBC': {...}, ... }, ... }"""
    from .models import BloodInventory

    payload = {}
    for item in BloodInventory.objects.all():
        blood_type, product_type = parse_inventory_key(item.blood_type)
        payload.setdefault(blood_type, {})
        payload[blood_type][product_type] = {
            'available': item.available,
            'reserved': item.reserved,
            'issued': item.issued,
            'expired': item.expired,
            'criticalLimit': item.critical_limit,
        }
    for bt in BLOOD_TYPES:
        payload.setdefault(bt, {})
        for pt in PRODUCT_TYPES:
            payload[bt].setdefault(
                pt,
                {
                    'available': 0,
                    'reserved': 0,
                    'issued': 0,
                    'expired': 0,
                    'criticalLimit': DEFAULT_CRITICAL_LIMITS.get(bt, 20),
                },
            )
    return payload
