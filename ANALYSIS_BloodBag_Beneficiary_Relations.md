# تحليل شامل: العلاقات بين BloodBag و BloodInventory و Beneficiary

## 📋 جدول المحتويات
1. [Model Relationships](#model-relationships)
2. [Signals والعمليات عند الحذف](#signals-والعمليات-عند-الحذف)
3. [عمليات ربط BloodBag مع BloodInventory](#عمليات-ربط-bloodbag-مع-bloodinventory)
4. [تتبع الصلاحية (Expiry)](#تتبع-الصلاحية-expiry)
5. [عمليات Beneficiary و BloodInventory](#عمليات-beneficiary-و-bloodinventory)
6. [كل العمليات التي تؤثر على الكميات](#كل-العمليات-التي-تؤثر-على-الكميات)

---

## Model Relationships

### 1️⃣ **BloodBag Model** [models.py#L80-L92]
```python
class BloodBag(models.Model):
    bag_id = CharField(max_length=20, primary_key=True)
    donor = CharField(max_length=255)
    blood_type = CharField(max_length=10)
    qty = IntegerField(default=1)
    date = DateField()
    expiry = DateField(db_index=True)  # ⏰ تاريخ الصلاحية
    location = CharField(max_length=255)
    status = CharField(max_length=50, db_index=True)
```

**الحالات الممكنة للـ Status:**
- `Pending` - في المعمل (قبل الموافقة)
- `Approved` - موافق عليه وفي المخزون
- `Rejected` - مرفوض أو ملقى

### 2️⃣ **BloodInventory Model** [models.py#L37-L61]
```python
class BloodInventory(models.Model):
    blood_type = CharField(max_length=5, primary_key=True)
    available = IntegerField(default=0)      # أكياس جاهزة للإصدار
    reserved = IntegerField(default=0)       # أكياس محجوزة
    issued = IntegerField(default=0)         # أكياس مصدرة
    expired = IntegerField(default=0)        # أكياس منتهية الصلاحية
    critical_limit = IntegerField(default=0) # حد الخطر
```

### 3️⃣ **Beneficiary Model** [models.py#L262-L280]
```python
class Beneficiary(models.Model):
    name = CharField(max_length=255)
    phone = CharField(max_length=20)
    national_id = CharField(max_length=20)
    blood_type_received = CharField(max_length=5)  # ✅ الربط مع BloodInventory
    bags_consumed = IntegerField(default=1)        # ✅ الكمية المستهلكة
    created_at = DateTimeField(auto_now_add=True)
```

### 4️⃣ **PendingDonor Model** [models.py#L95-L110]
```python
class PendingDonor(models.Model):
    bag = OneToOneField(BloodBag, on_delete=CASCADE, primary_key=True)
    name = CharField(max_length=255)
    national_id = CharField(max_length=20)
    # ... بيانات أخرى
    # 🔗 يُحذف عند حذف BloodBag نتيجة CASCADE
```

---

## Signals والعمليات عند الحذف

### 🗑️ Signal: حذف Beneficiary → استعادة Inventory

**الملف:** [models.py#L291-L304]

```python
@receiver(post_delete, sender=Beneficiary)
def restore_inventory_on_beneficiary_delete(sender, instance, **kwargs):
    """عند حذف Beneficiary، يتم استعادة الأكياس للمخزون"""
    try:
        inv = BloodInventory.objects.filter(
            blood_type=instance.blood_type_received
        ).first()
        if inv:
            # ✅ استعادة الأكياس للمخزون
            inv.available = inv.available + (instance.bags_consumed or 0)
            # ✅ إنقاص المصدَّر
            inv.issued = max(0, inv.issued - (instance.bags_consumed or 0))
            inv.save()
    except Exception:
        pass  # تجاهل الأخطاء لتجنب كسر سير الحذف
```

**التأثيرات:**
- | العملية | قبل | بعد |
  |---------|-----|-----|
  | available | X | X + bags_consumed |
  | issued | Y | Y - bags_consumed |

### 📝 Audit Signals [audit_signals.py#L154-L156]

```python
# لكل Model (بما فيها Beneficiary و BloodBag):
pre_save.connect(_capture_old_state, sender=model)   # حفظ الحالة القديمة
post_save.connect(_log_save, sender=model)           # تسجيل التغييرات
post_delete.connect(_log_delete, sender=model)       # تسجيل الحذف
```

**ما يتم تسجيله:**
- 🔸 عند **إنشاء** Beneficiary: `إنشاء Beneficiary "{name}"`
- 🔸 عند **تعديل**: تفاصيل كل حقل تغير
- 🔸 عند **حذف**: `حذف Beneficiary "{name}"`

---

## عمليات ربط BloodBag مع BloodInventory

### 1️⃣ **إضافة BloodBag عند التبرع** [services.py#L310-L361]

#### أ) تبرع بدون معلومات المتبرع (anonymous bags)
```python
@transaction.atomic
def add_donation_bags(blood_type, qty, room_name, fridge_name, shelf_name, ...):
    # ✅ ينشئ أكياس بـ status='Pending' (في المعمل)
    # ✅ لم يتم تحديث BloodInventory بعد (في الانتظار)
    # ✅ ينشئ PendingDonor OneToOne relationship
    for _ in range(qty):
        bag = BloodBag.objects.create(
            status='Pending',
            expiry=today + timedelta(days=42),
            ...
        )
```

#### ب) تبرع من متبرع موجود
```python
def add_donation_donor(name, national_id, ...):
    # ✅ ينشئ BloodBag بـ status='Pending'
    # ✅ يحدث Donor.total_count و Donor.last_date
    # ✅ ينشئ PendingDonor
    # ❌ لم يتم تحديث BloodInventory بعد
```

### 2️⃣ **اعتماد النتيجة من المعمل** [services.py#L363-L410]

```python
@transaction.atomic
def submit_lab_result(bag_id, decision, final_type, reason, ...):
    bag = BloodBag.objects.filter(bag_id=bag_id).first()
    bag.status = decision
    bag.blood_type = final_type
    
    if decision == 'Approved':
        # ✅ **إضافة إلى BloodInventory.available**
        inventory, _ = BloodInventory.objects.get_or_create(
            blood_type=final_type
        )
        inventory.available += 1  # ⬆️ إضافة 1 كيس
        inventory.save()
        
        # ✅ تحديث الموقع
        bag.location = f'تخزين رئيسي: {bag.location}'
        
        # ✅ ترقية المتبرع المؤقت إلى متبرع دائم
        pending = PendingDonor.objects.filter(bag_id=bag_id).first()
        if pending:
            Donor.objects.create(...)  # ينشئ سجل متبرع جديد
            pending.delete()            # حذف PendingDonor
    else:
        # ❌ رفض الكيس
        DisposalLog.objects.create(...)  # تسجيل الرفض
```

**التأثيرات عند الموافقة:**
- `available`: X → X + 1
- حالة `status`: Pending → Approved
- الموقع: تحديثه بـ prefix "تخزين رئيسي:"
- PendingDonor: يُحذف ويُستبدل بـ Donor دائم

### 3️⃣ **حذف BloodBag** [عن طريق الـ ViewSet]

```python
class BloodBagViewSet(SuperAdminWritesPermissionMixin, viewsets.ModelViewSet):
    queryset = BloodBag.objects.all()
    # ⚠️ لا توجد عملية custom destroy
    # ⚠️ PendingDonor يُحذف تلقائياً (CASCADE)
    # ⚠️ NO تحديث تلقائي لـ BloodInventory
```

**ملاحظة مهمة:** 
- ❌ عند حذف BloodBag لا يتم استعادة أكياس من BloodInventory
- ✅ فقط حذف BloodBag نفسه و PendingDonor (إن وجد)

---

## تتبع الصلاحية (Expiry)

### 🕐 حقل Expiry في BloodBag
```python
expiry = DateField(db_index=True)  # مفهرس للبحث السريع
```

### ⏰ قيمة الصلاحية الافتراضية
```python
# 42 يوم من تاريخ التبرع
expiry = today + timedelta(days=42)
```

### 📊 حالات الصلاحية في BloodInventory
| الحقل | الوصف |
|------|-------|
| `available` | أكياس في المدة الصلاحية وجاهزة للإصدار |
| `expired` | أكياس منتهية الصلاحية (تم تسجيل انتهاء صلاحيتها) |

### ⚠️ معالجة انتهاء الصلاحية
```python
# ❌ لا يوجد Signal تلقائي لتحويل available → expired
# ⚠️ يجب معالجة يدوية أو batch job
# 💡 الصلاحية تُتتبع لكن لا تُحدّث تلقائياً

# ✅ فقط عند رفع نتيجة المعمل:
if decision != 'Approved':
    DisposalLog.objects.create(...)  # تسجيل الرفض/التخلص
```

---

## عمليات Beneficiary و BloodInventory

### 1️⃣ **إنشاء Beneficiary** [serializers.py#BeneficiarySerializer.create]

```python
def create(self, validated_data):
    blood_type = validated_data.get('blood_type_received')
    qty = int(validated_data.get('bags_consumed', 1) or 0)
    
    with transaction.atomic():
        # ✅ Lock الـ BloodInventory
        inv = BloodInventory.objects.select_for_update().filter(
            blood_type=blood_type
        ).first()
        
        # ✅ التحقق من توفر الأكياس
        if inv.available < qty:
            raise ValidationError('عجز في المخزون')
        
        # ✅ تحديث المخزون
        inv.available = inv.available - qty  # ⬇️ إنقاص الأكياس المتاحة
        inv.issued = inv.issued + qty        # ⬆️ إضافة الأكياس المصدّرة
        inv.save()
        
        # ✅ إنشاء Beneficiary
        return super().create(validated_data)
```

**التأثيرات:**
| الحقل | قبل | بعد |
|------|-----|-----|
| available | X | X - qty |
| issued | Y | Y + qty |
| Beneficiary | - | ✅ جديد |

### 2️⃣ **تعديل Beneficiary** [serializers.py#BeneficiarySerializer.update]

#### حالة أ: نفس فصيلة الدم (تعديل الكمية فقط)
```python
if old_blood == new_blood:
    delta = new_qty - old_qty
    
    if delta > 0:  # زيادة الكمية
        # ✅ خصم إضافي من available
        inv.available -= delta
        inv.issued += delta
    elif delta < 0:  # تقليل الكمية
        # ✅ استعادة الأكياس
        inv.available += (-delta)
        inv.issued = max(0, inv.issued - (-delta))
```

#### حالة ب: تغيير فصيلة الدم
```python
else:
    # ✅ استعادة الأكياس من الفصيلة القديمة
    inv_old.available += old_qty
    inv_old.issued = max(0, inv_old.issued - old_qty)
    
    # ✅ خصم من الفصيلة الجديدة
    inv_new.available -= new_qty
    inv_new.issued += new_qty
```

### 3️⃣ **حذف Beneficiary** [Signal في models.py]

```python
@receiver(post_delete, sender=Beneficiary)
def restore_inventory_on_beneficiary_delete(...):
    inv = BloodInventory.objects.filter(
        blood_type=instance.blood_type_received
    ).first()
    
    if inv:
        # ✅ استعادة الأكياس
        inv.available += instance.bags_consumed
        inv.issued = max(0, inv.issued - instance.bags_consumed)
        inv.save()
    
    # ✅ تسجيل Audit
    _write_audit(f'حذف Beneficiary', ...)
```

---

## كل العمليات التي تؤثر على الكميات

### 📊 جدول شامل للعمليات

| العملية | الملف | الدالة | available | reserved | issued | expired | ملاحظات |
|---------|------|--------|-----------|----------|--------|---------|---------|
| **إضافة أكياس التبرع** | operations_views.py | AddDonationView | - | - | - | - | الأكياس في حالة Pending (في المعمل) |
| **اعتماد الكيس من المعمل** | services.py | submit_lab_result() | **+1** | - | - | - | إذا كانت النتيجة "Approved" |
| **رفض الكيس من المعمل** | services.py | submit_lab_result() | - | - | - | - | ينشئ DisposalLog |
| **إلقاء كيس** | operations_views.py | DisposeBagView | - | - | - | - | تحديث status إلى "Rejected" |
| **تسليم طلب مستشفى** | services.py | deliver_request() | **-qty** | - | **+qty** | - | الأكياس الجاهزة → المصدّرة |
| **إنشاء Beneficiary** | serializers.py | BeneficiarySerializer.create() | **-qty** | - | **+qty** | - | استهلاك الأكياس من المخزون |
| **تعديل Beneficiary (زيادة)** | serializers.py | BeneficiarySerializer.update() | **-delta** | - | **+delta** | - | تقليل المتاح وزيادة المصدّر |
| **تعديل Beneficiary (تقليل)** | serializers.py | BeneficiarySerializer.update() | **+delta** | - | **-delta** | - | استعادة الأكياس |
| **حذف Beneficiary** | models.py | restore_inventory_on_beneficiary_delete() | **+qty** | - | **-qty** | - | استعادة كاملة للأكياس |

### 📝 تفاصيل العمليات

#### 1️⃣ **إضافة أكياس التبرع** [add_donation_bags]
```
التأثير على BloodInventory: ❌ لا يوجد تأثير
التأثير على BloodBag: ✅ ينشئ BloodBag(status='Pending')
التأثير على PendingDonor: ✅ قد ينشئ سجل (إذا كان متبرع جديد)
```

#### 2️⃣ **اعتماد الكيس من المعمل** [submit_lab_result - Approved]
```python
# الدالة في services.py
inventory.available += 1  # ⬆️ +1
```

#### 3️⃣ **تسليم طلب المستشفى** [deliver_request]
```python
def deliver_request(request_id, ...):
    inventory.available -= req.qty     # ⬇️ -qty
    inventory.issued += req.qty        # ⬆️ +qty
    inventory.save()
    
    # وينشئ HospitalDeliveryRecord
    HospitalDeliveryRecord.objects.create(...)
```

#### 4️⃣ **استهلاك Beneficiary** [BeneficiarySerializer.create]
```python
inv.available -= qty   # ⬇️ -qty
inv.issued += qty      # ⬆️ +qty
```

---

## 🔗 Relationships و Constraints

### OneToOne Relationships
```
BloodBag ←→ PendingDonor (on_delete=CASCADE)
           ↓ (عند حذف BloodBag يُحذف PendingDonor)
```

### Foreign Key Relationships
```
Beneficiary → BloodInventory (عبر blood_type_received)
             (لا توجد FK صريحة، لكن تحقق في التحديثات)
```

### Indexes للأداء
```python
BloodBag.expiry    # db_index=True
BloodBag.status    # db_index=True
Beneficiary.created_at  # db_index=True
```

---

## 📌 ملخص النقاط الحرجة

### ✅ التأثيرات الموثوقة
- ✔️ حذف Beneficiary → استعادة inventory (Signal محقق)
- ✔️ حذف BloodBag → حذف PendingDonor (CASCADE)
- ✔️ تسليم طلب مستشفى → تحديث available/issued
- ✔️ إنشاء Beneficiary → تحديث available/issued

### ⚠️ الفجوات المحتملة
- ❌ عند حذف BloodBag لا يتم استعادة أكياس من BloodInventory
- ❌ لا يوجد معالجة تلقائية لانتهاء الصلاحية
- ❌ حقل `reserved` لا يُستخدم في أي عملية
- ❌ حقل `expired` لا يُحدّث تلقائياً

### 💡 التحسينات المقترحة
```python
# 1. إضافة Signal عند حذف BloodBag المعتمد
@receiver(post_delete, sender=BloodBag)
def restore_inventory_on_bag_delete(sender, instance, **kwargs):
    if instance.status == 'Approved':
        inv = BloodInventory.objects.filter(
            blood_type=instance.blood_type
        ).first()
        if inv:
            inv.available = max(0, inv.available - 1)
            inv.save()

# 2. معالجة دورية للصلاحية
def mark_expired_bags():
    from datetime import date
    today = date.today()
    expired_bags = BloodBag.objects.filter(
        expiry__lt=today,
        status='Approved'
    )
    for bag in expired_bags:
        inv = BloodInventory.objects.filter(
            blood_type=bag.blood_type
        ).first()
        if inv:
            inv.available = max(0, inv.available - 1)
            inv.expired += 1
            inv.save()
```

---

## 📚 الملفات ذات الصلة

| الملف | السطور | الوصف |
|------|--------|-------|
| [models.py](api/models.py) | 37-110, 262-304 | جميع Models والـ Signals |
| [serializers.py](api/serializers.py) | 237-580 | Serializers مع logic التحديث |
| [views.py](api/views.py) | 272-280, 620-625 | ViewSets |
| [services.py](api/services.py) | 310-435 | دوال العمليات الرئيسية |
| [operations_views.py](api/operations_views.py) | 1-140 | Views للعمليات المعقدة |
| [audit_signals.py](api/audit_signals.py) | 1-160 | Signals التدقيق الشامل |

---

**تم الإنشاء:** 2026-06-14  
**آخر تحديث:** التحليل الشامل الحالي
