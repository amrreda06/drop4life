# 🚀 مرجع سريع: Q&A والتعاريف

## ❓ الأسئلة المطروحة والإجابات

### 1️⃣ ماهي signals أو operations موجودة عند حذف BloodBag؟

#### الإجابة:
```python
# ✅ عند حذف BloodBag:

1. OneToOne Cascade Delete
   └─> PendingDonor.objects.filter(bag_id=bag_id).delete()
       (لأن PendingDonor.bag له on_delete=CASCADE)

2. Audit Signal
   └─> @receiver(post_delete, sender=BloodBag)
       _log_delete() في audit_signals.py
       تسجيل: "حذف BloodBag {bag_id}"

# ❌ ما لا يحدث:
   └─> استعادة الأكياس من BloodInventory (مشكلة!)
```

**الملفات:**
- `models.py#L95-110` - PendingDonor OneToOne
- `audit_signals.py#L156` - post_delete signal

---

### 2️⃣ كيف يتم ربط BloodBag بـ BloodInventory (التحديث، الحذف)؟

#### الإجابة:
```python
# 🔗 الربط من خلال blood_type (String Matching)

BloodBag.blood_type = 'A+'
BloodInventory.blood_type = 'A+'  # المفتاح الأساسي

# ✅ نقاط التحديث:
1. عند اعتماد الكيس من المعمل (Approved)
   └─> inventory.available += 1

2. عند تسليم طلب مستشفى
   └─> inventory.available -= qty
       inventory.issued += qty

3. عند إنشاء Beneficiary
   └─> inventory.available -= qty
       inventory.issued += qty

# ❌ نقاط عدم التحديث:
1. عند إضافة BloodBag (Pending)
   └─> لا يوجد تأثير (في انتظار اعتماد المعمل)

2. عند حذف BloodBag
   └─> لا يوجد استعادة (مشكلة!)

3. عند رفض Bag من المعمل
   └─> لا يوجد تأثير (لم يُضف في الأساس)
```

**الملفات:**
- `services.py#L363-410` - submit_lab_result()
- `services.py#L412-428` - deliver_request()
- `serializers.py#BeneficiarySerializer.create()` - البحث عن "inv.available"

---

### 3️⃣ هل يوجد تتبع للصلاحية (expiry) في BloodBag؟

#### الإجابة:
```python
# ✅ تتبع الصلاحية موجود في BloodBag:
expiry = DateField(db_index=True)

# الصلاحية الافتراضية:
expiry = today + timedelta(days=42)  # 42 يوم من التبرع

# ✅ يمكن البحث والترتيب:
BloodBag.objects.filter(expiry__lt=today)  # أكياس منتهية الصلاحية
BloodBag.objects.order_by('expiry')        # ترتيب حسب الصلاحية

# ❌ لكن:
# 1. لا يوجد تحديث تلقائي لـ BloodInventory.expired
# 2. لا يوجد Signal يراقب انتهاء الصلاحية
# 3. لا يوجد validation عند الإصدار (لا يفحص إذا كان الكيس منتهي)

# 💡 الحل المقترح:
def mark_expired_bags_as_expired():
    """معالجة دورية لتحديث الأكياس منتهية الصلاحية"""
    from datetime import date
    today = date.today()
    
    expired = BloodBag.objects.filter(
        expiry__lt=today,
        status='Approved'
    )
    for bag in expired:
        inv = BloodInventory.objects.get(blood_type=bag.blood_type)
        inv.available = max(0, inv.available - 1)
        inv.expired += 1
        inv.save()
        
        bag.status = 'Expired'
        bag.save()

# celery task أو APScheduler job
```

**الملفات:**
- `models.py#L80-92` - BloodBag.expiry
- `services.py#L310-361` - عند الإضافة: `expiry = today + timedelta(days=42)`

---

### 4️⃣ كيف يتم ربط Beneficiary بـ BloodInventory؟

#### الإجابة:
```python
# 🔗 الربط من خلال blood_type_received (String Matching)

Beneficiary.blood_type_received = 'B+'
BloodInventory.blood_type = 'B+'  # المفتاح الأساسي

# ❌ لا توجد ForeignKey صريحة (فقط String Matching)

# ✅ نقاط التحديث:
1. إنشاء Beneficiary
   └─> inventory.available -= qty
       inventory.issued += qty

2. تعديل Beneficiary (زيادة qty)
   └─> inventory.available -= delta
       inventory.issued += delta

3. تعديل Beneficiary (تقليل qty)
   └─> inventory.available += delta
       inventory.issued -= delta

4. تغيير فصيلة في Beneficiary
   └─> استعادة الفصيلة القديمة
       خصم من الفصيلة الجديدة

5. حذف Beneficiary
   └─> inventory.available += qty
       inventory.issued -= qty
       (هذا SIGNAL مهم!)

# ✅ الحماية:
- استخدام transaction.atomic()
- استخدام select_for_update() لـ Lock
- التحقق من توفر الأكياس قبل الخصم
```

