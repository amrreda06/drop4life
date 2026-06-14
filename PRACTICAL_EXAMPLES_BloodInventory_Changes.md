# 📈 أمثلة عملية: كيف تتغير قيم BloodInventory

## الحالة الابتدائية
```
BloodInventory (Blood Type: A+)
─────────────────────────────
available:      100  ✅
reserved:         0
issued:          50
expired:         10
critical_limit:  30
```

---

## 📝 السيناريو 1: التبرع ثم الاعتماد المعملي

### الخطوة 1️⃣: إضافة BloodBag (تبرع)
```python
# POST /api/operations/add-donation/
# { "mode": "bag", "bloodType": "A+", "qty": 1, ... }

# النتيجة:
BloodBag.objects.create(
    status='Pending',  # في المعمل
    blood_type='A+'
)

# ❌ لا تأثير على BloodInventory
BloodInventory (A+): [100, 0, 50, 10] ← بدون تغيير
```

### الخطوة 2️⃣: اعتماد الكيس من المعمل (Approved)
```python
# POST /api/operations/submit-lab/
# { "bagId": "BAG-1234", "decision": "Approved", "finalType": "A+" }

# في submit_lab_result():
inventory = BloodInventory.objects.get(blood_type='A+')
inventory.available += 1  # إضافة الكيس المعتمد
inventory.save()

# ✅ النتيجة على BloodInventory:
BloodInventory (A+): [101, 0, 50, 10] ← available زاد من 100 → 101
```

---

## 🏥 السيناريو 2: تسليم طلب مستشفى

### الحالة الابتدائية
```
BloodInventory (A+)
─────────────────────────────
available:      101
reserved:         0
issued:          50
expired:         10
```

### الخطوة 1️⃣: إنشاء طلب مستشفى
```python
# في views.py: BloodRequest.objects.create(
#     request_id='REQ-001',
#     blood='A+',
#     qty=5,
#     status='Pending Approval'
# )

# ❌ لا تأثير على BloodInventory
BloodInventory (A+): [101, 0, 50, 10] ← بدون تغيير
```

### الخطوة 2️⃣: تسليم الطلب للمستشفى
```python
# POST /api/operations/deliver-request/
# { "requestId": "REQ-001", "recipient": "Ahmed", ... }

# في deliver_request():
inventory = BloodInventory.objects.get(blood_type='A+')
inventory.available -= 5  # خصم من المتاح
inventory.issued += 5     # إضافة للمصدّر
inventory.save()

# ✅ النتيجة على BloodInventory:
BloodInventory (A+): [96, 0, 55, 10]
                    ↑   (101 - 5)
                            ↑ (50 + 5)
```

---

## 👤 السيناريو 3: إنشاء Beneficiary (استهلاك)

### الحالة الابتدائية
```
BloodInventory (B-)
─────────────────────────────
available:       50
reserved:         0
issued:          20
expired:          5
```

### الخطوة 1️⃣: إنشاء Beneficiary
```python
# POST /api/beneficiaries/
# {
#     "name": "محمد علي",
#     "nationalId": "123456",
#     "bloodTypeReceived": "B-",
#     "bagsConsumed": 2
# }

# في BeneficiarySerializer.create():
with transaction.atomic():
    inv = BloodInventory.objects.select_for_update().get(blood_type='B-')
    
    # ✅ التحقق من التوفر
    if inv.available < 2:  # 50 >= 2 ✅
        raise ValidationError('عجز في المخزون')
    
    # ✅ التحديث
    inv.available -= 2  # 50 - 2 = 48
    inv.issued += 2     # 20 + 2 = 22
    inv.save()
    
    # ✅ إنشاء Beneficiary
    Beneficiary.objects.create(...)

# ✅ النتيجة على BloodInventory:
BloodInventory (B-): [48, 0, 22, 5]
                    ↑    ↑
                  50-2  20+2
```

---

## ✏️ السيناريو 4: تعديل Beneficiary (نفس الفصيلة)

### الحالة الابتدائية
```
BloodInventory (O+)
─────────────────────────────
available:       80
reserved:         0
issued:          40
expired:         10

Beneficiary (موجود)
─────────────────────────────
name: "فاطمة"
blood_type_received: "O+"
bags_consumed: 2  ← ستتغير
```

