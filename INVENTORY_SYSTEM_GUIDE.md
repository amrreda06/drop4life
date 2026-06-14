## 📚 نظام إدارة الأكياس الذكي مع تتبع الصلاحية

### 🎯 الربط الكامل بين الأكياس والمخزون

---

## 1️⃣ **كيف يتم ربط الأكياس بالمخزون؟**

### العلاقات الأساسية:
```
BloodBag ←→ BloodInventory
  ↓ (blood_type)      ↓
  A+, B-, AB+, etc    (available, issued, expired, reserved)
```

### حالات الأكياس وتأثيرها على المخزون:

| حالة الكيس | المخزون | التأثير |
|-----------|--------|--------|
| **Pending** | - | لا تأثير (قيد الاختبار) |
| **Approved** | available ↑ | +1 إلى available عند الموافقة |
| **Delivered** | issued ↑ | +1 إلى issued عند التسليم |
| **Expired** | expired ↑ | نقل من available إلى expired |
| **Failed** | - | لا تأثير (رفض معملي) |
| **🗑️ (حذف)** | - | - استعادة من available إذا كان Approved |

---

## 2️⃣ **العمليات التي تحدث تلقائياً**

### ✅ العمليات المدعومة حالياً:

#### أ) عند **إضافة تبرع جديد**:
```python
# إنشاء BloodBag جديد بحالة "Pending"
BloodBag(bag_id="BAG-1234", blood_type="A+", status="Pending")
# ✓ المخزون: بدون تأثير (ينتظر الاختبار المعملي)
```

#### ب) عند **الموافقة المعملية**:
```python
# تحديث الكيس إلى "Approved"
BloodBag.status = "Approved"
# ✓ المخزون: A+ available += 1
```

#### ج) عند **التسليم للمستشفى**:
```python
# تحديث الكيس إلى "Delivered"
BloodBag.status = "Delivered"
# ✓ المخزون: A+ available -= 1, issued += 1
```

#### د) عند **إضافة مستفيد (Beneficiary)**:
```python
Beneficiary(blood_type_received="B+", bags_consumed=2)
# ✓ المخزون: B+ available -= 2, issued += 2
```

#### هـ) عند **حذف مستفيد**:
```python
beneficiary.delete()  # كان B+, استهلك 2 أكياس
# ✓ المخزون: B+ available += 2, issued -= 2
```

#### و) عند **حذف كيس معتمد**:
```python
bag.delete()  # حالة Approved
# ✓ المخزون: A+ available -= 1, issued -= 1
```

#### ز) عند **انتهاء الصلاحية** (تلقائي):
```python
process_expired_bags()  # أكياس expiry < اليوم
# ✓ المخزون: نقل من available → expired
```

---

## 3️⃣ **أوامر الإدارة (Management Commands)**

### أ) معالجة الصلاحية والمزامنة:

```bash
# معالجة شاملة (كل شيء)
python manage.py maintain_inventory --all

# معالجة الصلاحية فقط
python manage.py maintain_inventory --process-expired

# مزامنة المخزون من الأكياس
python manage.py maintain_inventory --sync
```

**مثال النتيجة:**
```
📅 معالجة الأكياس منتهية الصلاحية...
✅ تمت معالجة 5 أكياس
   - A+: 2 أكياس
   - B-: 3 أكياس

🔄 مزامنة المخزون من واقع الأكياس...
   🔧 A+: available 10→8, issued 5→5, expired 2→4
   🔧 O-: available 3→0, issued 0→0, expired 0→3
✅ تمت مزامنة 2 فصيلة
```

### ب) مسح جميع البيانات:

```bash
python manage.py shell -c "from api.services import reset_operational_data; reset_operational_data(); print('✓ تم مسح جميع البيانات بنجاح')"
```

---

## 4️⃣ **Signals (الإشارات الآلية)**

### Signal 1️⃣: حذف المستفيد
```python
# في models.py
@receiver(post_delete, sender=Beneficiary)
def restore_inventory_on_beneficiary_delete(sender, instance, **kwargs):
    """استعادة الأكياس عند حذف المستفيد"""
    inv.available += instance.bags_consumed
    inv.issued -= instance.bags_consumed
```

### Signal 2️⃣: حذف الكيس المعتمد
```python
# في models.py
@receiver(post_delete, sender=BloodBag)
def restore_inventory_on_bloodbag_delete(sender, instance, **kwargs):
    """استعادة الكيس فقط إذا كان معتمداً (Approved)"""
    if instance.status == 'Approved':
        inv.available += instance.qty
        inv.issued -= instance.qty
```

