# 🎯 ملخص سريع: Signals و Operations

## 🔴 جميع الـ Signals المتعلقة

### Signal 1: حذف Beneficiary → استعادة Inventory
**الملف:** `api/models.py#L295-L304`  
**النوع:** `@receiver(post_delete, sender=Beneficiary)`  
**التأثير:**
```
available ← available + bags_consumed
issued ← issued - bags_consumed
```

### Signal 2-4: تدقيق شامل لجميع Models
**الملف:** `api/audit_signals.py#L154-L156`  
**الأنواع:**
- `pre_save` → حفظ الحالة القديمة
- `post_save` → تسجيل الإنشاء/التعديل
- `post_delete` → تسجيل الحذف

---

## 🔵 جميع العمليات على BloodBag

### 1. إضافة BloodBag (من التبرع)
| الطريقة | الملف | الدالة | الحالة | BloodInventory |
|--------|------|--------|--------|---|
| anonymous bags | `services.py` | `add_donation_bags()` | Pending | ❌ لا تأثير |
| مع متبرع جديد | `services.py` | `add_donation_donor()` | Pending | ❌ لا تأثير |
| مع متبرع موجود | `services.py` | `add_donation_donor()` | Pending | ❌ لا تأثير |

### 2. اعتماد BloodBag (من المعمل)
| النتيجة | الملف | الدالة | النتيجة على Bag | BloodInventory |
|--------|------|--------|---|---|
| Approved | `services.py` | `submit_lab_result()` | status='Approved' | ✅ available += 1 |
| Rejected | `services.py` | `submit_lab_result()` | status='Pending' | ❌ لا تأثير |

### 3. التخلص من BloodBag
| الطريقة | الملف | الدالة | النتيجة على Bag | BloodInventory |
|--------|------|--------|---|---|
| حذف يدوي | `views.py` | ViewSet destroy | ❌ يُحذف | ❌ لا استعادة |
| disposal log | `services.py` | `dispose_bag()` | status='Rejected' | ❌ لا تأثير |

---

## 🟢 جميع العمليات على Beneficiary

### العملية: إنشاء Beneficiary
**الملف:** `serializers.py#BeneficiarySerializer.create()`  
**المتطلبات:**
```
✅ التحقق من توفر الأكياس (available >= qty)
✅ Lock على BloodInventory (select_for_update)
```
**التأثيرات:**
```
available ← available - qty
issued ← issued + qty
Beneficiary ← جديد
```

### العملية: تعديل Beneficiary
**الملف:** `serializers.py#BeneficiarySerializer.update()`  
**الحالات:**

#### 🔹 نفس الفصيلة + زيادة الكمية:
```
available ← available - delta
issued ← issued + delta
```

#### 🔹 نفس الفصيلة + تقليل الكمية:
```
available ← available + delta
issued ← issued - delta
```

#### 🔹 تغيير الفصيلة:
```
# الفصيلة القديمة
old_inventory.available += old_qty
old_inventory.issued -= old_qty

# الفصيلة الجديدة
new_inventory.available -= new_qty
new_inventory.issued += new_qty
```

### العملية: حذف Beneficiary
**الملف:** `models.py#restore_inventory_on_beneficiary_delete()`  
**Signal:** `@receiver(post_delete, sender=Beneficiary)`  
**التأثيرات:**
```
available ← available + bags_consumed
issued ← issued - bags_consumed
Beneficiary ← يُحذف
```

---

## 🟠 جميع العمليات على BloodInventory

### 1. إنشاء BloodInventory
**الملف:** `services.py#ensure_blood_inventory()`  
```python
# يتم إنشاء 8 فصائل دم افتراضياً:
# A+, A-, B+, B-, AB+, AB-, O+, O-
for blood_type in BLOOD_TYPES:
    BloodInventory.objects.get_or_create(
        blood_type=blood_type,
        defaults={'critical_limit': DEFAULT_CRITICAL_LIMITS[blood_type]}
    )
```

### 2. تحديث BloodInventory

| العملية | available | reserved | issued | expired |
|--------|-----------|----------|--------|---------|
| اعتماد Bag | **+1** | - | - | - |
| تسليم لمستشفى | **-qty** | - | **+qty** | - |
| استهلاك Beneficiary | **-qty** | - | **+qty** | - |
| حذف Beneficiary | **+qty** | - | **-qty** | - |
| تعديل Beneficiary (زيادة) | **-delta** | - | **+delta** | - |
| تعديل Beneficiary (تقليل) | **+delta** | - | **-delta** | - |
| تغيير فصيلة في Beneficiary | (complex) | - | (complex) | - |

### 3. عرض BloodInventory

| الطريقة | الملف | الدالة | الإرجاع |
|--------|------|--------|--------|
| JSON كاملة | `views.py` | `BloodInventoryViewSet.as_dict()` | قاموس بجميع الفصائل |
| Aggregate totals | `services.py` | `BloodInventory.aggregate_totals()` | مجموع الكميات |
| Dashboard stats | `services.py` | `compute_dashboard_stats()` | إحصائيات عامة |

---

## 📊 حقول BloodInventory وحالاتها