### الخطوة 1️⃣: تعديل Beneficiary (زيادة الكمية من 2 → 5)
```python
# PATCH /api/beneficiaries/1/
# { "bagsConsumed": 5 }

# في BeneficiarySerializer.update():
old_qty = 2
new_qty = 5
delta = 5 - 2 = 3  # فرق موجب (زيادة)

with transaction.atomic():
    inv = BloodInventory.objects.select_for_update().get(blood_type='O+')
    
    if delta > 0:  # زيادة
        if inv.available < delta:  # 80 >= 3 ✅
            raise ValidationError('عجز في المخزون')
        inv.available -= delta  # 80 - 3 = 77
        inv.issued += delta     # 40 + 3 = 43
    
    inv.save()
    Beneficiary.objects.update(bags_consumed=5)

# ✅ النتيجة على BloodInventory:
BloodInventory (O+): [77, 0, 43, 10]
                    ↑    ↑
                  80-3  40+3
```

### الخطوة 2️⃣: تعديل Beneficiary (تقليل الكمية من 5 → 3)
```python
# PATCH /api/beneficiaries/1/
# { "bagsConsumed": 3 }

old_qty = 5
new_qty = 3
delta = 3 - 5 = -2  # فرق سالب (تقليل)

with transaction.atomic():
    inv = BloodInventory.objects.select_for_update().get(blood_type='O+')
    
    if delta < 0:  # تقليل
        inv.available += (-delta)  # 77 + 2 = 79
        inv.issued -= (-delta)     # 43 - 2 = 41
    
    inv.save()
    Beneficiary.objects.update(bags_consumed=3)

# ✅ النتيجة على BloodInventory:
BloodInventory (O+): [79, 0, 41, 10]
                    ↑    ↑
                  77+2  43-2
```

---

## 🔄 السيناريو 5: تعديل Beneficiary (تغيير الفصيلة)

### الحالة الابتدائية
```
BloodInventory (A+)
─────────────────────────────
available:       60
issued:          30

BloodInventory (B+)
─────────────────────────────
available:       40
issued:          25

Beneficiary (موجود)
─────────────────────────────
blood_type_received: "A+"  ← ستتغير إلى B+
bags_consumed: 3
```

### الخطوة 1️⃣: تعديل الفصيلة من A+ → B+
```python
# PATCH /api/beneficiaries/1/
# {
#     "bloodTypeReceived": "B+",
#     "bagsConsumed": 3
# }

old_blood = 'A+'
old_qty = 3
new_blood = 'B+'
new_qty = 3

with transaction.atomic():
    # ✅ استعادة الفصيلة القديمة (A+)
    inv_old = BloodInventory.objects.select_for_update().get(blood_type='A+')
    inv_old.available += old_qty  # 60 + 3 = 63
    inv_old.issued -= old_qty     # 30 - 3 = 27
    inv_old.save()
    
    # ✅ خصم من الفصيلة الجديدة (B+)
    inv_new = BloodInventory.objects.select_for_update().get(blood_type='B+')
    if inv_new.available < new_qty:  # 40 >= 3 ✅
        raise ValidationError('عجز في المخزون')
    inv_new.available -= new_qty  # 40 - 3 = 37
    inv_new.issued += new_qty     # 25 + 3 = 28
    inv_new.save()
    
    Beneficiary.objects.update(blood_type_received='B+')

# ✅ النتيجة على BloodInventory:
BloodInventory (A+): [63, 0, 27, ...] ← استعادة
BloodInventory (B+): [37, 0, 28, ...] ← خصم
```

---

## 🗑️ السيناريو 6: حذف Beneficiary

### الحالة الابتدائية
```
BloodInventory (B-)
─────────────────────────────
available:       48
issued:          22

Beneficiary (موجود)
─────────────────────────────
id: 5
blood_type_received: "B-"
bags_consumed: 2
```

### الخطوة 1️⃣: حذف Beneficiary
```python
# DELETE /api/beneficiaries/5/

# في models.py - restore_inventory_on_beneficiary_delete():
@receiver(post_delete, sender=Beneficiary)
def restore_inventory_on_beneficiary_delete(sender, instance, **kwargs):
    inv = BloodInventory.objects.filter(
        blood_type=instance.blood_type_received
    ).first()
    if inv:
        inv.available += instance.bags_consumed  # 48 + 2 = 50
        inv.issued -= instance.bags_consumed     # 22 - 2 = 20
        inv.save()

# ✅ النتيجة على BloodInventory:
BloodInventory (B-): [50, 0, 20, ...]
                    ↑   ↑
              48+2  22-2
```

---

## ⚠️ السيناريو 7: حذف BloodBag (المشكلة المحتملة)

### الحالة الابتدائية
```
BloodBag
─────────────────────────────
bag_id: BAG-5678
status: 'Approved'
blood_type: 'A+'

BloodInventory (A+)
─────────────────────────────
available: 101
issued: 50

PendingDonor (قد يكون موجود أو لا)
─────────────────────────────
bag: BAG-5678 ← OneToOne with CASCADE
```

