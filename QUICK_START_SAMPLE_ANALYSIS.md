# 🚀 دليل البدء السريع - تحليل عينات الدم

## ⚡ خطوات التثبيت (5 دقائق)

### 1️⃣ تطبيق Migration
```bash
# فتح Terminal في مجلد المشروع
cd c:\Users\amrreda\Desktop\New folder

# تطبيق Migration جديدة
python manage.py migrate

# التحقق من النجاح
python manage.py showmigrations api | grep sampleanalysis
```

**النتيجة المتوقعة:**
```
✓ 0010_sampleanalysis
```

### 2️⃣ إعادة تشغيل الخادم
```bash
# إيقاف الخادم الحالي (Ctrl+C)

# تشغيل الخادم مجدداً
python manage.py runserver

# التحقق من الحالة
# يجب أن ترى: "Starting development server at http://127.0.0.1:8000/"
```

### 3️⃣ تسجيل الدخول
```
1. افتح http://localhost:8000
2. سجل دخول كمستخدم معمل
   Username: lab_user (مثال)
   Password: password
3. انتقل لوحدة الفحص المعملي
```

---

## 📊 الاختبار السريع

### اختبار 1: التحقق من الزر
✅ **الخطوات:**
1. انتقل لوحدة المعمل → جميع الأكياس
2. ابحث عن أكياس بحالة "معلق" (Pending)
3. يجب أن ترى زر "🔬 تحليل" بجانب كل كيس

### اختبار 2: فتح Modal
✅ **الخطوات:**
1. اضغط على زر التحليل
2. يجب أن يظهر نافذة بـ:
   - رقم الكيس
   - قائمة اختيار الفصيلة (O+, O-, A+, A-, B+, B-, AB+, AB-)
   - Checkboxes للأمراض (8 خيارات)
   - زر القبول والرفض

### اختبار 3: قبول عينة
✅ **الخطوات:**
1. اختر فصيلة دم (مثلاً: O+)
2. اضغط "✅ قبول العينة"
3. يجب أن:
   - يغلق النافذة
   - يظهر رسالة نجاء (أخضر)
   - يتحدث الجدول
   - يتغير الكيس للـ "معتمد"

### اختبار 4: رفض عينة
✅ **الخطوات:**
1. اضغط على زر التحليل مجدداً
2. اختر أمراض (مثلاً: HIV, Hepatitis B)
3. أدخل سبب الرفض
4. اضغط "❌ رفض العينة"
5. يجب أن:
   - يغلق النافذة
   - يظهر رسالة (زرقاء)
   - يتحدث الجدول
   - يتغير الكيس للـ "مرفوض"

---

## 🔧 الأوامر المفيدة

### عرض جميع التحليلات
```bash
curl http://localhost:8000/api/sample-analyses/ -H "Authorization: Bearer TOKEN"
```

### عرض تحليل واحد
```bash
curl http://localhost:8000/api/sample-analyses/BAG-001/
```

### حذف قاعدة البيانات والبدء من جديد
```bash
# حذف db.sqlite3
del db.sqlite3

# إعادة الـ Migrations
python manage.py migrate

# إنشاء بيانات اختبار
python manage.py seed_data
```

---

## 🐛 استكشاف الأخطاء

### ❌ الخطأ: "الجدول api_sampleanalysis غير موجود"
**الحل:**
```bash
python manage.py migrate
```

### ❌ الخطأ: "403 Forbidden"
**الحل:**
- تأكد من تسجيل دخول كمستخدم معمل (lab)
- الصلاحيات المسموحة: lab, deputy, superadmin

### ❌ الخطأ: "لا تظهر الأمراض"
**الحل:**
- أعد تحميل الصفحة (F5)
- امسح ذاكرة التخزين المؤقت (Ctrl+Shift+Delete)

### ❌ الخطأ: "الزر لا يظهر"
**الحل:**
- تأكد من وجود أكياس بحالة "Pending"
- تحقق من صلاحياتك (يجب أن تكون معمل على الأقل)

---

## 📈 البيانات المتاحة

