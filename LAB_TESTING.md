# اختبارات نظام تحليل العينات

## 1️⃣ اختبار قاعدة البيانات

### التحقق من وجود الجدول
```bash
python manage.py dbshell
# في قاعدة البيانات
SELECT * FROM api_sampleanalysis LIMIT 1;
```

### التحقق من الـ Migration
```bash
python manage.py showmigrations api
# يجب أن نرى: ✓ 0010_sampleanalysis
```

---

## 2️⃣ اختبار الـ API

### باستخدام curl أو Postman

#### إنشاء عينة جديدة
```bash
POST /api/sample-analyses/
{
  "bagId": "BAG-TEST-001",
  "confirmedBloodType": "O+",
  "detectedDiseases": ["HIV"],
  "status": "Pending"
}

✅ يجب أن ترجع 201 Created
```

#### الحصول على العينة
```bash
GET /api/sample-analyses/BAG-TEST-001/

✅ يجب أن ترجع البيانات الكاملة
```

#### تحديث العينة (القبول)
```bash
PUT /api/sample-analyses/BAG-TEST-001/
{
  "confirmedBloodType": "O+",
  "detectedDiseases": [],
  "status": "Approved"
}

✅ يجب أن ترجع 200 OK
✅ يجب أن تضيف الكيس للمخزون
```

#### تحديث العينة (الرفض)
```bash
PUT /api/sample-analyses/BAG-TEST-002/
{
  "detectedDiseases": ["HIV", "Hepatitis B"],
  "rejectionReason": "فيروسات خطيرة جداً",
  "status": "Rejected"
}

✅ يجب أن ترجع 200 OK
✅ يجب أن تنشئ notification
```

---

## 3️⃣ اختبار الصلاحيات

### اختبار 1: مستخدم بدون صلاحية
```bash
# تسجيل دخول كمستخدم عادي (غير معمل)
POST /api/accounts/login/
{
  "username": "regular_user",
  "password": "password"
}

# محاولة الوصول
GET /api/sample-analyses/

❌ يجب أن يرجع 403 Forbidden
```

### اختبار 2: مستخدم معمل
```bash
# تسجيل دخول كمستخدم معمل
POST /api/accounts/login/
{
  "username": "lab_user",
  "password": "password"
}

# الوصول
GET /api/sample-analyses/

✅ يجب أن يرجع 200 OK
```

### اختبار 3: سوبر أدمن
```bash
# تسجيل دخول كسوبر أدمن
POST /api/accounts/login/
{
  "username": "superadmin",
  "password": "password"
}

# الوصول والتعديل
PUT /api/sample-analyses/BAG-001/

✅ يجب أن يرجع 200 OK
```

---

## 4️⃣ اختبار الواجهة (UI)

### اختبار 1: ظهور الزر
1. تسجيل دخول كمستخدم معمل ✅
2. الذهاب لوحدة الفحص المعملي ✅
3. يجب أن نرى أكياس معلقة (Pending) ✅
4. يجب أن نرى زر "🔬 تحليل" ✅

### اختبار 2: فتح Modal
1. اضغط على زر التحليل ✅
2. يجب أن يظهر Modal بـ:
   - رقم الكيس ✅
   - قائمة الفصيلة ✅
   - Checkboxes للأمراض ✅
   - زرين القبول والرفض ✅

### اختبار 3: القبول
1. اختر فصيلة دم ✅
2. اضغط "✅ قبول العينة" ✅
3. يجب أن:
   - يغلق المودال ✅
   - يظهر رسالة نجاح ✅
   - يتحدث الجدول ✅
   - يتغير الكيس للـ "معتمد" ✅

### اختبار 4: الرفض
1. اختر أمراض ✅
2. أدخل سبب الرفض ✅
3. اضغط "❌ رفض العينة" ✅
4. يجب أن:
   - يغلق المودال ✅
   - يظهر رسالة رفض ✅
   - يتحدث الجدول ✅
   - يتغير الكيس للـ "مرفوض" ✅

---

## 5️⃣ اختبار الإشعارات

### اختبار الإشعار عند الرفض
1. رفض عينة بـ HIV و Hepatitis B ✅
2. تسجيل دخول كأدمن ✅
3. الذهاب للإشعارات ✅
4. يجب أن نرى:
   - 🚫 عينة مرفوضة ✅
   - رقم الكيس ✅
   - الأمراض المكتشفة ✅
   - سبب الرفض ✅

---

## 6️⃣ اختبار المخزون