---

## 5️⃣ **مثال عملي كامل**

### السيناريو:
1. إضافة 10 أكياس A+ → Pending
2. المعمل يوافق على 8 أكياس → Approved
3. تسليم 6 أكياس للمستشفى → Delivered
4. حذف 2 كيس معتمد
5. إنتهاء صلاحية 2 كيس

### حساب المخزون النهائي:

```
البداية: A+ = [available: 0, issued: 0, expired: 0]

1️⃣ إضافة 10 أكياس (Pending)
   → A+ = [available: 0, issued: 0, expired: 0]  (بدون تأثير)

2️⃣ الموافقة على 8 (Approved)
   → A+ = [available: 8, issued: 0, expired: 0]  (+8)

3️⃣ تسليم 6 (Delivered)
   → A+ = [available: 2, issued: 6, expired: 0]  (available -6, issued +6)

4️⃣ حذف 2 معتمد من ال 8
   → A+ = [available: 0, issued: 6, expired: 0]  (available -2)

5️⃣ انتهاء صلاحية 2
   → A+ = [available: 0, issued: 4, expired: 2]  (issued -2, expired +2)

النتيجة النهائية: 6 أكياس موزعة، 2 منتهية الصلاحية
```

---

## 6️⃣ **فحص حالة المخزون**

### في Python Shell:

```python
python manage.py shell

# عرض المخزون الحالي
from api.models import BloodInventory
for inv in BloodInventory.objects.all():
    total = inv.available + inv.issued + inv.expired
    print(f"{inv.blood_type}: available={inv.available}, issued={inv.issued}, expired={inv.expired}, total={total}")

# عرض الأكياس حسب الحالة
from api.models import BloodBag
from django.db.models import Count
BloodBag.objects.values('blood_type', 'status').annotate(count=Count('id')).order_by('blood_type', 'status')
# النتيجة: [{'blood_type': 'A+', 'status': 'Approved', 'count': 8}, ...]
```

---

## 7️⃣ **الأسئلة الشائعة**

### ❓ لماذا الكيس الجديد (Pending) لا يؤثر على المخزون؟
**الإجابة:** لأنه قيد الاختبار المعملي، قد يرفضه المعمل.

### ❓ ماذا يحدث لو حذفت كيس Pending؟
**الإجابة:** لا شيء — لم يكن في المخزون أصلاً.

### ❓ ماذا لو كان المخزون غير متطابق مع الأكياس؟
**الإجابة:** شغّل:
```bash
python manage.py maintain_inventory --sync
```

### ❓ هل تُحذف الأكياس منتهية الصلاحية تلقائياً؟
**الإجابة:** لا، تُعلّم بـ status='Expired' فقط. تشغيل:
```bash
python manage.py maintain_inventory --process-expired
```

---

## 8️⃣ **رسم تخطيطي للتدفق الكامل**

```
┌─────────────────┐
│ تبرع جديد       │
│ BloodBag        │
│ status=Pending  │
└────────┬────────┘
         │
         ▼
    ┌──────────────────┐
    │ اختبار معملي    │
    └────┬─────────┬──────┐
         │         │      │
    ✅ APPROVED  ❌ FAILED │
         │         │      │
         ▼         ▼      ▼
    (تحديث   (حذف)  (حذف)
    المخزون)
         │
         ▼
    ┌──────────────────────┐
    │ available += 1      │
    │ BloodInventory      │
    └────────┬─────────────┘
             │
             ├─→ تسليم للمستشفى
             │   issued += 1
             │   available -= 1
             │
             └─→ انتهاء الصلاحية
                 expired += 1
                 available -= 1
```

---

## 9️⃣ **ملخص الربط النهائي**

| العملية | الملف | الحالة |
|--------|------|--------|
| إضافة تبرع | `services.add_donation_*` | ✅ |
| موافقة معملية | `services.submit_lab_result` | ✅ |
| تسليم للمستشفى | `views.HospitalDeliveryView` | ✅ |
| إضافة مستفيد | `serializers.BeneficiarySerializer` | ✅ |
| حذف مستفيد | `models.post_delete` signal | ✅ |
| حذف كيس معتمد | `models.post_delete` signal | ✅ |
| معالجة الصلاحية | `services.process_expired_bags` | ✅ |
| مزامنة المخزون | `services.sync_inventory_from_bags` | ✅ |

---

**🎉 النظام الآن مترابط بالكامل وجاهز للعمل الذكي!**