**الملفات:**
- `models.py#L262-280` - Beneficiary Model
- `serializers.py#BeneficiarySerializer` - Lines ~540-620
- `models.py#L295-304` - restore_inventory_on_beneficiary_delete Signal

---

### 5️⃣ ماهي كل العمليات التي تؤثر على الكميات؟

#### الإجابة - جدول شامل:

| # | العملية | الملف | الدالة | available | reserved | issued | expired |
|---|--------|------|--------|-----------|----------|--------|---------|
| 1 | إضافة Bag (Pending) | services.py | add_donation_bags() | - | - | - | - |
| 2 | اعتماد Bag (Approved) | services.py | submit_lab_result() | +1 | - | - | - |
| 3 | رفض Bag | services.py | submit_lab_result() | - | - | - | - |
| 4 | تسليم طلب مستشفى | services.py | deliver_request() | -qty | - | +qty | - |
| 5 | إنشاء Beneficiary | serializers.py | BeneficiarySerializer.create() | -qty | - | +qty | - |
| 6 | تعديل Beneficiary (+) | serializers.py | BeneficiarySerializer.update() | -delta | - | +delta | - |
| 7 | تعديل Beneficiary (-) | serializers.py | BeneficiarySerializer.update() | +delta | - | -delta | - |
| 8 | تغيير فصيلة Beneficiary | serializers.py | BeneficiarySerializer.update() | (complex) | - | (complex) | - |
| 9 | حذف Beneficiary | models.py | restore_inventory_on_beneficiary_delete() | +qty | - | -qty | - |
| 10 | حذف Bag ❌ | views.py | BloodBagViewSet | - | - | - | - |
| 11 | تحديث manual | - | - | ✏️ | ✏️ | ✏️ | ✏️ |

---

## 📚 التعاريف والمصطلحات

### BloodBag
```
تمثيل فعلي لكيس دم واحد
الحقول:
  - bag_id: معرّف فريد (BAG-1234)
  - blood_type: فصيلة الدم (A+, B-, إلخ)
  - status: حالة الكيس (Pending, Approved, Rejected)
  - expiry: تاريخ انتهاء الصلاحية
  - qty: الكمية (عادة 1)
  - location: موقع التخزين
  
الحالات:
  - Pending: في المعمل (قبل النتيجة)
  - Approved: معتمد وفي المخزون
  - Rejected: مرفوض أو ملقى
```

### BloodInventory
```
تتبع مجموع الأكياس لفصيلة دم معينة
المفتاح الأساسي: blood_type (A+, B-, O+, إلخ)

الحقول:
  - available: أكياس جاهزة للإصدار (لم تُصدّر بعد)
  - reserved: أكياس محجوزة (❌ غير مستخدمة حالياً)
  - issued: أكياس مصدّرة (للمستشفيات + Beneficiaries)
  - expired: أكياس منتهية الصلاحية (❌ لا تُحدّث تلقائياً)
  - critical_limit: حد الخطر (للتنبيهات)

المجموع:
  total = available + reserved + issued + expired
```

### Beneficiary
```
متلقي الدم (المريض أو المتبرع له)
الربط مع BloodInventory عبر blood_type_received

الحقول:
  - blood_type_received: الفصيلة المستهلكة
  - bags_consumed: عدد الأكياس المستهلكة
  - created_at: تاريخ التسجيل
  
عند الحذف:
  - استعادة الأكياس إلى BloodInventory (Signal)
```

### PendingDonor
```
بيانات متبرع مؤقتة (عند التبرع الأول)
OneToOne مع BloodBag (on_delete=CASCADE)

ينتقل إلى:
  - Donor (متبرع دائم) عند اعتماد الكيس من المعمل
  - يُحذف إذا رُفض الكيس
```

### DisposalLog
```
سجل التخلص من الأكياس
يُسجّل عند:
  - رفض الكيس من المعمل
  - إلقاء كيس يدويّاً
  - أي سبب آخر للتخلص
```

### HospitalDeliveryRecord
```
سجل تسليم الأكياس للمستشفيات
ينشأ تلقائياً عند:
  - تسليم طلب مستشفى
  - تحديث available و issued في BloodInventory
```

---

## 🔑 المعاملات الحرجة (Critical Transactions)

### 1. إنشاء Beneficiary
```python
@transaction.atomic
def create():
    inv = select_for_update().get(blood_type=...)
    if inv.available < qty:
        raise ValidationError()
    inv.available -= qty
    inv.issued += qty
    inv.save()
    Beneficiary.create()
```