### فصائل الدم
| الفصيلة | الكود |
|--------|------|
| O+ | O+ |
| O- | O- |
| A+ | A+ |
| A- | A- |
| B+ | B+ |
| B- | B- |
| AB+ | AB+ |
| AB- | AB- |

### الأمراض المكتشفة
| المرض | الكود |
|------|------|
| فيروس نقص المناعة | HIV |
| التهاب الكبد ب | Hepatitis B |
| التهاب الكبد ج | Hepatitis C |
| الزهري | Syphilis |
| الملاريا | Malaria |
| ملوث | Contaminated |
| منتهي الصلاحية | Expired |
| آخر | Other |

---

## 📝 الملفات المهمة

| الملف | الوصف |
|------|--------|
| `api/models.py` | نموذج SampleAnalysis (الأسطر 365-453) |
| `api/serializers.py` | SampleAnalysisSerializer |
| `api/views.py` | SampleAnalysisViewSet |
| `frontend/public/app.html` | الواجهة (Modal وأزرار) |
| `api/migrations/0010_sampleanalysis.py` | Migration جديدة |
| `CHANGELOG_LAB_MODULE.md` | التغييرات الكاملة |
| `LAB_TESTING.md` | اختبارات شاملة |

---

## 🎯 النقاط المهمة

1. ✅ **فقط** المعمل والسوبر أدمن يمكنهم تحليل العينات
2. ✅ عند القبول: الكيس يضاف للمخزون فوراً
3. ✅ عند الرفض: إشعار يصل لجميع الأدمن
4. ✅ جميع العمليات تُسجل في سجل التدقيق
5. ✅ الفصيلة المؤكدة يختارها المعمل (ليست المبدئية)

---

## 🎓 أمثلة API

### مثال 1: إنشاء تحليل جديد
```json
POST /api/sample-analyses/
{
  "bagId": "BAG-001",
  "confirmedBloodType": "O+",
  "detectedDiseases": [],
  "status": "Pending"
}
```

### مثال 2: قبول عينة
```json
PUT /api/sample-analyses/BAG-001/
{
  "confirmedBloodType": "O+",
  "detectedDiseases": [],
  "status": "Approved"
}
```

### مثال 3: رفض عينة
```json
PUT /api/sample-analyses/BAG-001/
{
  "detectedDiseases": ["HIV", "Hepatitis B"],
  "rejectionReason": "فيروسات خطيرة جداً",
  "status": "Rejected"
}
```

---

## 💡 نصائح مفيدة

1. **للاختبار السريع:**
   - استخدم بيانات الاختبار: `python manage.py seed_data`
   - غيّر المستخدم مباشرة في الـ settings

2. **لتتبع الأخطاء:**
   - افتح وحدة التحكم في المتصفح (F12)
   - انظر لـ Console و Network tabs

3. **لتحديث الواجهة:**
   - استخدم Ctrl+Shift+R (clear cache + refresh)
   - لا تستخدم F5 فقط لأنها قد تستخدم الكاش القديم

---

## ✅ قائمة المتطلبات

قبل الاستخدام:
- [ ] تم تطبيق Migration
- [ ] الخادم يعمل بدون أخطاء
- [ ] المستخدم له صلاحيات معمل
- [ ] توجد أكياس بحالة "معلق"
- [ ] المتصفح تم تحديثه

---

## 📞 الدعم والمساعدة

### المشاكل الشائعة:
- [CHANGELOG_LAB_MODULE.md](CHANGELOG_LAB_MODULE.md) - استكشاف الأخطاء الشامل
- [LAB_TESTING.md](LAB_TESTING.md) - خطة الاختبارات
- [LAB_ANALYSIS_GUIDE.md](LAB_ANALYSIS_GUIDE.md) - دليل التفاصيل الكاملة

### أوامر Django مفيدة:
```bash
# عرض جميع الـ Migrations
python manage.py showmigrations

# تطبيق Migration معينة
python manage.py migrate 0010

# الرجوع عن Migration
python manage.py migrate api 0009

# إنشاء Superuser
python manage.py createsuperuser

# فتح Django Shell
python manage.py shell
```

---

**🎉 الآن أنت جاهز للبدء!**