### الخطوة 1️⃣: حذف BloodBag
```python
# DELETE /api/bloodbags/BAG-5678/

# في views.py - BloodBagViewSet.destroy():
# ❌ لا يوجد logic خاص
# ❌ Django حذف تلقائي

# النتائج:
# ✅ BloodBag يُحذف
# ✅ PendingDonor يُحذف (CASCADE)
# ❌ BloodInventory لم يتحدث
#    (لا توجد Signal لـ post_delete BloodBag)

# ⚠️ المشكلة: الكيس المعتمد اختفى لكن الـ inventory بقي!
BloodInventory (A+): [101, 0, 50, ...] ← بدون تغيير (خطأ!)
                    # يجب أن يكون: [100, 0, 50, ...] ← available-1
```

### 💡 الحل المقترح:
```python
@receiver(post_delete, sender=BloodBag)
def restore_inventory_on_bag_delete(sender, instance, **kwargs):
    """استعادة الأكياس عند حذف BloodBag"""
    if instance.status == 'Approved':
        inv = BloodInventory.objects.filter(
            blood_type=instance.blood_type
        ).first()
        if inv:
            inv.available = max(0, inv.available - 1)
            inv.expired = inv.expired + 1  # أو تصنيفه كـ expired
            inv.save()
```

---

## 📊 جدول ملخص التغييرات

| السيناريو | الإجراء | available | reserved | issued | expired |
|----------|--------|-----------|----------|--------|---------|
| اعتماد Bag | +1 | **+1** | - | - | - |
| تسليم طلب | -qty | **-qty** | - | **+qty** | - |
| إنشاء Beneficiary (qty) | -qty | **-qty** | - | **+qty** | - |
| تعديل Beneficiary (+delta) | -delta | **-delta** | - | **+delta** | - |
| تعديل Beneficiary (-delta) | +delta | **+delta** | - | **-delta** | - |
| حذف Beneficiary (qty) | +qty | **+qty** | - | **-qty** | - |
| حذف Bag (Approved) ❌ | +1 | ❌ لا تأثير | - | - | - |
| تغيير فصيلة Beneficiary | complex | (يختلف) | - | (يختلف) | - |

---

## 🔍 اختبار الحالات الحدية

### حالة 1: محاولة إنشاء Beneficiary بأكياس أكثر من المتاح
```python
# BloodInventory (A+): available = 5
# POST /api/beneficiaries/
# { "bloodTypeReceived": "A+", "bagsConsumed": 10 }

# النتيجة: ❌ ValidationError
# "عجز في المخزون لعدد الأكياس المطلوبة"

# BloodInventory: لم يتغير (عملية atomic - Rollback)
```

### حالة 2: تعديل Beneficiary وتغيير الفصيلة مع عدم توفر الفصيلة الجديدة
```python
# BloodInventory (O+): available = 2
# BloodInventory (O-): available = 100
# Beneficiary: blood_type_received='O+', bags_consumed=5

# PATCH /beneficiaries/1/
# { "bloodTypeReceived": "O-", "bagsConsumed": 5 }

# الخطوات:
# 1. استعادة من O+: available = 2 + 5 = 7 ✅
# 2. خصم من O-: available = 100 - 5 = 95 ✅ (كافي)

# النتيجة:
# BloodInventory (O+): [7, 0, 45, ...]
# BloodInventory (O-): [95, 0, 45, ...]
```

### حالة 3: حذف ثم إنشاء Beneficiary بنفس الفصيلة
```python
# BloodInventory (B+): available = 20, issued = 30

# 1. حذف Beneficiary (bags_consumed=10):
#    available = 20 + 10 = 30
#    issued = 30 - 10 = 20

# 2. إنشاء Beneficiary جديد (bags_consumed=15):
#    available = 30 - 15 = 15
#    issued = 20 + 15 = 35

# النتيجة النهائية:
# BloodInventory (B+): [15, 0, 35, ...]
```

---

## 🎯 الخلاصة

✅ **يعمل بشكل صحيح:**
- إنشاء Beneficiary
- تعديل Beneficiary (جميع الحالات)
- حذف Beneficiary
- تسليم طلب مستشفى
- اعتماد Bag من المعمل

❌ **مشاكل محتملة:**
- حذف BloodBag المعتمد لا يستعيد الأكياس
- حقل `reserved` غير مستخدم
- حقل `expired` لا يُحدّث تلقائياً

💡 **التحسينات المقترحة:**
- إضافة Signal لـ post_delete BloodBag
- معالجة دورية لانتهاء الصلاحية
- استخدام reserved للطلبات المحجوزة