### اختبار إضافة الكيس للمخزون
1. قبول عينة بفصيلة O+ ✅
2. الذهاب للمخزون ✅
3. تحقق من:
   - O+ = Available +1 ✅
   - العدد الإجمالي +1 ✅

---

## 7️⃣ اختبار سجل التدقيق (Audit Log)

### اختبار تسجيل العمليات
1. أجرِ عملية قبول أو رفض ✅
2. الذهاب لسجل التدقيق (Audit Log) ✅
3. يجب أن نرى:
   - الطابع الزمني ✅
   - اسم المستخدم ✅
   - الصلاحية (معمل) ✅
   - نوع العملية (تحديث تحليل عينة) ✅
   - التفاصيل الكاملة ✅

---

## 8️⃣ اختبار الأخطاء المعتادة

### اختبار 1: عدم اختيار الفصيلة
```
1. اختر أمراض فقط ❌
2. اضغط القبول ❌
3. يجب أن يظهر: "يرجى اختيار فصيلة الدم المؤكدة"
```

### اختبار 2: عدم إدخال سبب الرفض
```
1. لا تدخل سبب ❌
2. اضغط الرفض ❌
3. يجب أن يظهر: "يرجى إدخال سبب الرفض"
```

### اختبار 3: الوصول غير المصرح
```
1. تسجيل دخول كمستخدم عادي ❌
2. حاول الوصول /api/sample-analyses/ ❌
3. يجب أن يرجع 403 Forbidden
```

---

## 9️⃣ Performance Testing

### اختبار السرعة
```bash
# اختبار الحمل
ab -n 100 -c 10 http://localhost:8000/api/sample-analyses/

✅ يجب أن تكون الاستجابة < 200ms
```

---

## 🔟 Integration Testing

### اختبار التكامل الكامل
```python
# في test.py

class TestSampleAnalysis(TestCase):
    def setUp(self):
        # إنشاء مستخدم معمل
        self.lab_user = Account.objects.create(
            username='lab_test',
            role='lab',
            password='test123'
        )
        
        # إنشاء كيس دم
        self.bag = BloodBag.objects.create(
            bag_id='BAG-TEST-001',
            donor='Test Donor',
            blood_type='O+',
            qty=1,
            date='2024-01-01',
            expiry='2024-02-01',
            location='Room 1',
            status='Pending'
        )

    def test_create_sample_analysis(self):
        # إنشاء تحليل جديد
        analysis = SampleAnalysis.objects.create(
            bag=self.bag,
            confirmed_blood_type='O+',
            detected_diseases=['HIV'],
            status='Pending'
        )
        
        # التحقق
        self.assertEqual(analysis.status, 'Pending')
        self.assertIn('HIV', analysis.detected_diseases)

    def test_approve_sample(self):
        # إنشاء وقبول العينة
        analysis = SampleAnalysis.objects.create(
            bag=self.bag,
            status='Pending'
        )
        
        analysis.status = 'Approved'
        analysis.confirmed_blood_type = 'O+'
        analysis.save()
        
        # التحقق من تحديث الكيس
        bag = BloodBag.objects.get(bag_id='BAG-TEST-001')
        self.assertEqual(bag.status, 'Approved')

    def test_permissions(self):
        # اختبار الصلاحيات
        self.client.force_login(self.lab_user)
        response = self.client.get('/api/sample-analyses/')
        self.assertEqual(response.status_code, 200)
```

---

## 📋 خطة التقييم

| الاختبار | الحالة | ملاحظات |
|---------|--------|---------|
| Database | ❓ | _ |
| API Creation | ❓ | _ |
| API Read | ❓ | _ |
| API Update | ❓ | _ |
| Permissions | ❓ | _ |
| UI Appearance | ❓ | _ |
| UI Interaction | ❓ | _ |
| Notifications | ❓ | _ |
| Inventory | ❓ | _ |
| Audit Log | ❓ | _ |
| Error Handling | ❓ | _ |

---

## ✅ قائمة فحص النشر

- [ ] تم تطبيق جميع الـ Migrations
- [ ] تم اختبار API endpoints
- [ ] تم اختبار الصلاحيات
- [ ] تم اختبار الواجهة
- [ ] تم اختبار الإشعارات
- [ ] تم التحقق من المخزون
- [ ] تم التحقق من سجل التدقيق
- [ ] تم التعامل مع الأخطاء
- [ ] تم توثيق جميع الميزات
- [ ] تم توثيق المشاكل المعروفة