### 2. تعديل Beneficiary
```python
@transaction.atomic
def update():
    if old_blood != new_blood:
        # 2 inventory entries
        inv_old.available += qty
        inv_new.available -= qty
    else:
        # 1 inventory entry
        delta = new_qty - old_qty
        inv.available += (-delta)
```

### 3. تسليم طلب مستشفى
```python
@transaction.atomic
def deliver_request():
    inv = BloodInventory.get(blood_type=...)
    if inv.available < qty:
        raise ValueError()
    inv.available -= qty
    inv.issued += qty
    inv.save()
```

---

## 🎯 الحالات الخاصة والمشاكل

### مشكلة 1: حذف BloodBag لا يستعيد الأكياس
```python
# ❌ المشكلة:
bag = BloodBag.objects.get(bag_id='BAG-1234')
# bag.status = 'Approved'
# bag.blood_type = 'A+'
bag.delete()  # Inventory لم يتحدث!

# ✅ الحل:
@receiver(post_delete, sender=BloodBag)
def restore_on_bag_delete(sender, instance, **kwargs):
    if instance.status == 'Approved':
        inv = BloodInventory.get(blood_type=instance.blood_type)
        inv.available -= 1
        inv.save()
```

### مشكلة 2: انتهاء الصلاحية لا يُعالج تلقائياً
```python
# ❌ المشكلة:
# الكيس ينتهي بتاريخ 2026-07-20
# لا يوجد تحديث تلقائي للـ expired

# ✅ الحل:
# Celery task أو APScheduler
def mark_expired_daily():
    from datetime import date
    today = date.today()
    for bag in BloodBag.objects.filter(expiry__lt=today, status='Approved'):
        inv = BloodInventory.get(blood_type=bag.blood_type)
        inv.available -= 1
        inv.expired += 1
        inv.save()
```

### مشكلة 3: حقل reserved غير مستخدم
```python
# ❌ المشكلة:
# reserved موجود لكن لا يُستخدم في أي عملية
# يبقى دائماً = 0

# 💡 الاستخدام المقترح:
# عند إنشاء طلب مستشفى (قبل التسليم):
#   reserved += qty
# عند تسليم الطلب:
#   reserved -= qty
#   issued += qty
```

---

## 🚨 القائمة البيضاء للحقول المتغيرة

### BloodInventory - يمكن تغيير:
- ✏️ available (بواسطة Beneficiary, requests, etc.)
- ✏️ reserved (يجب استخدامه مستقبلاً)
- ✏️ issued (تحديث عند الاستخدام)
- ✏️ expired (يجب معالجة آلية)
- ✏️ critical_limit (من قبل superadmin)

### BloodBag - يمكن تغيير:
- ✏️ status (من Pending → Approved/Rejected)
- ✏️ blood_type (عند اعتماد الكيس)
- ✏️ location (عند الاعتماد)
- ❌ bag_id (لا يجب تغييره بعد الإنشاء)
- ❌ expiry (لا يجب تغييره بعد الإنشاء)

### Beneficiary - يمكن تغيير:
- ✏️ bags_consumed (مع تحديث inventory)
- ✏️ blood_type_received (مع تحديث inventory قديم و جديد)
- ✏️ name, phone, national_id (بدون تأثير على inventory)
- ❌ created_at (auto_now_add)

---

## 💻 أوامر اختبار سريعة

### عرض الحالة الحالية:
```python
# في django shell
from api.models import BloodInventory, BloodBag, Beneficiary

# عرض BloodInventory
BloodInventory.aggregate_totals()

# عرض أكياس معينة
BloodBag.objects.filter(blood_type='A+', status='Approved').count()

# عرض Beneficiaries
Beneficiary.objects.filter(blood_type_received='B+').values_list('bags_consumed')
```

### معالجة يدوية:
```python
from django.db import transaction

# تصحيح الـ inventory يدويّاً
with transaction.atomic():
    inv = BloodInventory.objects.select_for_update().get(blood_type='O+')
    inv.available = 100
    inv.issued = 50
    inv.save()
```

---

## 📞 جهات الاتصال في الكود

### للإصدار (Issuance):
- `deliver_request()` في services.py
- `DeliverRequestView` في operations_views.py

### للاستهلاك (Consumption):
- `BeneficiarySerializer.create()` في serializers.py
- `BeneficiaryViewSet` في views.py

### للتدقيق (Audit):
- `audit_signals.py` - جميع التغييرات تُسجل هنا

### للنقل (Transfer):
- لا يوجد عملية نقل خاصة (بدلاً منها استهلاك + إصدار)

---

**آخر تحديث:** 2026-06-14