```python
class BloodInventory:
    blood_type      # المفتاح الأساسي (A+, B-, إلخ)
    available       # أكياس جاهزة للإصدار
    reserved        # أكياس محجوزة (❌ لا يُستخدم حالياً)
    issued          # أكياس مصدرة (للمستشفيات + Beneficiaries)
    expired         # أكياس منتهية الصلاحية (❌ لا يُحدّث تلقائياً)
    critical_limit  # حد الخطر (للتنبيهات)
```

---

## 🔄 Flow الكيس من البداية للنهاية

```
1. التبرع
   └─> BloodBag(status='Pending') ─ لا تأثير على Inventory

2. المعمل
   ├─> APPROVED
   │   └─> BloodBag(status='Approved')
   │       └─> Inventory.available += 1 ✅
   └─> REJECTED
       └─> BloodBag → DisposalLog
           └─> لا تأثير على Inventory ❌

3. الاستخدام
   ├─> تسليم مستشفى
   │   └─> Inventory.available -= qty
   │       Inventory.issued += qty ✅
   └─> Beneficiary
       └─> Inventory.available -= qty
           Inventory.issued += qty ✅

4. الحذف
   ├─> حذف BloodBag
   │   └─> PendingDonor يُحذف (CASCADE)
   │       لا تأثير على Inventory ❌
   └─> حذف Beneficiary
       └─> Inventory.available += qty
           Inventory.issued -= qty ✅
```

---

## ⚡ الأداء والـ Locks

### استخدام Transactions
- ✅ `BeneficiarySerializer.create()` - `transaction.atomic()`
- ✅ `BeneficiarySerializer.update()` - `transaction.atomic()`
- ✅ `deliver_request()` - `@transaction.atomic`
- ✅ `submit_lab_result()` - `@transaction.atomic`

### استخدام Select for Update
```python
# في Beneficiary Create/Update:
inv = BloodInventory.objects.select_for_update().filter(
    blood_type=blood_type
).first()
```

---

## 🎨 رسم تخطيطي للعلاقات

```
┌─────────────┐
│  BloodBag   │  bag_id (PK)
├─────────────┤
│ donor       │
│ blood_type  │  ──────┐
│ qty         │        │
│ status      │        │
│ expiry      │        │
│ location    │        │
└─────────────┘        │
         │             │
         │ OneToOne    │
         │             │
    ┌────┴────────┐    │
    │ PendingDonor │    │
    │ (CASCADE)    │    │
    └──────────────┘    │
                        │
                        ├─ (blood_type)
                        │
                    ┌───▼──────────────┐
                    │ BloodInventory   │ (PK: blood_type)
                    ├──────────────────┤
                    │ available    ◄──┐│
                    │ reserved         ││
                    │ issued       ◄──┤├─ تحديثات
                    │ expired          ││
                    │ critical_limit   ││
                    └──────────────────┘
                        │
                        ├─ (blood_type_received)
                        │
                    ┌───▼──────────────┐
                    │  Beneficiary     │
                    ├──────────────────┤
                    │ name             │
                    │ phone            │
                    │ national_id      │
                    │ blood_type_rec   │
                    │ bags_consumed    │
                    │ created_at       │
                    └──────────────────┘
                        │
                        │ post_delete Signal
                        │
                    استعادة inventory
```

---

## 📋 Checklist للعمليات الحرجة

### عند إنشاء Beneficiary
- [ ] التحقق من توفر الأكياس
- [ ] استخدام transaction.atomic
- [ ] استخدام select_for_update
- [ ] تحديث available -= qty
- [ ] تحديث issued += qty
- [ ] تسجيل Audit log

### عند تعديل Beneficiary
- [ ] حساب delta الكمية
- [ ] التحقق من توفر الأكياس (عند الزيادة)
- [ ] استخدام transaction.atomic
- [ ] معالجة تغيير الفصيلة بشكل منفصل
- [ ] تسجيل Audit log

### عند حذف BloodBag
- ⚠️ **التحذير:** لا استعادة تلقائية للأكياس من BloodInventory
- ✅ يُحذف PendingDonor (CASCADE)
- ✅ تسجيل Audit log

### عند حذف Beneficiary
- [ ] استدعاء Signal تلقائياً
- [ ] استعادة available += qty
- [ ] تحديث issued -= qty
- [ ] تسجيل Audit log

---

## 🔗 الروابط السريعة للملفات

- [models.py](./api/models.py) - جميع Models
- [serializers.py](./api/serializers.py) - BeneficiarySerializer
- [views.py](./api/views.py) - BloodBagViewSet, BeneficiaryViewSet
- [services.py](./api/services.py) - دوال العمليات
- [operations_views.py](./api/operations_views.py) - العمليات المعقدة
- [audit_signals.py](./api/audit_signals.py) - Signals التدقيق

---

**ملخص النقطة الأساسية:** 
> Beneficiary و BloodInventory مرتبطان بشكل وثيق من خلال blood_type_received، وهناك Signal قوي يستعيد الأكياس عند حذف Beneficiary. لكن BloodBag لا يستعيد الأكياس عند حذفه (وهي فجوة محتملة).
