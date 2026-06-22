/**
 * Drop4Life — full UI locale (Arabic / English)
 */
(function (global) {
  const STORAGE_KEY = 'drop4life_locale';

  const STRINGS = {
    ar: {
      app: { title: 'بنك الدم الذكي', tagline: 'نظام إدارة وبنك الدم الذكي الإقليمي', logoTag: 'نظام التحكم في دورة حياة وحدات الدم' },
      login: {
        username: 'اسم المستخدم', password: 'كلمة المرور', submit: 'تسجيل الدخول المأمن', loading: 'جاري التحميل...',
        usernamePh: 'أدخل اسم الحساب...', remember: 'تذكرني دائماً', verifying: 'جاري التحقق من الخادم...',
        invalidResponse: 'استجابة تسجيل الدخول غير صالحة من الخادم.', sessionFailed: 'تعذر تأكيد الجلسة بعد تسجيل الدخول. أعد المحاولة.',
        invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
      },
      nav: {
        dashboard: 'لوحة الرقابة', statistics: 'الإحصائيات', donations: 'التبرعات', lab: 'المعمل',
        inventory: 'الأكياس النشطة', storage: 'التخزين', requests: 'الطلبات', hospitals: 'المستشفيات',
        donors: 'المتبرعون', beneficiaries: 'المستفيدون', audit: 'التدقيق', disposal: 'الإتلاف',
      },
      navSection: { main: 'الرئيسية', cycle: 'دورة الدم', stock: 'المخزون', dispatch: 'التوزيع', oversight: 'الرقابة' },
      topbar: {
        notifications: 'الإشعارات', messages: 'الرسائل', profile: 'الملف الشخصي', settings: 'الإعدادات',
        logout: 'تسجيل الخروج', langSwitch: 'الإنجليزية', langSwitchTitle: 'تغيير اللغة', clockLoading: 'جاري التحميل...', close: 'إغلاق',
      },
      page: {
        dashboard: { title: 'لوحة الرقابة', subtitle: 'مؤشرات حية وتدفق الدم' },
        statistics: { title: 'إحصائيات النظام', subtitle: 'أداء المعمل والمخزون والتسليمات' },
        inventory: { title: 'الأكياس النشطة', subtitle: 'متابعة الصلاحية والموقع' },
        donations: { title: 'سجل التبرعات', subtitle: 'حركات التبرع والأكياس' },
        lab: { title: 'وحدة المعمل', subtitle: 'فحص واعتماد العينات' },
        storage: { title: 'نظام التخزين', subtitle: 'الغرف والثلاجات والأرفف' },
        requests: { title: 'طلبات المستشفيات', subtitle: 'طلبات الصرف والتسليم' },
        hospitals: { title: 'المستشفيات', subtitle: 'المنشآت المرتبطة' },
        donors: { title: 'المتبرعون', subtitle: 'قاعدة بيانات المتبرعين' },
        beneficiaries: { title: 'المستفيدون', subtitle: 'صرف الدم للمرضى' },
        audit: { title: 'سجل التدقيق', subtitle: 'حركات النظام والأمان' },
        disposal: { title: 'سجل الإتلاف', subtitle: 'الأكياس المستبعدة' },
        notifications: { title: 'الإشعارات', subtitle: 'تنبيهات النظام' },
        messages: { title: 'الرسائل', subtitle: 'محادثات الفريق' },
        profile: { title: 'الملف الشخصي', subtitle: 'بيانات الحساب' },
        settings: { title: 'إعدادات الثيم', subtitle: 'الألوان والمظهر' },
        'admin-settings': { title: 'إعدادات المسؤول', subtitle: 'إعدادات متقدمة' },
        default: { title: 'النظام الرئيسي', subtitle: '' },
      },
      dashboard: {
        criticalBanner: { title: 'إشعار عاجل للعمليات:', body: 'توجد فصائل دموية حرجة انخفضت دون حد الأمان الطبي الأدنى. يرجى مراجعة حملات التبرع فوراً.' },
        stat: {
          totalUnits: 'المخزون الإجمالي المتاح', donors: 'إجمالي المتبرعين المسجلين', pendingLab: 'أكياس في الفحص المعملي',
          hospitals: 'عدد المستشفيات', requests: 'طلبات صرف الدم للمستشفيات',
          unit: { bag: 'كيس', donor: 'متبرع', hospital: 'مستشفى', request: 'طلب' },
        },
        matrixTitle: '🚨 مراقبة توهج المخزون الحي (تنبيه مرئي ذكي عند الخطر)',
        aiLoading: 'جاري تحميل نموذج التنبؤ الذكي...',
        bloodOutputThisMonth: 'هذا الشهر', bloodOutputHospitalsMonth: 'مستشفيات (شهر)', bloodOutputBeneficiariesMonth: 'مستفيدون (شهر)',
        navInventory: 'انتقل إلى جرد المخزون', navDonors: 'انتقل إلى قاعدة المتبرعين', navLab: 'انتقل إلى وحدة الفحص المعملي',
        navHospitals: 'انتقل إلى المنشآت الطبية', navRequests: 'انتقل إلى طلبيات المستشفيات',
        urgentEmpty: 'لا توجد طلبات طوارئ حرجة معلقة بالمنظومة حالياً. هندسة المخزون مستقرة.',
      },
      chart: {
        bloodInventory: 'جرد الأكياس حسب الفصائل', requestTypes: 'طلبات المستشفيات حسب النوع', labOutcomes: 'نتائج الفحص المعملي',
        bloodOutputMonthly: 'إخراج الدم شهرياً (آخر 12 شهر)',
        priority: { normal: 'عادي', urgent: 'هام', critical: 'حرج' },
        lab: { pending: 'قيد الفحص', approved: 'معتمد', rejected: 'مرفوض' },
        bloodOutput: { hospitals: 'مستشفيات', beneficiaries: 'مستفيدون' },
      },
      product: { Whole: 'وحدة دم كاملة', RBC: 'كرات دم حمراء', Plasma: 'بلازما', Platelets: 'صفائح دموية', RBCshort: 'كرات حمراء', Plateletsshort: 'صفائح' },
      blood: { pending: 'قيد التحليل', pendingTitle: 'بانتظار نتيجة المعمل', unknown: 'غير محددة' },
      donor: { unknown: 'مجهول' },
      common: {
        edit: 'تعديل', cancel: 'إلغاء', save: 'حفظ', add: 'إضافة', delete: 'حذف', search: 'بحث', close: 'إغلاق',
        bags: 'كيس', units: 'وحدة', years: 'سنة', full: 'ممتلئة', fullParen: '(ممتلئة)', empty: '—', none: 'لا يوجد',
        actions: 'إجراءات', loading: 'جاري التحميل...', user: 'مستخدم', unknownUser: 'غير معروف', days: 'يوم', times: 'مرات',
        noFridges: '— لا توجد ثلاجات متاحة —', unspecified: 'غير محدد',
      },
      btn: {
        edit: 'تعديل', delete: 'حذف', approve: 'قبول', reject: 'رفض', deliver: 'تسليم', analyze: 'تحليل',
        secureDispense: '✓ صرف مأمن ومباشر', saveChanges: 'حفظ التغييرات', saveRecord: 'حفظ السجل',
        addDonation: '+ تسجيل تبرع جديد', addBeneficiary: '➕ إضافة مستفيد', addRequest: '+ إنشاء طلب صرف جديد',
        addHospital: '+ إضافة مستشفى جديد', addAccount: '+ إضافة حساب جديد', saveAccount: '💾 حفظ الحساب الجديد',
        confirmDispose: '🗑️ تأكيد الإتلاف', confirmExecute: 'تأكيد التنفيذ', labReject: '❌ رفض', labApprove: '✅ قبول',
        clearLogs: 'مسح السجلات', clearNotifications: 'مسح كل الإشعارات', clearMessages: 'مسح كل الرسائل',
        saveStorage: 'حفظ التغييرات', deleteAccount: '🗑️ حذف الحساب',
        submitDonation: '💾 إرسال للمعمل / إضافة للمخزن', saveBeneficiary: '💾 حفظ المستفيد',
        deleteBag: '🗑️ حذف الكيس', saveBagEdit: '💾 حفظ التعديلات', sendRequest: '📨 إرسال وبث الطلب للنظام',
        confirmDelivery: '🚚 تأكيد التسليم', saveDonor: '💾 حفظ وقيد المتبرع', saveHospital: '💾 حفظ المستشفى',
        addRoom: '+ إضافة غرفة', editRoom: '✏️ تعديل', lockRoom: '🔒 قفل',
      },
      storage: {
        overview: '🗄️ نظرة عامة على التخزين', fridges: 'ثلاجات', capacity: 'السعة', occupied: 'شغل',
        unitsUsed: 'وحدة مستخدمة', fridgeFull: 'ممتلئة بالكامل', roomCapacity: 'سعة الغرفة',
        hint: {
          multiUnit: 'كل وحدة دم كاملة = {wholeUnits} خانات تخزين. {qty} وحدة = {unitsNeeded} خانة مطلوبة. متاح حالياً: {available} خانة.',
          singleUnit: 'وحدة دم كاملة = {wholeUnits} خانات. متاح: {available} خانة في {room} / {fridge}.',
        },
        dirtyBanner: '⚠️ لديك تغييرات غير محفوظة — اضغط «حفظ التغييرات» قبل مغادرة الصفحة',
        roomCount: '🏠 عدد الغرف:', fridgesPerRoom: '🧊 الثلاجات لكل غرفة:', shelvesPerFridge: '📦 الأرفف لكل ثلاجة:', capacityPerShelf: '📊 السعة لكل رف:',
        configTitle: '🗄️ معلومات نظام التخزين',
        selectFridge: 'يرجى اختيار الثلاجة.',
        selectLocation: 'يرجى اختيار موقع التخزين.',
        roomFull: '⚠️ هذه الغرفة ممتلئة بالكامل — جميع الثلاجات فيها ممتلئة.\n\nيرجى اختيار غرفة أخرى.',
        roomCapacity: '⚠️ الغرفة {room} لا تتسع لـ {qty} وحدة (تحتاج {needed} مكان — المتبقي {remaining}).',
        fridgeFull: '⚠️ الثلاجة {fridge} ممتلئة.{suggestion}\n\nيرجى اختيار ثلاجة أخرى.',
        notEnoughSlots: '⚠️ لا توجد أماكن كافية لـ {qty} وحدة (تحتاج {needed} مكان — متاح {available}).{suggestion}',
        fridgeCapacity: '⚠️ الثلاجة {fridge} لا تتسع (تحتاج {needed} مكان — المتبقي {available}).{suggestion}',
        availableFridges: 'ثلاجات متاحة في نفس الغرفة: {list}.',
        noRooms: 'لا توجد غرف — اضغط «+ إضافة غرفة» لبدء الإعداد',
        roomDetails: '📋 تفاصيل الغرف والثلاجات',
        bagsLinked: '{count} كيس مرتبط بهذه الغرفة',
        shelvesLabel: 'أرفف', capPerShelfLabel: 'سعة/رف',
        roomName: 'اسم الغرفة', totalCapacity: 'السعة الكلية', fridgeCount: 'عدد الثلاجات',
        fridgeDetails: 'تفاصيل الثلاجات (أرفف × سعة)',
        shelvesPerFridgeShort: 'الأرفف لكل ثلاجة',
        validationFull: '⚠️ المخزون ممتلئ بالكامل — جميع الغرف والثلاجات ممتلئة.\n\nلا يمكن إدخال أي أكياس دم جديدة.',
      },
      ai: {
        emptyStable: 'لا توجد تنبؤات حالياً — المخزون مستقر.',
        loadFailed: 'تعذر تحميل التنبؤات',
        defaultTitle: 'تنبؤ',
      },
      cards: {
        aiPredictions: '🤖 تحليلات التنبؤ بالذكاء الاصطناعي', statisticsOverview: '📈 إحصائيات الرؤية الطبية الذكية',
        bloodOutput: '🩸 إخراج الدم من النظام (تسليمات + مستفيدون)',
        donations: '💉 السجل الطبي العام لحركات التبرع والأكياس', addDonation: 'تسجيل تبرع جديد',
        donors: '👥 السجل الموحد للمتبرعين', beneficiaries: '🩸 المستفيدون', addBeneficiary: 'إضافة مستفيد',
        disposal: '🗑️ سجل الإتلاف والتخلص البيولوجي الآمن للمخلفات', audit: '📜 سجل الأمان والتدقيق الشامل',
        inventoryBags: '🧪 نظام إدارة الأكياس الذكي مع تتبع الصلاحية', inventorySummary: '📊 ملخص المخزون حسب الفصيلة',
        lab: '🔬 وحدة الفحوصات المعملية — تحليل العينات', requests: '🏥 طلبات صرف الدم للمستشفيات الخارجية والمحلي',
        hospitals: '🏥 قواعد المستشفيات المرتبطة', hospitalDeliveries: '📦 سجل تسليم طلبات المستشفيات',
        notifications: '🔔 لوحة الإشعارات المركزية', profile: '👤 الملف الشخصي الخاص بك', adminSettings: '⚙️ إعدادات المسؤول العام',
        accountsMgmt: '👥 إدارة الحسابات والمستخدمين', superAdminActions: '🔐 إجراءات المسؤول الأعلى الحساسة',
      },
      search: {
        inventory: 'البحث الذكي برقم الكيس، الفصيلة، أو اسم المتبرع...',
        donations: 'البحث الذكي في سجل التبرعات (الكود، المتبرع، الفصيلة، الموقع)',
        lab: 'ابحث برقم الكيس أو اسم المتبرع...', requests: 'ابحث في طلبات الصرف بالاسم أو الفصيلة أو الحالة...',
        hospitals: 'ابحث باسم المستشفى أو العنوان أو الهاتف...', hospitalDeliveries: 'ابحث في سجلات التسليم بالمستشفى أو اسم المستلم...',
        donors: 'ابحث في قاعدة المتبرعين بالاسم أو الفصيلة أو الهاتف...',
        beneficiaries: 'ابحث بالاسم أو الهاتف أو رقم البطاقة أو الفصيلة...',
        audit: 'ابحث في السجل...', disposal: 'ابحث في سجل الاتلاف بالرقم أو الفصيلة أو السبب...',
        accounts: 'ابحث في الحسابات والموظفين...',
      },
      filter: {
        allBloodTypes: 'كل الفصائل', allProducts: 'كل المكونات', allActiveStatuses: 'كل الحالات النشطة',
        allStatuses: 'كل الحالات', approved: 'معتمد ✅', pending: 'قيد الفحص ⏳', reserved: 'محجوز 📌', rejected: 'مرفوض ❌',
      },
      table: {
        bagId: 'كود الكيس', donor: 'المتبرع', component: 'المكون', bloodType: 'الفصيلة', qty: 'الكمية',
        date: 'التاريخ', status: 'الحالة', location: 'الموقع', actions: 'إجراءات', bagStatus: 'حالة الكيس',
        storageLocation: 'موقع التخزين الثلاجي', name: 'الاسم', phone: 'الهاتف', nationalId: 'رقم البطاقة', age: 'العمر', address: 'العنوان',
        lastDonation: 'آخر تبرع', donationCount: 'عدد التبرعات', fileNo: 'رقم الملف', fullName: 'الاسم الكامل',
        expiry: 'تاريخ الصلاحية', daysLeft: 'الأيام المتبقية', daysLeftUnit: 'يوم', labStatus: 'حالة الفحص', addDate: 'تاريخ الإضافة',
        requestId: 'كود الطلب', hospital: 'المستشفى', destinationHospital: 'المستشفى الوجهة', priority: 'الأولوية',
        available: 'المتاح', reserved: 'المحجوز', issued: 'المصروف', expired: 'المنتهي',
        medicalStatus: 'الحالة الطبية', recipient: 'المستلم', recipientPhone: 'هاتف المستلم',
        diseases: 'الأمراض المكتشفة', disposalDate: 'تاريخ الإتلاف', reason: 'سبب الاستبعاد', worker: 'الموظف',
        source: 'المصدر', count: 'العدد', consumed: 'عدد الأكياس', consumedType: 'نوع الفصيلة المستهلكة', registeredAt: 'تاريخ التسجيل',
        timestamp: 'الطابع الزمني', role: 'الصلاحية', actionType: 'نوع الحركة الإجرائية', actionDetails: 'بيانات الحركة التفصيلية',
        damagedBagId: 'كود الكيس التالف', bagType: 'نوع الكيس', medicalReason: 'سبب الاستبعاد الطبي', responsibleWorker: 'الموظف المسؤول',
        hospitalName: 'اسم المستشفى', managerName: 'اسم المدير', username: 'اسم المستخدم', email: 'البريد الإلكتروني', accountStatus: 'حالة الحساب',
      },
      form: {
        label: {
          username: 'اسم المستخدم', fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', password: 'كلمة المرور',
          role: 'الصلاحية الحالية', roleSelect: 'الصلاحية', newPassword: 'تحديث كلمة المرور', newPasswordOptional: 'تعيين كلمة مرور جديدة (اتركها فارغة للاحتفاظ بالحالية)',
          accountStatus: 'حالة الحساب', component: 'نوع المكون', labBloodType: 'فصيلة الدم (إلزامي — يحددها المعمل)',
          diseases: 'الأمراض المكتشفة', labNotes: 'ملاحظات الفحص الاستبعادية', bagCode: 'كود الكيس', bagType: 'نوع الكيس',
          disposalMedicalReason: 'السبب الطبي للتخلص', disposeReason: 'سبب الإتلاف (إلزامي)', entryType: 'نوع الإدخال',
          qty: 'الكمية (وحدات)', selectRoom: 'اختر الغرفة', selectFridge: 'اختر الثلاجة', fullNameTriple: 'الاسم ثلاثي',
          nationalId: 'الرقم القومي', age: 'العمر', phone: 'رقم الهاتف', address: 'العنوان', bagId: 'رقم الكيس',
          addDate: 'تاريخ الإضافة', expiryDate: 'تاريخ الصلاحية', location: 'الموقع', status: 'الحالة', name: 'الاسم',
          bloodType: 'الفصيلة', bagsConsumed: 'عدد الأكياس المستهلكة',
          donor: 'المتبرع', hospital: 'المستشفى', hospitalName: 'اسم المستشفى', manager: 'المدير',
          hospitalSearch: 'اختر مستشفى من الشبكة (بحث سريع وذكي)', requiredBloodType: 'الفصيلة المطلوبة',
          qtyBags: 'الكمية (أكياس)', requestPriority: 'درجة الأولوية الطبية للطلب', recipient: 'المستلم',
          notesOptional: 'ملاحظات إضافية (اختياري)', fullNameQuad: 'الاسم رباعي', verifiedBloodType: 'فصيلة الدم الموثقة',
          ageYears: 'العمر السني', emergencyPhone: 'رقم الهاتف للتواصل الطارئ', nationalIdCard: 'رقم البطاقة',
          requestId: 'رقم الطلب',
        },
        placeholder: {
          newPassword: 'كلمة مرور جديدة', usernameExample: 'مثال: doctor_ali', fullNameQuad: 'الاسم الرباعي...',
          strongPassword: 'كلمة مرور قوية', superAdminPassword: 'كلمة مرور المسؤول الأعلى', bagCodeExample: 'مثال: كيس-٠٠٣',
          disposalReason: 'أسباب مثل تلوث أو فحص غير مقبول', disposeReasonText: 'اكتب سبب الإتلاف الطبي...',
          labRejectReason: 'اكتب السبب عند الرفض...', selectBloodType: '— اختر الفصيلة —',
          fullName: 'الاسم الكامل', nationalId14: '14 رقم', phone11: '01xxxxxxxxx', addressFull: 'محافظة - مدينة - عنوان',
          hospitalSearch: 'اكتب اسم المستشفى...', recipientName: 'اكتب اسم المستلم', deliveryNotes: 'مثلاً: وصل لمندوب الاستقبال',
          hospitalNameExample: 'مثال: مستشفى السلام العام', hospitalAddressExample: 'مثال: شارع الجيش، أسيوط',
          managerExample: 'مثال: د. أحمد سمير', hospitalPhoneExample: 'مثال: 088-1234567',
        },
        entryBag: 'إضافة كيس/أكياس', entryDonor: 'تسجيل متبرع',
      },
      modal: {
        addAccount: { title: '➕ إضافة حساب', subtitle: 'مستخدم جديد للنظام' },
        sensitiveAction: { title: 'إجراء حساس', subtitle: 'يتطلب تأكيد كلمة مرور المسؤول الأعلى', hint: 'أدخل كلمة المرور لتأكيد العملية.', verifyHint: 'لن يتم تنفيذ الإجراء إلا بعد التحقق من كلمة مرور المسؤول الأعلى.' },
        editAccount: { title: 'تحرير بيانات الحساب', subtitle: 'تعديل الصلاحيات وبيانات المستخدم' },
        donorProfile: { title: 'تاريخ بروفايل المتبرع', subtitle: 'سجل التبرعات والبيانات الأساسية', totalDonations: 'إجمالي مرات التبرع بالمنظومة:', lastDonation: 'تاريخ آخر حركة تبرع مسجلة:', closeWindow: 'إغلاق النافذة' },
        labTest: { title: '🔬 تحليل العينة', subtitle: 'فحص وقبول أو رفض العينة', splitHint: 'عند الاعتماد ستُقسَّم الوحدة تلقائياً إلى: كرات حمراء + بلازما + صفائح دموية وتدخل المخزون بالفصيلة المحددة.' },
        disposeBag: { title: '🗑️ إتلاف كيس دم', subtitle: 'سيُخصم من المخزون ويُسجَّل في سجل الإتلاف' },
        addDonation: { title: '💉 تسجيل تبرع', subtitle: 'إضافة كيس أو تسجيل متبرع جديد' },
        clearNotifications: { title: 'مسح كل الإشعارات', message: 'سيتم حذف جميع الإشعارات من النظام بعد إدخال كلمة المرور الصحيحة.' },
        clearLogs: { title: 'مسح السجلات', message: 'سيتم حذف جميع سجلات التدقيق والإتلاف من قاعدة البيانات بعد إدخال كلمة المرور الصحيحة.' },
        clearMessages: { title: 'مسح كل الرسائل', message: 'سيتم حذف جميع رسائل المحادثة من النظام بعد إدخال كلمة المرور الصحيحة.' },
        editBag: { title: '✏️ تعديل كيس الدم', subtitle: 'تحديث تفاصيل الكيس' },
        addBeneficiary: { title: '➕ إضافة مستفيد', subtitle: 'تسجيل مستفيد جديد' },
        editBeneficiary: { title: '✏️ تعديل المستفيد', subtitle: 'تحديث بيانات المستفيد' },
        editDonor: { title: '✏️ تعديل المتبرع', subtitle: 'تحديث بيانات المتبرع' },
        editHospital: { title: '✏️ تعديل المستشفى', subtitle: 'تحديث بيانات المستشفى' },
        editRequest: { title: '✏️ تعديل طلب الصرف', subtitle: 'تحديث بيانات الطلب' },
        editDisposal: { title: '✏️ تعديل سجل الإتلاف', subtitle: 'تحديث بيانات الإتلاف' },
        addRequest: { title: '📋 طلب مستشفى', subtitle: 'مراجعة وإرسال طلب صرف' },
        deliverRequest: { title: '🚚 تسليم الطلب', subtitle: 'تأكيد تسليم طلب المستشفى' },
        addDonor: { title: '👥 تسجيل متبرع', subtitle: 'إضافة متبرع لقاعدة البيانات' },
        addHospital: { title: '🏥 مستشفى جديد', subtitle: 'إضافة مستشفى للشبكة' },
      },
      donation: {
        bagModeHint: 'تُسجَّل <strong>وحدة دم كاملة</strong> وتُرسَل للمعمل. عند الاعتماد تُقسَّم تلقائياً إلى كرات حمراء + بلازما + صفائح.',
        donorModeHint: 'تُسجَّل عينة <strong>وحدة دم كاملة</strong> للمعمل — التقسيم للمكونات يتم عند الاعتماد.',
      },
      priority: {
        critical: '🔴 حرجة — طوارئ وغرف العمليات الفورية',
        high: '🟠 عالية الأهمية — خلال 6 ساعات',
        medium: '🟡 متوسطة الاستحقاق — 24 ساعة',
        low: '🟢 منخفضة الأولوية — عمليات مجدولة لاحقاً',
        badgeCritical: '🔴 طوارئ حرجة',
        badgeHigh: '🟠 عالية',
        badgeMedium: '🟡 متوسطة',
        badgeLow: 'منخفضة',
      },
      chat: {
        empty: 'لا توجد رسائل بعد — ابدأ المحادثة الآن',
        title: '💬 المحادثة الجماعية للفريق',
        tabGroup: 'محادثة الفريق',
        tabPrivate: 'رسالة خاصة',
        privateTitle: '💬 رسالة خاصة',
        privateWith: 'محادثة خاصة مع {name}',
        privateHint: 'الرسائل الخاصة متاحة فقط بينك وبين المسؤول الأعلى',
        selectContact: 'اختر المستخدم',
        placeholderPrivate: 'اكتب رسالة خاصة...',
        privateDenied: 'لا يمكنك إرسال رسائل خاصة إلا للمسؤول الأعلى.',
        livePrefix: 'متصل مباشرة —',
        activeAccounts: '{count} حساب نشط',
        allCloud: 'جميع الحسابات في السحابة',
        placeholder: 'اكتب رسالة...',
        sendTitle: 'إرسال',
        view: 'مشاهدة',
        seenBy: 'شوهد بواسطة:',
        notSeenYet: 'لم يُشاهد بعد',
        liveUpdate: 'تحديث لحظي كل {seconds} ثوانٍ',
        systemSender: '📢 النظام',
        delete: 'حذف من النظام',
        deleteConfirm: 'هل تريد حذف هذه الرسالة من النظام؟ لا يمكن التراجع عن هذا الإجراء.',
      },
      render: {
        reservedForRequest: 'محجوز لطلب',
        labPendingReservation: 'قيد الحجز المعملي',
        noPreviousDonation: 'لا يوجد تبرع سابق',
        donorProfileTitle: 'الملف الطبي: {name}',
        donorProfileCount: '{count} مرات تبرع سابقة بالمنظومة',
        hospitalTotalRequests: 'إجمالي طلبات: {count} | أكياس مطلوبة: {bags}',
        notAvailable: 'غير متاح',
        beneficiaryCount: '{count} مستفيد',
        beneficiaryCountPlural: '{count} مستفيدين',
        noBeneficiaries: 'لا يوجد مستفيدون',
        stockAvailable: '{type} — متاح: {available} ({product})',
        stockUnavailable: '{type} — غير متوفر في المخزون',
        stockNotInInventory: 'فصيلة {blood} ({product}) غير موجودة في المخزون.',
        stockSufficient: '✅ المخزون كافٍ — متاح {available} كيس من {blood}، سيتم خصم {bags} كيس عند الحفظ.',
        editAccountTitle: 'تحرير بيانات: {name}',
        nationalIdLabel: 'الرقم القومي:',
        alternatives: 'بدائل: {list}',
        noAlternatives: 'لا بدائل كافية.',
        detectedDiseases: 'الأمراض المكتشفة: {diseases}',
        cleanApproval: 'اعتماد سليم',
        newBloodRequest: '🏥 طلب دم جديد',
        requestBroadcast: '{id}: {hospital} — {qty} {product} {blood} ({priority}) — بواسطة {actor}',
        requestApprovedNotif: '✅ تم قبول الطلب',
        requestApprovedBody: '{id} — تم القبول — بواسطة {actor}',
        requestRejectedNotif: '❌ تم رفض الطلب',
        requestRejectedBody: '{id} — تم الرفض — بواسطة {actor}',
        requestDeliveredNotif: '🚚 تم تسليم الطلب',
        requestDeliveredBody: '{id} إلى {recipient} — بواسطة {actor}',
        backupTitle: 'نسخ احتياطي',
        backupBody: 'طلب نسخ احتياطي — البيانات محفوظة في db.sqlite3 على الخادم.',
      },
      auditAction: {
        addHospital: 'إضافة مستشفى',
        editBag: 'تعديل بيانات كيس',
        addBeneficiary: 'تسجيل مستفيد',
        editBeneficiary: 'تعديل مستفيد',
        deleteBeneficiary: 'حذف مستفيد',
        addAccount: 'إضافة حساب',
        updateAccount: 'تحديث حساب',
        deleteAccount: 'حذف حساب',
        loginSuccess: 'تسجيل دخول ناجح',
        loginDetails: 'دخول للمنظومة عبر API.',
        logout: 'تسجيل خروج',
        logoutDetails: 'خروج من المنظومة.',
      },
      section: {
        hospitalsHint: 'أضف مستشفى جديد مع الاسم، العنوان، ورقم الهاتف، وراجع المكتبة الحالية.',
        deliveriesHint: 'سجل تسليم الطلبات مع بيانات المستلم وتاريخ التسليم.',
        auditAdminOnly: 'عرض للمسؤولين فقط', auditHint: 'يمكنك البحث عن عمليات محددة حسب الموظف أو نوع الحركة أو تفاصيل الحدث.',
        disposalHint: 'لأي كيس يُرسل للتخلص، يجب إدخال سبب طبي واضح قبل الحفظ.',
        labSummary: '📋 ملخص الفحوصات:', labPending: 'عدد الأكياس المعلقة', labApproved: 'المعتمدة', labRejected: 'المرفوضة',
        labSummaryLine: '📋 {summary} {pendingLabel} {pending} | {approvedLabel} {approved} | {rejectedLabel} {rejected}',
        passwordRequired: 'يتطلب كلمة المرور', superAdminSecurityHint: 'الأزرار الخاصة بمسح الإشعارات والرسائل والسجلات ظهرت الآن داخل كل قسم منها.',
        roleSuperAdmin: '🔐 المسؤول الأعلى',
        roleAdmin: '👨‍💼 مسؤول — إدارة المستخدمين والطلبات', roleLab: '🔬 معمل — فحوصات وتحليل فقط',
        accountActive: '✅ نشط', accountInactive: '❌ معطل',
      },
      badge: {
        requestPending: 'قيد المراجعة', requestApproved: 'تم القبول', requestRejected: 'تم الرفض', requestDelivered: 'تم التسليم', requestInProgress: 'قيد التجهيز والتعبئة',
        bagApproved: 'معتمد ✅', bagPending: 'قيد الفحص ⏳', bagReserved: 'محجوز 📌',
        labPending: 'قيد الفحص ⏳', labApproved: 'معتمد ✅',         labRejected: 'مرفوض ❌',
        donationPending: 'قيد الفحص ⏳', donationApproved: 'معتمد ✅', donationReserved: 'محجوز 📌',
        priorityLow: 'عادي', priorityMedium: 'هام', priorityHigh: 'حرج', priorityCritical: 'طوارئ حرجة',
        inventorySafe: 'آمن ✅', inventoryLow: 'منخفض ⚠️', inventoryCritical: 'حرج 🚨',
        accountActive: '✅ نشط', accountInactive: '❌ معطل',
      },
      role: { superadmin: 'المسؤول الأعلى', admin: 'مسؤول', lab: 'معمل' },
      roleCode: { DR: 'مسؤول أعلى', ADM: 'مسؤول', MLS: 'معمل' },
      empty: {
        beneficiaries: 'لا توجد سجلات مستفيدين مطابقة.', donors: 'لم يتم العثور على متبرعين.',
        donations: 'لا توجد سجلات تبرع مطابقة.', inventory: 'لا توجد أكياس مطابقة.',
        requests: 'لم يتم العثور على طلبات.', lab: 'لا توجد عينات مطابقة.',
        labExtended: 'لا توجد أكياس مطابقة. المختبر فارغ أو لا توجد نتائج بحث.',
        requestsSearch: 'لم يتم العثور على طلبات تطابق معايير البحث.',
        hospitalsSearch: 'لم يتم العثور على مستشفيات تطابق البحث.',
        deliveries: 'لا توجد سجلات تسليم حالياً.',
        auditDenied: '⚠️ حجب أمني: عذراً، لا تمتلك صلاحيات كافية للوصول إلى سجل الأمان والتدقيق الشامل.',
        audit: 'لا توجد سجلات مطابقة للمعايير الحالية.',
        disposalSearch: 'لم يتم العثور على سجلات إتلاف تطابق البحث.',
        notifications: 'لا توجد إشعارات حالياً.',
        bloodOutputDeliveries: 'لا توجد تسليمات مسجلة بعد.',
      },
      msg: {
        beneficiary: {
          addDenied: 'فقط المسؤول الأعلى أو المسؤول يمكنه إضافة مستفيدين.',
          editDenied: 'فقط المسؤول الأعلى أو المسؤول يمكنه تعديل المستفيدين.',
          deleteDenied: 'فقط المسؤول الأعلى أو المسؤول يمكنه حذف المستفيدين.',
          noStock: 'لا يوجد مخزون متاح من أي فصيلة دم حالياً. لا يمكن تسجيل مستفيد جديد.',
          bloodRequired: 'يرجى اختيار فصيلة الدم.',
        },
        hospital: { fieldsRequired: 'يرجى إدخال جميع بيانات المستشفى.' },
        form: { requiredFields: 'يرجى ملء جميع الحقول المطلوبة.', requiredFieldsBang: 'يرجى ملء جميع الحقول المطلوبة!' },
        profile: { passwordMin: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل.' },
        bag: {
          disposeDenied: 'فقط المسؤول أو المسؤول الأعلى يمكنه إتلاف أكياس من المخزون.',
          notFound: 'الكيس غير موجود.', stillInLab: 'الكيس لا يزال في المعمل. استخدم رفض التحليل لإتلافه.',
          disposeReasonRequired: 'يرجى كتابة سبب الإتلاف.', notInInventory: 'الكيس غير موجود في المخزون.',
          editDenied: 'فقط المسؤول الأعلى يمكنه تعديل بيانات الكيس.',
        },
        disposal: { bagAndReasonRequired: 'يرجى إدخال كود الكيس وسبب التخلص الطبي' },
        lab: {
          bloodTypeRequired: 'يجب على المعمل اختيار وتأكيد فصيلة الدم.',
          rejectReasonRequired: 'يجب كتابة سبب الرفض أو تحديد الأمراض المكتشفة.',
          diseaseBlocksApprove: 'لا يمكن اعتماد الكيس إذا تم تحديد أمراض مكتشفة. اختر رفضاً أو أزل الأمراض المحددة.',
        },
        storage: {
          full: '⚠️ المخزون ممتلئ بالكامل — جميع الغرف والثلاجات ممتلئة.\n\nلا يمكن إدخال أي أكياس دم أو تسجيل متبرعين جدد حتى يتم تفريغ مساحة.',
          donorSlotFull: '⚠️ المخزون ممتلئ — كيس الدم الكامل يحتاج 3 أماكن تخزين ولا يمكن إضافته حتى يتم تفريغ مساحة.',
          roomFridgeRequired: 'يرجى اختيار الغرفة والثلاجة.', locationRequired: 'يرجى اختيار موقع التخزين.',
          roomHasBags: 'لا يمكن حذف غرفة تحتوي على أكياس مخزنة.', roomRequired: 'يرجى إضافة غرفة واحدة على الأقل قبل الحفظ.',
          shelfCapacityRequired: 'يرجى إدخال سعة صحيحة لكل رف.',
        },
        donor: { nameNationalRequired: 'يرجى إدخال الاسم والرقم القومي.', unknown: 'مجهول' },
        request: {
          hospitalRequired: 'يرجى اختيار مستشفى صالح من القائمة قبل إرسال الطلب.',
          approveDenied: 'فقط المسؤول الأعلى يمكنه الموافقة على الطلبات.',
          rejectDenied: 'فقط المسؤول الأعلى يمكنه رفض الطلبات.',
          alreadyDelivered: 'هذا الطلب تم معالجته وتسليمه مسبقاً.',
          deliverAfterApproveOnly: 'زر التسليم يظهر فقط بعد قبول الطلب.',
          deliverApprovedOnly: 'التسليم متاح بعد قبول الطلب فقط.',
          deliverMustBeApproved: 'لا يمكن تسليم الطلب إلا بعد قبوله.',
        },
        delivery: { recipientRequired: 'يرجى إدخال اسم المستلم ورقم الهاتف.', editUnavailable: 'تعديل سجل التسليم متاح عبر الحذف وإعادة الإدخال حالياً.' },
        admin: {
          clearAllDenied: 'فقط المسؤول الأعلى يمكنه مسح جميع البيانات.',
          superOnly: 'فقط المسؤول الأعلى يمكنه تنفيذ هذه العملية.',
          actionUnknown: 'تعذر تحديد العملية المطلوبة.', passwordRequired: 'يرجى إدخال كلمة المرور.',
        },
        account: {
          superAdminDeleteBlocked: '❌ لا يمكن حذف حساب المسؤول الأعلى الرئيسي!',
          superAdminCreateBlocked: '❌ لا يمكن إنشاء حساب مسؤول أعلى من هنا.',
          superAdminPromoteBlocked: '❌ لا يمكن ترقية حساب إلى مسؤول أعلى.',
        },
        validation: {
          phone11: '{field} يجب أن يكون 11 رقماً بالضبط.', nationalId14: '{field} يجب أن يكون 14 رقماً بالضبط.',
          phone: 'رقم الهاتف', nationalId: 'الرقم القومي',
        },
        confirm: {
          deleteBag: 'هل أنت متأكد من حذف كيس الدم {id}؟\n\nسيتم:\n• حذف الكيس نهائياً\n• خصمه من المخزون\n• إزالته من الثلاجة\n• إلغاء ارتباطه بالطلبات والمستفيدين',
          deleteBeneficiary: 'هل أنت متأكد من حذف المستفيد {name}؟\nسيتم استعادة {bags} كيس من {blood} إلى المخزون.',
          deleteBeneficiaryShort: 'هل أنت متأكد من حذف المستفيد {name}؟ سيتم استعادة الأكياس للمخزون.',
          deleteDonor: 'هل أنت متأكد من حذف المتبرع {id}؟', deleteHospital: 'هل أنت متأكد من حذف المستشفى {name}؟',
          deleteRequest: 'هل أنت متأكد من حذف الطلب {id}؟', deleteDisposal: 'هل أنت متأكد من حذف سجل الإتلاف؟',
          deleteDelivery: 'هل أنت متأكد من حذف سجل التسليم {id}؟',
          clearAllData: 'هل أنت متأكد من مسح جميع بيانات التشغيل؟ سيتم حذف السجلات وبيانات المستخدمين غير المسؤول الأعلى والجلسات الحالية.',
          deleteAccount: 'هل أنت متأكد من حذف حساب {name}؟',
        },
        inventory: { insufficient: 'المخزون غير كافٍ. مطلوب {required} والمتاح {available}. {alt}', insufficientDetail: 'المخزون غير كافٍ. متاح {available} من {bloodType} ({product})، مطلوب {bagsNeeded}.' },
        api: { loadFailed: 'تعذر تحميل ملف API. أعد تحميل الصفحة بعد تشغيل السيرفر.', serverRequired: 'تعذر تحميل ملف API. تأكد أن الخادم يعمل وأنك فتحت الموقع من نفس العنوان.', connectionFailed: 'تعذر الاتصال بالخادم. تحقق من تشغيل السيرفر.', httpError: 'خطأ {status}', bootstrapFailed: 'تعذر تحميل بيانات النظام. حاول التحديث أو تواصل مع الدعم.' },
      },
      toast: {
        loginSuccess: '✅ تم تسجيل الدخول', loginWelcome: 'مرحباً {name}!', accessDeniedTitle: '⛔ وصول مرفوض', accessDeniedBody: 'ليس لديك صلاحية لهذا القسم.',
        loadErrorTitle: 'خطأ في التحميل', loadFailed: 'تعذر تحميل البيانات.', forbiddenTitle: 'غير مسموح', sessionExpiredTitle: 'انتهت الجلسة',
        bloodTypeReport: 'تقرير فصيلة {type}', hospitalAdded: 'تم إضافة المستشفى',
        beneficiaryAdded: '✅ تم إضافة المستفيد', beneficiaryUpdated: '✅ تم تحديث المستفيد', beneficiaryDeleted: '🗑️ تم حذف المستفيد',
        beneficiaryDeducted: 'تم خصم {bags} كيس {blood} ({product})', beneficiaryRestored: 'تم استعادة {bags} كيس للمخزون', recordDeleted: 'تم حذف السجل',
        profileUpdated: '✅ تم تحديث الملف', profilePasswordUpdated: 'تم تحديث كلمة المرور', profileSaved: 'تم حفظ البيانات',
        labAccessDeniedTitle: '⛔ المعمل فقط', labAccessDeniedBody: 'هذا القسم مخصص لفنيي المعمل.',
        requestApproved: '✅ تم قبول الطلب', requestReady: 'الطلب {id} جاهز للتسليم', requestRejected: '❌ تم رفض الطلب', requestRejectedBody: 'تم رفض الطلب {id}',
        deliveryAccessDeniedTitle: '⛔ غير مسموح', deliveryAccessDeniedBody: 'ليس لديك صلاحية تسجيل التسليم.',
        deliveryRecorded: '✅ تم تسجيل التسليم', deliveryRecordedBody: 'تم تسليم الطلب {id} إلى {name}',
        backupTitle: '💾 نسخة احتياطية', backupBody: 'تم تصدير نسخة احتياطية من البيانات.',
        newDonation: '💉 تبرع جديد', newDonationBody: 'جهز كيس جديد للمستخدم {name} بالفصيلة {blood}.',
        bagDisposed: '🗑️ تم الإتلاف', bagDisposedBody: 'تم إتلاف {id} وتسجيل السبب في سجل الإتلاف.',
        disposalSaved: '🗑️ تم حفظ سجل التخلص', disposalSavedBody: 'تم تسجيل التخلص الطبي لكود {id}.',
        labApproved: '✅ تم الاعتماد والتقسيم', labApprovedBody: 'الفصيلة {type} — 3 مكونات (كرات + بلازما + صفائح) دخلت المخزون.',
        labRejected: '🗑️ استبعاد طبي', labRejectedDiseases: 'تم رفض الكيس {id}. الأمراض: {diseases}', labRejectedDisposal: 'تم توجيه الكيس {id} لسجل الإتلاف.',
        unitsAdded: '💉 تم إضافة الوحدات', unitsAddedBody: 'تم إنشاء {qty} وحدة وإرسالها للمعمل.',
        donationRegistered: '👥 تم تسجيل التبرع', donationRegisteredBody: 'العينة {id} في المعمل — ستُقسَّم عند الاعتماد.',
        requestRegistered: '📨 تم تسجيل الطلب', requestRegisteredBody: 'رقم الطلب {id}.',
        bagUpdated: '✅ تم حفظ تعديل الكيس', bagUpdatedBody: 'تم تحديث {id} في قاعدة البيانات.',
        bagDeleted: '🗑️ تم حذف الكيس', bagDeletedBody: 'تم إزالة {id} من النظام بالكامل.',
        donorSaved: '✅ تم حفظ المتبرع', donorDeleted: '🗑️ تم حذف المتبرع',
        hospitalSaved: '✅ تم حفظ المستشفى', hospitalDeleted: '🗑️ تم حذف المستشفى',
        requestSaved: '✅ تم حفظ الطلب', requestDeleted: '🗑️ تم حذف الطلب',
        disposalRecordSaved: '✅ تم حفظ سجل الإتلاف', disposalRecordDeleted: '🗑️ تم حذف سجل الإتلاف', disposalRecordDeletedBody: 'تم الحذف من قاعدة البيانات.',
        deliveryDeleted: '🗑️ تم حذف سجل التسليم',
        allDataCleared: '✅ تم مسح جميع البيانات', allDataClearedBody: 'تمت إعادة تهيئة النظام إلى حالة فارغة.',
        accountDeleted: '🗑️ تم حذف الحساب',
        notificationsCleared: '✅ تم مسح الإشعارات', notificationsClearedBody: '{count} إشعار تم حذفه.',
        messagesCleared: '✅ تم مسح الرسائل', messagesClearedBody: '{count} رسالة تم حذفها.',
        messageDeleted: '🗑️ تم حذف الرسالة', messageDeletedBody: 'تم حذف الرسالة من النظام.',
        logsCleared: '✅ تم مسح السجلات', logsClearedBody: '{count} سجل تم حذفه.',
        accountAdded: '✅ تم إضافة حساب', accountSaved: '✅ تم حفظ التعديلات', accountSavedPassword: '{name} — تم تحديث كلمة المرور أيضاً.',
        storageUpdated: '✅ تم تحديث التخزين', storageUpdatedBody: '{count} غرف — محفوظ في قاعدة البيانات.',
        daysExpired: 'منتهي', daysToday: 'اليوم', daysTomorrow: 'غداً',
        newMessage: '💬 رسالة جديدة', newMessageBody: 'وصلت رسالة جديدة في المحادثة الجماعية.',
        newNotification: '🔔 إشعار جديد', newNotificationBody: 'وصل إشعار جديد.',
      },
    },
    en: {
      app: { title: 'Drop4Life — Smart Blood Bank', tagline: 'Smart regional blood bank management system', logoTag: 'Blood unit lifecycle control system' },
      login: {
        username: 'Username', password: 'Password', submit: 'Secure sign in', loading: 'Loading...',
        usernamePh: 'Enter username...', remember: 'Remember me', verifying: 'Verifying with server...',
        invalidResponse: 'Invalid sign-in response from server.', sessionFailed: 'Could not confirm session after sign-in. Please try again.',
        invalidCredentials: 'Incorrect username or password.',
      },
      nav: {
        dashboard: 'Dashboard', statistics: 'Statistics', donations: 'Donations', lab: 'Laboratory',
        inventory: 'Active bags', storage: 'Storage', requests: 'Requests', hospitals: 'Hospitals',
        donors: 'Donors', beneficiaries: 'Beneficiaries', audit: 'Audit log', disposal: 'Disposal',
      },
      navSection: { main: 'Main', cycle: 'Blood cycle', stock: 'Inventory', dispatch: 'Dispatch', oversight: 'Oversight' },
      topbar: {
        notifications: 'Notifications', messages: 'Messages', profile: 'Profile', settings: 'Settings',
        logout: 'Sign out', langSwitch: 'العربية', langSwitchTitle: 'Switch language', clockLoading: 'Loading...', close: 'Close',
      },
      page: {
        dashboard: { title: 'Dashboard', subtitle: 'Live metrics and blood flow' },
        statistics: { title: 'System statistics', subtitle: 'Lab, inventory and deliveries' },
        inventory: { title: 'Active bags', subtitle: 'Expiry and location tracking' },
        donations: { title: 'Donation log', subtitle: 'Donations and bag movements' },
        lab: { title: 'Laboratory', subtitle: 'Sample testing and approval' },
        storage: { title: 'Storage system', subtitle: 'Rooms, fridges and shelves' },
        requests: { title: 'Hospital requests', subtitle: 'Issue and delivery requests' },
        hospitals: { title: 'Hospitals', subtitle: 'Linked facilities' },
        donors: { title: 'Donors', subtitle: 'Donor database' },
        beneficiaries: { title: 'Beneficiaries', subtitle: 'Patient blood issues' },
        audit: { title: 'Audit log', subtitle: 'System and security events' },
        disposal: { title: 'Disposal log', subtitle: 'Discarded units' },
        notifications: { title: 'Notifications', subtitle: 'System alerts' },
        messages: { title: 'Messages', subtitle: 'Team chat' },
        profile: { title: 'Profile', subtitle: 'Account details' },
        settings: { title: 'Theme settings', subtitle: 'Colors and appearance' },
        'admin-settings': { title: 'Admin settings', subtitle: 'Advanced options' },
        default: { title: 'Main system', subtitle: '' },
      },
      dashboard: {
        criticalBanner: { title: 'Urgent operations notice:', body: 'Critical blood types have fallen below minimum safety levels. Review donation campaigns immediately.' },
        stat: {
          totalUnits: 'Total available inventory', donors: 'Registered donors', pendingLab: 'Bags in lab testing',
          hospitals: 'Hospitals', requests: 'Hospital blood issue requests',
          unit: { bag: 'bag(s)', donor: 'donor(s)', hospital: 'hospital(s)', request: 'request(s)' },
        },
        matrixTitle: '🚨 Live inventory glow monitor (smart visual alert)',
        aiLoading: 'Loading AI prediction model...',
        bloodOutputThisMonth: 'This month', bloodOutputHospitalsMonth: 'Hospitals (month)', bloodOutputBeneficiariesMonth: 'Beneficiaries (month)',
        navInventory: 'Go to inventory', navDonors: 'Go to donor database', navLab: 'Go to laboratory',
        navHospitals: 'Go to medical facilities', navRequests: 'Go to hospital requests',
        urgentEmpty: 'No critical emergency requests pending. Inventory is stable.',
      },
      chart: {
        bloodInventory: 'Bag inventory by blood type', requestTypes: 'Hospital requests by type', labOutcomes: 'Lab test outcomes',
        bloodOutputMonthly: 'Monthly blood output (last 12 months)',
        priority: { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' },
        lab: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
        bloodOutput: { hospitals: 'Hospitals', beneficiaries: 'Beneficiaries' },
      },
      product: { Whole: 'Whole blood unit', RBC: 'Red blood cells', Plasma: 'Plasma', Platelets: 'Platelets', RBCshort: 'RBC', Plateletsshort: 'Platelets' },
      blood: { pending: 'Pending test', pendingTitle: 'Awaiting lab result', unknown: 'Unknown' },
      donor: { unknown: 'Unknown' },
      common: {
        edit: 'Edit', cancel: 'Cancel', save: 'Save', add: 'Add', delete: 'Delete', search: 'Search', close: 'Close',
        bags: 'bag(s)', units: 'unit(s)', years: 'years', full: 'Full', fullParen: '(Full)', empty: '—', none: 'None',
        actions: 'Actions', loading: 'Loading...', user: 'User', unknownUser: 'Unknown', days: 'day(s)', times: 'times',
        noFridges: '— No fridges available —', unspecified: 'Unspecified',
      },
      btn: {
        edit: 'Edit', delete: 'Delete', approve: 'Approve', reject: 'Reject', deliver: 'Deliver', analyze: 'Analyze',
        secureDispense: '✓ Secure direct dispense', saveChanges: 'Save changes', saveRecord: 'Save record',
        addDonation: '+ Register donation', addBeneficiary: '➕ Add beneficiary', addRequest: '+ New issue request',
        addHospital: '+ Add hospital', addAccount: '+ Add account', saveAccount: '💾 Save new account',
        confirmDispose: '🗑️ Confirm disposal', confirmExecute: 'Confirm', labReject: '❌ Reject', labApprove: '✅ Approve',
        clearLogs: 'Clear logs', clearNotifications: 'Clear all notifications', clearMessages: 'Clear all messages',
        saveStorage: 'Save changes', deleteAccount: '🗑️ Delete account',
        submitDonation: '💾 Send to lab / add to stock', saveBeneficiary: '💾 Save beneficiary',
        deleteBag: '🗑️ Delete bag', saveBagEdit: '💾 Save changes', sendRequest: '📨 Submit and broadcast request',
        confirmDelivery: '🚚 Confirm delivery', saveDonor: '💾 Save and register donor', saveHospital: '💾 Save hospital',
        addRoom: '+ Add room', editRoom: '✏️ Edit', lockRoom: '🔒 Lock',
      },
      storage: {
        overview: '🗄️ Storage overview', fridges: 'Fridges', capacity: 'Capacity', occupied: 'Used',
        unitsUsed: 'units used', fridgeFull: 'Completely full', roomCapacity: 'Room capacity',
        hint: {
          multiUnit: 'Each whole blood unit = {wholeUnits} storage slots. {qty} unit(s) = {unitsNeeded} slot(s) required. Available now: {available}.',
          singleUnit: 'Whole blood unit = {wholeUnits} slots. Available: {available} in {room} / {fridge}.',
        },
        dirtyBanner: '⚠️ Unsaved changes — click Save before leaving this page',
        roomCount: '🏠 Rooms:', fridgesPerRoom: '🧊 Fridges per room:', shelvesPerFridge: '📦 Shelves per fridge:', capacityPerShelf: '📊 Capacity per shelf:',
        configTitle: '🗄️ Storage system info',
        selectFridge: 'Please select a fridge.',
        selectLocation: 'Please select storage location.',
        roomFull: '⚠️ This room is completely full — all fridges are full.\n\nPlease select another room.',
        roomCapacity: '⚠️ Room {room} cannot fit {qty} unit(s) (needs {needed} slot(s) — {remaining} remaining).',
        fridgeFull: '⚠️ Fridge {fridge} is full.{suggestion}\n\nPlease select another fridge.',
        notEnoughSlots: '⚠️ Not enough slots for {qty} unit(s) (needs {needed}, available {available}).{suggestion}',
        fridgeCapacity: '⚠️ Fridge {fridge} cannot fit (needs {needed} slot(s) — {available} remaining).{suggestion}',
        availableFridges: 'Available fridges in same room: {list}.',
        noRooms: 'No rooms — click «+ Add room» to start setup',
        roomDetails: '📋 Room and fridge details',
        bagsLinked: '{count} bag(s) linked to this room',
        shelvesLabel: 'Shelves', capPerShelfLabel: 'Cap/shelf',
        roomName: 'Room name', totalCapacity: 'Total capacity', fridgeCount: 'Fridge count',
        fridgeDetails: 'Fridge details (shelves × capacity)',
        shelvesPerFridgeShort: 'Shelves per fridge',
        validationFull: '⚠️ Storage completely full — all rooms and fridges are full.\n\nNo new blood bags can be added.',
      },
      ai: {
        emptyStable: 'No predictions at this time — inventory is stable.',
        loadFailed: 'Could not load predictions',
        defaultTitle: 'Prediction',
      },
      cards: {
        aiPredictions: '🤖 AI prediction analytics', statisticsOverview: '📈 Smart medical insights',
        bloodOutput: '🩸 Blood output (deliveries + beneficiaries)',
        donations: '💉 Donation and bag movement log', addDonation: 'Register new donation',
        donors: '👥 Unified donor registry', beneficiaries: '🩸 Beneficiaries', addBeneficiary: 'Add beneficiary',
        disposal: '🗑️ Disposal and safe biological waste log', audit: '📜 Security and audit log',
        inventoryBags: '🧪 Smart bag management with expiry tracking', inventorySummary: '📊 Inventory summary by type',
        lab: '🔬 Laboratory — sample analysis', requests: '🏥 Hospital blood issue requests',
        hospitals: '🏥 Linked hospital registry', hospitalDeliveries: '📦 Hospital delivery log',
        notifications: '🔔 Notifications board', profile: '👤 Your profile', adminSettings: '⚙️ Admin settings',
        accountsMgmt: '👥 Account and user management', superAdminActions: '🔐 Sensitive super admin actions',
      },
      search: {
        inventory: 'Search by bag ID, blood type, or donor...',
        donations: 'Search donation log (ID, donor, blood type, location)...',
        lab: 'Search by ID or donor...', requests: 'Search requests by name, blood type, or status...',
        hospitals: 'Search hospitals by name, address, or phone...', hospitalDeliveries: 'Search deliveries by hospital or recipient...',
        donors: 'Search donors by name, blood type, or phone...',
        beneficiaries: 'Search by name, phone, ID, or blood type...',
        audit: 'Search audit log...', disposal: 'Search disposal log by ID, blood type, or reason...',
        accounts: 'Search accounts and staff...',
      },
      filter: {
        allBloodTypes: 'All blood types', allProducts: 'All components', allActiveStatuses: 'All active statuses',
        allStatuses: 'All statuses', approved: 'Approved ✅', pending: 'Pending ⏳', reserved: 'Reserved 📌', rejected: 'Rejected ❌',
      },
      table: {
        bagId: 'Bag ID', donor: 'Donor', component: 'Component', bloodType: 'Blood type', qty: 'Quantity',
        date: 'Date', status: 'Status', location: 'Location', actions: 'Actions', bagStatus: 'Bag status',
        storageLocation: 'Cold storage location', name: 'Name', phone: 'Phone', nationalId: 'National ID', age: 'Age', address: 'Address',
        lastDonation: 'Last donation', donationCount: 'Donations', fileNo: 'File no.', fullName: 'Full name',
        expiry: 'Expiry date', daysLeft: 'Days left', daysLeftUnit: 'days', labStatus: 'Test status', addDate: 'Date added',
        requestId: 'Request ID', hospital: 'Hospital', destinationHospital: 'Destination hospital', priority: 'Priority',
        available: 'Available', reserved: 'Reserved', issued: 'Issued', expired: 'Expired',
        medicalStatus: 'Medical status', recipient: 'Recipient', recipientPhone: 'Recipient phone',
        diseases: 'Detected diseases', disposalDate: 'Disposal date', reason: 'Reason', worker: 'Staff',
        source: 'Source', count: 'Count', consumed: 'Bags consumed', consumedType: 'Blood type consumed', registeredAt: 'Registered',
        timestamp: 'Timestamp', role: 'Role', actionType: 'Action type', actionDetails: 'Action details',
        damagedBagId: 'Damaged bag ID', bagType: 'Bag type', medicalReason: 'Medical exclusion reason', responsibleWorker: 'Responsible staff',
        hospitalName: 'Hospital name', managerName: 'Manager name', username: 'Username', email: 'Email', accountStatus: 'Account status',
      },
      form: {
        label: {
          username: 'Username', fullName: 'Full name', email: 'Email', password: 'Password',
          role: 'Current role', roleSelect: 'Role', newPassword: 'Update password', newPasswordOptional: 'Set new password (leave blank to keep current)',
          accountStatus: 'Account status', component: 'Component type', labBloodType: 'Blood type (required — set by lab)',
          diseases: 'Detected diseases', labNotes: 'Exclusion test notes', bagCode: 'Bag code', bagType: 'Bag type',
          disposalMedicalReason: 'Medical disposal reason', disposeReason: 'Disposal reason (required)', entryType: 'Entry type',
          qty: 'Quantity (units)', selectRoom: 'Select room', selectFridge: 'Select fridge', fullNameTriple: 'Full name',
          nationalId: 'National ID', age: 'Age', phone: 'Phone number', address: 'Address', bagId: 'Bag number',
          addDate: 'Date added', expiryDate: 'Expiry date', location: 'Location', status: 'Status', name: 'Name',
          bloodType: 'Blood type', bagsConsumed: 'Bags consumed',
          donor: 'Donor', hospital: 'Hospital', hospitalName: 'Hospital name', manager: 'Manager',
          hospitalSearch: 'Select hospital from network (quick search)', requiredBloodType: 'Required blood type',
          qtyBags: 'Quantity (bags)', requestPriority: 'Medical request priority', recipient: 'Recipient',
          notesOptional: 'Additional notes (optional)', fullNameQuad: 'Full legal name', verifiedBloodType: 'Verified blood type',
          ageYears: 'Age (years)', emergencyPhone: 'Emergency contact phone', nationalIdCard: 'National ID',
          requestId: 'Request number',
        },
        placeholder: {
          newPassword: 'New password', usernameExample: 'e.g. doctor_ali', fullNameQuad: 'Full legal name...',
          strongPassword: 'Strong password', superAdminPassword: 'Super admin password', bagCodeExample: 'e.g. BAG-003',
          disposalReason: 'e.g. contamination or failed test', disposeReasonText: 'Enter medical disposal reason...',
          labRejectReason: 'Enter reason when rejecting...', selectBloodType: '— Select blood type —',
          fullName: 'Full name', nationalId14: '14 digits', phone11: '01xxxxxxxxx', addressFull: 'Governorate - city - address',
          hospitalSearch: 'Type hospital name...', recipientName: 'Enter recipient name', deliveryNotes: 'e.g. received by front desk',
          hospitalNameExample: 'e.g. Al-Salam General Hospital', hospitalAddressExample: 'e.g. Army St., Asyut',
          managerExample: 'e.g. Dr. Ahmed Samir', hospitalPhoneExample: 'e.g. 088-1234567',
        },
        entryBag: 'Add bag(s)', entryDonor: 'Register donor',
      },
      modal: {
        addAccount: { title: '➕ Add account', subtitle: 'New system user' },
        sensitiveAction: { title: 'Sensitive action', subtitle: 'Requires super admin password', hint: 'Enter password to confirm.', verifyHint: 'Action runs only after super admin password verification.' },
        editAccount: { title: 'Edit account', subtitle: 'Update permissions and user details' },
        donorProfile: { title: 'Donor profile history', subtitle: 'Donation history and basic data', totalDonations: 'Total donations in system:', lastDonation: 'Last recorded donation:', closeWindow: 'Close' },
        labTest: { title: '🔬 Sample analysis', subtitle: 'Test, approve or reject sample', splitHint: 'On approval the unit splits into RBC + plasma + platelets and enters inventory with the selected blood type.' },
        disposeBag: { title: '🗑️ Dispose blood bag', subtitle: 'Deducted from inventory and logged in disposal record' },
        addDonation: { title: '💉 Register donation', subtitle: 'Add bag(s) or register new donor' },
        clearNotifications: { title: 'Clear all notifications', message: 'All notifications will be deleted after correct password entry.' },
        clearLogs: { title: 'Clear logs', message: 'All audit and disposal logs will be deleted after correct password entry.' },
        clearMessages: { title: 'Clear all messages', message: 'All chat messages will be deleted after correct password entry.' },
        editBag: { title: '✏️ Edit blood bag', subtitle: 'Update bag details' },
        addBeneficiary: { title: '➕ Add beneficiary', subtitle: 'Register new beneficiary' },
        editBeneficiary: { title: '✏️ Edit beneficiary', subtitle: 'Update beneficiary details' },
        editDonor: { title: '✏️ Edit donor', subtitle: 'Update donor details' },
        editHospital: { title: '✏️ Edit hospital', subtitle: 'Update hospital details' },
        editRequest: { title: '✏️ Edit issue request', subtitle: 'Update request details' },
        editDisposal: { title: '✏️ Edit disposal record', subtitle: 'Update disposal details' },
        addRequest: { title: '📋 Hospital request', subtitle: 'Review and submit issue request' },
        deliverRequest: { title: '🚚 Deliver request', subtitle: 'Confirm hospital request delivery' },
        addDonor: { title: '👥 Register donor', subtitle: 'Add donor to database' },
        addHospital: { title: '🏥 New hospital', subtitle: 'Add hospital to network' },
      },
      donation: {
        bagModeHint: 'A <strong>whole blood unit</strong> is registered and sent to the lab. On approval it splits into RBC + plasma + platelets.',
        donorModeHint: 'A <strong>whole blood unit</strong> sample is registered for the lab — components split on approval.',
      },
      priority: {
        critical: '🔴 Critical — emergency and immediate OR',
        high: '🟠 High priority — within 6 hours',
        medium: '🟡 Medium priority — within 24 hours',
        low: '🟢 Low priority — scheduled procedures later',
        badgeCritical: '🔴 Critical emergency',
        badgeHigh: '🟠 High',
        badgeMedium: '🟡 Medium',
        badgeLow: 'Low',
      },
      chat: {
        empty: 'No messages yet — start the conversation now',
        title: '💬 Drop4Life group chat',
        tabGroup: 'Team chat',
        tabPrivate: 'Private message',
        privateTitle: '💬 Private message',
        privateWith: 'Private chat with {name}',
        privateHint: 'Private messages are only between you and the super admin',
        selectContact: 'Select user',
        placeholderPrivate: 'Type a private message...',
        privateDenied: 'You can only send private messages to the super admin.',
        livePrefix: 'Live —',
        activeAccounts: '{count} active account(s)',
        allCloud: 'All accounts in cloud',
        placeholder: 'Type a message...',
        sendTitle: 'Send',
        view: 'View',
        seenBy: 'Seen by:',
        notSeenYet: 'Not seen yet',
        liveUpdate: 'Live update every {seconds} seconds',
        systemSender: '📢 System',
        delete: 'Delete from system',
        deleteConfirm: 'Delete this message from the system? This cannot be undone.',
      },
      render: {
        reservedForRequest: 'Reserved for request',
        labPendingReservation: 'Lab reservation pending',
        noPreviousDonation: 'No previous donation',
        donorProfileTitle: 'Medical profile: {name}',
        donorProfileCount: '{count} previous donation(s) in system',
        hospitalTotalRequests: 'Total requests: {count} | Bags required: {bags}',
        notAvailable: 'Not available',
        beneficiaryCount: '{count} beneficiary',
        beneficiaryCountPlural: '{count} beneficiaries',
        noBeneficiaries: 'No beneficiaries',
        stockAvailable: '{type} — available: {available} ({product})',
        stockUnavailable: '{type} — not available in stock',
        stockNotInInventory: 'Blood type {blood} ({product}) not found in inventory.',
        stockSufficient: '✅ Stock sufficient — {available} bag(s) of {blood} available, {bags} will be deducted on save.',
        editAccountTitle: 'Edit account: {name}',
        nationalIdLabel: 'National ID:',
        alternatives: 'Alternatives: {list}',
        noAlternatives: 'No sufficient alternatives.',
        detectedDiseases: 'Detected diseases: {diseases}',
        cleanApproval: 'Clean approval',
        newBloodRequest: '🏥 New blood request',
        requestBroadcast: '{id}: {hospital} — {qty} {product} {blood} ({priority}) — by {actor}',
        requestApprovedNotif: '✅ Request approved',
        requestApprovedBody: '{id} — approved — by {actor}',
        requestRejectedNotif: '❌ Request rejected',
        requestRejectedBody: '{id} — rejected — by {actor}',
        requestDeliveredNotif: '🚚 Request delivered',
        requestDeliveredBody: '{id} to {recipient} — by {actor}',
        backupTitle: 'Backup',
        backupBody: 'Backup requested — data stored in db.sqlite3 on server.',
      },
      auditAction: {
        addHospital: 'Add hospital',
        editBag: 'Edit bag details',
        addBeneficiary: 'Register beneficiary',
        editBeneficiary: 'Edit beneficiary',
        deleteBeneficiary: 'Delete beneficiary',
        addAccount: 'Add account',
        updateAccount: 'Update account',
        deleteAccount: 'Delete account',
        loginSuccess: 'Successful sign-in',
        loginDetails: 'Signed in via API.',
        logout: 'Sign-out',
        logoutDetails: 'Signed out of the system.',
      },
      section: {
        hospitalsHint: 'Add a hospital with name, address, and phone; browse the current directory.',
        deliveriesHint: 'Delivery log with recipient details and delivery date.',
        auditAdminOnly: 'Admins only', auditHint: 'Search by staff member, action type, or event details.',
        disposalHint: 'Every disposed bag requires a clear medical reason before saving.',
        labSummary: '📋 Test summary:', labPending: 'Pending bags', labApproved: 'Approved', labRejected: 'Rejected',
        labSummaryLine: '📋 {summary} {pendingLabel} {pending} | {approvedLabel} {approved} | {rejectedLabel} {rejected}',
        passwordRequired: 'Password required', superAdminSecurityHint: 'Clear notifications, messages, and logs from each section.',
        roleSuperAdmin: '🔐 Super Admin',
        roleAdmin: '👨‍💼 Admin — users and requests', roleLab: '🔬 Lab — testing only',
        accountActive: '✅ Active', accountInactive: '❌ Disabled',
      },
      badge: {
        requestPending: 'Pending review', requestApproved: 'Approved', requestRejected: 'Rejected', requestDelivered: 'Delivered', requestInProgress: 'In preparation',
        bagApproved: 'Approved ✅', bagPending: 'Pending ⏳', bagReserved: 'Reserved 📌',
        labPending: 'Pending ⏳', labApproved: 'Approved ✅', labRejected: 'Rejected ❌',
        donationPending: 'Pending ⏳', donationApproved: 'Approved ✅', donationReserved: 'Reserved 📌',
        priorityLow: 'Normal', priorityMedium: 'Urgent', priorityHigh: 'Critical', priorityCritical: 'Critical emergency',
        inventorySafe: 'Safe ✅', inventoryLow: 'Low ⚠️', inventoryCritical: 'Critical 🚨',
        accountActive: '✅ Active', accountInactive: '❌ Disabled',
      },
      role: { superadmin: 'Super Admin', admin: 'Admin', lab: 'Laboratory' },
      roleCode: { DR: 'Super Admin', ADM: 'Admin', MLS: 'Laboratory' },
      empty: {
        beneficiaries: 'No matching beneficiary records.', donors: 'No donors found.',
        donations: 'No matching donation records.', inventory: 'No matching bags.',
        requests: 'No matching requests.', lab: 'No matching samples.',
        labExtended: 'No matching bags. Lab is empty or no search results.',
        requestsSearch: 'No requests match your search criteria.',
        hospitalsSearch: 'No hospitals match your search.',
        deliveries: 'No delivery records yet.',
        auditDenied: '⚠️ Security block: you do not have permission to access the audit log.',
        audit: 'No records match the current filters.',
        disposalSearch: 'No disposal records match your search.',
        notifications: 'No notifications at this time.',
        bloodOutputDeliveries: 'No deliveries recorded yet.',
      },
      msg: {
        beneficiary: {
          addDenied: 'Only super admin or admin can add beneficiaries.',
          editDenied: 'Only super admin or admin can edit beneficiaries.',
          deleteDenied: 'Only super admin or admin can delete beneficiaries.',
          noStock: 'No blood stock available. Cannot register a new beneficiary.',
          bloodRequired: 'Please select a blood type.',
        },
        hospital: { fieldsRequired: 'Please enter all hospital details.' },
        form: { requiredFields: 'Please fill all required fields.', requiredFieldsBang: 'Please fill all required fields!' },
        profile: { passwordMin: 'Password must be at least 4 characters.' },
        bag: {
          disposeDenied: 'Only admin or super admin can dispose bags from inventory.',
          notFound: 'Bag not found.', stillInLab: 'Bag is still in the lab. Use test rejection to dispose it.',
          disposeReasonRequired: 'Please enter a disposal reason.', notInInventory: 'Bag not found in inventory.',
          editDenied: 'Only super admin can edit bag details.',
        },
        disposal: { bagAndReasonRequired: 'Please enter bag code and medical disposal reason.' },
        lab: {
          bloodTypeRequired: 'Lab must select and confirm blood type.',
          rejectReasonRequired: 'Enter rejection reason or select detected diseases.',
          diseaseBlocksApprove: 'Cannot approve when diseases are selected. Reject or clear diseases.',
        },
        storage: {
          full: '⚠️ Storage completely full — all rooms and fridges are full.\n\nNo new bags or donors until space is freed.',
          donorSlotFull: '⚠️ Storage full — a whole blood unit needs 3 storage slots and cannot be added until space is freed.',
          roomFridgeRequired: 'Please select room and fridge.', locationRequired: 'Please select storage location.',
          roomHasBags: 'Cannot delete a room that contains stored bags.', roomRequired: 'Add at least one room before saving.',
          shelfCapacityRequired: 'Enter a valid capacity for each shelf.',
        },
        donor: { nameNationalRequired: 'Please enter name and national ID.', unknown: 'Unknown' },
        request: {
          hospitalRequired: 'Please select a valid hospital from the list before submitting.',
          approveDenied: 'Only super admin can approve requests.',
          rejectDenied: 'Only super admin can reject requests.',
          alreadyDelivered: 'This request was already processed and delivered.',
          deliverAfterApproveOnly: 'Deliver button appears only after approval.',
          deliverApprovedOnly: 'Delivery available only after approval.',
          deliverMustBeApproved: 'Request must be approved before delivery.',
        },
        delivery: { recipientRequired: 'Please enter recipient name and phone.', editUnavailable: 'Edit delivery via delete and re-entry for now.' },
        admin: {
          clearAllDenied: 'Only super admin can clear all data.',
          superOnly: 'Only super admin can perform this action.',
          actionUnknown: 'Could not determine requested action.', passwordRequired: 'Please enter password.',
        },
        account: {
          superAdminDeleteBlocked: '❌ Cannot delete the primary Super Admin account!',
          superAdminCreateBlocked: '❌ Cannot create super admin account here.',
          superAdminPromoteBlocked: '❌ Cannot promote account to super admin.',
        },
        validation: {
          phone11: '{field} must be exactly 11 digits.', nationalId14: '{field} must be exactly 14 digits.',
          phone: 'Phone number', nationalId: 'National ID',
        },
        confirm: {
          deleteBag: 'Delete blood bag {id}?\n\nThis will:\n• Permanently delete the bag\n• Deduct from inventory\n• Remove from fridge\n• Unlink from requests and beneficiaries',
          deleteBeneficiary: 'Delete beneficiary {name}?\n{bags} bag(s) of {blood} will be restored to inventory.',
          deleteBeneficiaryShort: 'Delete beneficiary {name}? Bags will be restored to inventory.',
          deleteDonor: 'Delete donor {id}?', deleteHospital: 'Delete hospital {name}?',
          deleteRequest: 'Delete request {id}?', deleteDisposal: 'Delete disposal record?',
          deleteDelivery: 'Delete delivery record {id}?',
          clearAllData: 'Clear all operational data? Logs, non-superadmin users, and current sessions will be removed.',
          deleteAccount: 'Delete account {name}?',
        },
        inventory: { insufficient: 'Insufficient stock. Required {required}, available {available}. {alt}', insufficientDetail: 'Insufficient stock. Available {available} of {bloodType} ({product}), required {bagsNeeded}.' },
        api: { loadFailed: 'Could not load API file. Reload the page after starting the server.', serverRequired: 'Could not load API file. Ensure the server is running and you opened the site from the same address.', connectionFailed: 'Could not connect to server. Check that the server is running.', httpError: 'Error {status}', bootstrapFailed: 'Could not load system data. Refresh or contact support.' },
      },
      toast: {
        loginSuccess: '✅ Signed in', loginWelcome: 'Welcome {name}!', accessDeniedTitle: '⛔ Access denied', accessDeniedBody: 'You do not have access to this section.',
        loadErrorTitle: 'Load error', loadFailed: 'Could not load data.', forbiddenTitle: 'Forbidden', sessionExpiredTitle: 'Session expired',
        bloodTypeReport: 'Blood type report {type}', hospitalAdded: 'Hospital added',
        beneficiaryAdded: '✅ Beneficiary added', beneficiaryUpdated: '✅ Beneficiary updated', beneficiaryDeleted: '🗑️ Beneficiary deleted',
        beneficiaryDeducted: 'Deducted {bags} bag(s) {blood} ({product})', beneficiaryRestored: 'Restored {bags} bag(s) to inventory', recordDeleted: 'Record deleted',
        profileUpdated: '✅ Profile updated', profilePasswordUpdated: 'Password updated', profileSaved: 'Profile saved',
        labAccessDeniedTitle: '⛔ Lab only', labAccessDeniedBody: 'This section is for lab staff.',
        requestApproved: '✅ Request approved', requestReady: 'Request {id} ready for delivery', requestRejected: '❌ Request rejected', requestRejectedBody: 'Request {id} rejected',
        deliveryAccessDeniedTitle: '⛔ Not allowed', deliveryAccessDeniedBody: 'You cannot record delivery.',
        deliveryRecorded: '✅ Delivery recorded', deliveryRecordedBody: 'Request {id} delivered to {name}',
        backupTitle: '💾 Backup', backupBody: 'Data backup exported.',
        newDonation: '💉 New donation', newDonationBody: 'Prepare a new bag for {name}, blood type {blood}.',
        bagDisposed: '🗑️ Disposed', bagDisposedBody: 'Disposed {id} and logged reason.',
        disposalSaved: '🗑️ Disposal saved', disposalSavedBody: 'Medical disposal logged for {id}.',
        labApproved: '✅ Approved and split', labApprovedBody: 'Type {type} — 3 components (RBC + plasma + platelets) entered inventory.',
        labRejected: '🗑️ Medical exclusion', labRejectedDiseases: 'Rejected bag {id}. Diseases: {diseases}', labRejectedDisposal: 'Bag {id} sent to disposal log.',
        unitsAdded: '💉 Units added', unitsAddedBody: 'Created {qty} unit(s) and sent to lab.',
        donationRegistered: '👥 Donation registered', donationRegisteredBody: 'Sample {id} in lab — will split on approval.',
        requestRegistered: '📨 Request registered', requestRegisteredBody: 'Request number {id}.',
        bagUpdated: '✅ Bag updated', bagUpdatedBody: 'Updated {id} in database.',
        bagDeleted: '🗑️ Bag deleted', bagDeletedBody: 'Removed {id} from system.',
        donorSaved: '✅ Donor saved', donorDeleted: '🗑️ Donor deleted',
        hospitalSaved: '✅ Hospital saved', hospitalDeleted: '🗑️ Hospital deleted',
        requestSaved: '✅ Request saved', requestDeleted: '🗑️ Request deleted',
        disposalRecordSaved: '✅ Disposal record saved', disposalRecordDeleted: '🗑️ Disposal record deleted', disposalRecordDeletedBody: 'Removed from database.',
        deliveryDeleted: '🗑️ Delivery record deleted',
        allDataCleared: '✅ All data cleared', allDataClearedBody: 'System reset to empty state.',
        accountDeleted: '🗑️ Account deleted',
        notificationsCleared: '✅ Notifications cleared', notificationsClearedBody: '{count} notification(s) deleted.',
        messagesCleared: '✅ Messages cleared', messagesClearedBody: '{count} message(s) deleted.',
        messageDeleted: '🗑️ Message deleted', messageDeletedBody: 'The message was removed from the system.',
        logsCleared: '✅ Logs cleared', logsClearedBody: '{count} log(s) deleted.',
        accountAdded: '✅ Account added', accountSaved: '✅ Changes saved', accountSavedPassword: '{name} — password also updated.',
        storageUpdated: '✅ Storage updated', storageUpdatedBody: '{count} room(s) — saved to database.',
        daysExpired: 'Expired', daysToday: 'Today', daysTomorrow: 'Tomorrow',
        newMessage: '💬 New message', newMessageBody: 'New message in group chat.',
        newNotification: '🔔 New notification', newNotificationBody: 'A new notification arrived.',
      },
    },
  };

  const REQUEST_STATUS_AR = {
    pending: 'قيد المراجعة',
    approved: 'تم القبول',
    rejected: 'تم الرفض',
    delivered: 'تم التسليم',
  };

  const BACKEND_MSG_EN = {
    'اسم المستخدم أو كلمة المرور غير صحيحة.': 'Incorrect username or password.',
    'تعذر إنشاء جلسة الدخول. أعد المحاولة.': 'Could not create sign-in session. Please try again.',
    'تعذر العثور على ملف المستخدم بعد تسجيل الدخول.': 'Could not find user profile after sign-in.',
    'لا يمكن حذف هذا الحساب المحمي.': 'This protected account cannot be deleted.',
    'التسجيل الذاتي غير متاح على هذا الخادم.': 'Self-registration is not available on this server.',
    'يجب تسجيل الدخول أولاً.': 'You must sign in first.',
    'لا يمكن إنشاء مخزون يدوياً — يُدار عبر عمليات النظام.': 'Manual inventory creation is not allowed — use system operations.',
    'لا يمكن حذف سجل مخزون — استخدم عمليات النظام.': 'Inventory records cannot be deleted — use system operations.',
    'يُسمح بتعديل حد الخطر (criticalLimit) فقط. العدادات تُحدَّث تلقائياً من الأكياس والعمليات.': 'Only critical limit (criticalLimit) may be edited. Counts update automatically from bags and operations.',
    'استخدم /api/operations/add-donation/ لإضافة أكياس.': 'Use /api/operations/add-donation/ to add bags.',
    'استخدم عمليات النظام (تسليم/اتلاف/نقل) لتعديل الأكياس.': 'Use system operations (deliver/dispose/transfer) to modify bags.',
    'استخدم /api/operations/save-storage-config/ لتعديل التخزين.': 'Use /api/operations/save-storage-config/ to modify storage.',
    'سعة التخزين تُحدَّث تلقائياً من الأكياس — استخدم save-storage-config للهيكل.': 'Storage capacity updates automatically from bags — use save-storage-config for structure.',
    'لا يمكن حذف وحدات التخزين يدوياً.': 'Storage units cannot be deleted manually.',
    'تعذر تحميل بيانات النظام. حاول التحديث أو تواصل مع الدعم.': 'Could not load system data. Refresh or contact support.',
    'تعذر تحميل بيانات bootstrap. حاول التحديث أو تواصل مع الدعم.': 'Could not load system data. Refresh or contact support.',
    'تعذر تحميل بيانات التزامن الحية. حاول التحديث أو تواصل مع الدعم.': 'Could not load live sync data. Refresh or contact support.',
    'فقط المسؤول الأعلى يمكنه تنفيذ هذا الإجراء.': 'Only the super admin can perform this action.',
    'فقط المسؤول الأعلى يمكنه تعديل أو حذف السجلات.': 'Only the super admin can modify or delete records.',
    'الرسائل الخاصة متاحة فقط مع المسؤول الأعلى.': 'Private messages are only available with the super admin.',
    'المستخدم المستهدف غير موجود.': 'Target user not found.',
    'كلمة مرور السوبر أدمن غير صحيحة.': 'Incorrect super admin password.',
    'كلمة مرور المسؤول الأعلى غير صحيحة.': 'Incorrect super admin password.',
    'تعذر إنشاء رقم متبرع فريد.': 'Could not generate unique donor ID.',
    'تعذر إنشاء رقم طلب فريد.': 'Could not generate unique request ID.',
    '⚠️ المخزون ممتلئ بالكامل — لا يمكن إدخال أي أكياس دم جديدة.': '⚠️ Storage completely full — no new blood bags can be added.',
    'موقع التخزين غير صالح.': 'Invalid storage location.',
    '⚠️ الرف المحدد غير موجود في هذه الثلاجة.': '⚠️ Selected shelf not found in this fridge.',
    '⚠️ هذا الرف لا يتسع لهذه الكمية.': '⚠️ This shelf cannot fit this quantity.',
    'الكيس غير موجود.': 'Bag not found.',
    'لا يمكن نقل كيس مُسلَّم أو منتهي الصلاحية.': 'Cannot move a delivered or expired bag.',
    'يجب تحديد الغرفة والثلاجة.': 'Room and fridge must be selected.',
    'فقط المعمل أو السوبر أدمن يمكنه تنفيذ التحليل.': 'Only lab staff or super admin can run analysis.',
    'هذا الكيس ليس بانتظار المعمل — لا يمكن إعادة تحليله.': 'This bag is not awaiting the lab — cannot re-analyze.',
    'لا يمكن اعتماد عينة تحتوي على أمراض مكتشفة. اختر رفضاً بدلاً من ذلك.': 'Cannot approve a sample with detected diseases. Choose rejection instead.',
    'موقع التخزين الأصلي للعينة غير صالح.': 'Original sample storage location is invalid.',
    'يجب كتابة سبب الرفض أو تحديد الأمراض المكتشفة.': 'Enter rejection reason or select detected diseases.',
    'فقط المسؤول الأعلى يمكنه حذف أكياس الدم.': 'Only super admin can delete blood bags.',
    'الكيس غير موجود في المخزون.': 'Bag not found in inventory.',
    'الكيس غير موجود في المخزون النشط.': 'Bag not found in active inventory.',
    'الطلب غير موجود.': 'Request not found.',
    'الطلب مُسلّم مسبقاً.': 'Request already delivered.',
    'الطلب مرفوض ولا يمكن تسليمه.': 'Request rejected — cannot deliver.',
    'الطلب بانتظار موافقة السوبر أدمن.': 'Request awaiting super admin approval.',
    'الطلب غير جاهز للتسليم.': 'Request not ready for delivery.',
    'يمكن فقط اعتماد الطلب أو رفضه.': 'Request can only be approved or rejected.',
    'لا يمكن قبول الطلب في حالته الحالية.': 'Request cannot be approved in its current state.',
    'يجب على المعمل اختيار وتأكيد فصيلة الدم.': 'Lab must select and confirm blood type.',
    'يجب على المعمل تحديد فصيلة الدم — لا يُقبل "غير محدد".': 'Lab must set blood type — "unknown" is not accepted.',
    'لا يمكن إنشاء هذا الحساب المحمي.': 'This protected account cannot be created.',
    'لا يمكن تغيير صلاحية هذا الحساب المحمي.': 'This protected account role cannot be changed.',
    'لا يمكن ترقية حساب إلى مسؤول أعلى.': 'Cannot promote account to super admin.',
    'كلمة المرور يجب أن تكون 4 أحرف على الأقل.': 'Password must be at least 4 characters.',
    'كلمة المرور مطلوبة.': 'Password is required.',
    'عدد الأكياس يجب أن يكون 1 على الأقل.': 'Bag count must be at least 1.',
    'فصيلة/مكون الدم غير موجود في المخزون.': 'Blood type/component not found in inventory.',
    'عجز في المخزون لعدد الأكياس المطلوبة.': 'Insufficient inventory for required bag count.',
    'فصيلة/مكون الدم الجديد غير موجود في المخزون.': 'New blood type/component not found in inventory.',
    'عجز في المخزون للفصيلة/المكون الجديد.': 'Insufficient inventory for new blood type/component.',
    'تمت مسح جميع بيانات التشغيل بنجاح.': 'All operational data cleared successfully.',
    'البيانات محفوظة في قاعدة SQLite على الخادم.': 'Data saved in SQLite database on server.',
    'انتهاء الصلاحية — إتلاف تلقائي': 'Expiry — automatic disposal',
    'النظام': 'System',
    'مدير النظام': 'System administrator',
    'مستشفى': 'Hospital',
    'مستفيد': 'Beneficiary',
    '✅ اعتماد وتقسيم عينة': '✅ Sample approved and split',
    '❌ عينة مرفوضة وتم اتلافها': '❌ Sample rejected and disposed',
    '🚚 تسليم طلب مستشفى': '🚚 Hospital request delivered',
  };

  const ROLE_LABEL_AR = {
    'المسؤول الأعلى': 'role.superadmin',
    'سوبر أدمن': 'role.superadmin',
    'مسؤول': 'role.admin',
    'أدمن': 'role.admin',
    'معمل': 'role.lab',
  };

  const AI_TITLE_EN = {
    'عجز متوقع': 'Predicted shortage',
    'مخزون حرج': 'Critical stock',
    'صلاحية قريبة': 'Near expiry',
    'اختناق معملي': 'Lab backlog',
    'معدل الهدر': 'Wastage rate',
    'فجوة متبرعين': 'Donor gap',
    'وضع مستقر': 'Stable status',
    'ملاحظة': 'Note',
  };

  const AI_HEALTH_LABEL_EN = {
    'ممتاز': 'Excellent',
    'جيد': 'Good',
    'يحتاج انتباه': 'Needs attention',
    'حرج': 'Critical',
  };

  const AI_RISK_LEVEL_EN = {
    shortage: 'Shortage',
    critical: 'Critical',
    watch: 'Watch',
    safe: 'Safe',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  const AI_TEXT_PATTERNS = [
    { re: /^تنبؤ عجز في فصيلة (.+) خلال 48 ساعة: الطلب المعلّق (\d+) كيس والمتاح (\d+) كيس \(عجز متوقع (\d+) كيس\)\.(?: المصادر: (.+)\.)?$/, en: (m) => `Predicted ${m[1]} shortage within 48h: pending demand ${m[2]} bag(s), available ${m[3]} (expected gap ${m[4]}).${m[5] ? ` Sources: ${m[5]}.` : ''}` },
    { re: /^فصيلة (.+) عند حد الخطر: المتاح (\d+) كيس \(الحد الحرج (\d+) كيس\)\.$/, en: (m) => `${m[1]} at risk threshold: ${m[2]} bag(s) available (critical limit ${m[3]}).` },
    { re: /^تنبيه صلاحية: (\d+) كيس تنتهي خلال 7 أيام \((.+)\)\.$/, en: (m) => `Expiry alert: ${m[1]} bag(s) expiring within 7 days (${m[2]}).` },
    { re: /^اختناق معملي: (\d+) كيس بانتظار نتائج الفحص — يؤخر دخولها للمخزون المتاح\.$/, en: (m) => `Lab backlog: ${m[1]} bag(s) awaiting test results — delaying stock availability.` },
    { re: /^فجوة متبرعين لفصيلة (.+): (\d+) متبرع نشط فقط — يُنصح بحملة استهداف فورية\.$/, en: (m) => `Donor gap for ${m[1]}: only ${m[2]} active donor(s) — targeted campaign recommended.` },
    { re: /^معدل الهدر العام منخفض جداً بنسبة (.+) \((\d+) من (\d+) وحدة\)\.$/, en: (m) => `Overall wastage very low at ${m[1]} (${m[2]} of ${m[3]} units).` },
    { re: /^معدل الهدر العام متوسط بنسبة (.+) \((\d+) من (\d+) وحدة\)\.$/, en: (m) => `Overall wastage moderate at ${m[1]} (${m[2]} of ${m[3]} units).` },
    { re: /^معدل الهدر العام مرتفع بنسبة (.+) \((\d+) من (\d+) وحدة\) — يُنصح بمراجعة إجراءات التخزين\.$/, en: (m) => `Overall wastage high at ${m[1]} (${m[2]} of ${m[3]} units) — review storage procedures.` },
    { re: /^لا توجد مخاطر عاجلة — جميع الفصائل ضمن المستويات الآمنة والطلبات المعلّقة مغطاة بالمخزون\.$/, en: () => 'No urgent risks — all types within safe levels and pending demand covered by stock.' },
    { re: /^توريد عاجل لفصيلة (.+) — عجز (\d+) كيس\. فعّل حملة SMS\/WhatsApp لمتبرعي (.+) في أسيوط\.$/, en: (m) => `Urgent resupply for ${m[1]} — gap of ${m[2]} bag(s). Launch SMS/WhatsApp campaign for ${m[3]} donors.` },
    { re: /^مراقبة فصيلة (.+): المخزون يكفي تقريباً (.+) يوماً — خطط لتعزيز وقائي\.$/, en: (m) => `Monitor ${m[1]}: stock covers ~${m[2]} day(s) — plan preventive replenishment.` },
    { re: /^تعزيز مخزون (.+) قبل بلوغ مستوى العجز الحرج \(المتاح حالياً (\d+) كيس\)\.$/, en: (m) => `Boost ${m[1]} stock before critical shortage (currently ${m[2]} bag(s) available).` },
    { re: /^توسيع قاعدة متبرعي (.+) — المسجّلون النشطون: (\d+) فقط\.$/, en: (m) => `Expand ${m[1]} donor base — only ${m[2]} active registered donor(s).` },
    { re: /^صرف الأكياس قرب انتهاء الصلاحية أولاً \(FIFO\) لتقليل الهدر\.$/, en: () => 'Issue near-expiry bags first (FIFO) to reduce wastage.' },
    { re: /^تسريع الفحص المعملي للأكياس المعلّقة لإتاحتها للتسليم\.$/, en: () => 'Accelerate lab testing for pending bags to release them for delivery.' },
    { re: /^مراجعة ظروف التخزين وسلسلة التبريد — معدل الهدر يتجاوز المستوى المقبول\.$/, en: () => 'Review storage and cold-chain conditions — wastage exceeds acceptable levels.' },
    { re: /^الوضع المخزوني مستقر — استمر في المراقبة الدورية وتحديث التوقعات\.$/, en: () => 'Inventory stable — continue periodic monitoring and forecast updates.' },
    { re: /^(.+): (\d+) كيس$/, en: (m) => `${m[1]}: ${m[2]} bag(s)` },
    { re: /^(.+) \((\d+) كيس\)$/, en: (m) => `${m[1]} (${m[2]} bag(s))` },
  ];

  const BACKEND_MSG_PATTERNS = [
    { re: /^تعذر إتمام العملية:\s*(.+)$/, en: (m) => `Could not complete operation: ${translateBackendMessage(m[1])}` },
    { re: /^لا يمكن حذف الغرفة (.+) لأنها تحتوي على أكياس مخزنة\.$/, en: (m) => `Cannot delete room ${m[1]} — it contains stored bags.` },
    { re: /^لا يمكن حذف الثلاجة (.+) من الغرفة (.+) لأنها تحتوي على أكياس مخزنة\.$/, en: (m) => `Cannot delete fridge ${m[1]} from room ${m[2]} — it contains stored bags.` },
    { re: /^لا يمكن حذف الرف (.+) من الثلاجة (.+) في الغرفة (.+) لأنه يحتوي على أكياس مخزنة\.$/, en: (m) => `Cannot delete shelf ${m[1]} from fridge ${m[2]} in room ${m[3]} — it contains stored bags.` },
    { re: /^⚠️ لا توجد سعة كافية في (.+) \/ (.+)\.\s*مطلوب (\d+) مكان \(وحدة كاملة = (\d+) أماكن\)، متاح (\d+) فقط\.$/, en: (m) => `⚠️ Not enough capacity in ${m[1]} / ${m[2]}. Needs ${m[3]} slot(s) (whole unit = ${m[4]} slots), only ${m[5]} available.` },
    { re: /^⚠️ لا توجد أرفف كافية في (.+) \/ (.+)\./, en: (m) => `⚠️ Not enough shelves in ${m[1]} / ${m[2]}.` },
    { re: /^فصيلة الدم "(.+)" غير صالحة\.$/, en: (m) => `Blood type "${m[1]}" is invalid.` },
    { re: /^(.+) يجب أن يكون 11 رقماً بالضبط\.$/, en: (m) => `${translateFieldName(m[1])} must be exactly 11 digits.` },
    { re: /^(.+) يجب أن يكون 14 رقماً بالضبط\.$/, en: (m) => `${translateFieldName(m[1])} must be exactly 14 digits.` },
    { re: /^الأكياس المحجوزة غير كافية\. المطلوب (\d+) والمحجوز (\d+)\.$/, en: (m) => `Reserved bags insufficient. Required ${m[1]}, reserved ${m[2]}.` },
  ];

  const AUDIT_ACTION_EN = {
    'تسجيل دخول ناجح': 'Successful sign-in',
    'تسجيل خروج': 'Sign-out',
    'إنشاء طلب مستشفى': 'Create hospital request',
    'إنشاء تحليل عينة': 'Create sample analysis',
    'تحديث تحليل عينة': 'Update sample analysis',
    'تحديث تكوين التخزين': 'Update storage configuration',
    'تهيئة النظام': 'System initialization',
    'نسخ احتياطي': 'Backup',
    'إضافة مستشفى': 'Add hospital',
    'تعديل بيانات كيس': 'Edit bag details',
    'تسجيل مستفيد': 'Register beneficiary',
    'تعديل مستفيد': 'Edit beneficiary',
    'حذف مستفيد': 'Delete beneficiary',
    'إضافة حساب': 'Add account',
    'تحديث حساب': 'Update account',
    'حذف حساب': 'Delete account',
  };

  const FIELD_NAME_EN = {
    'رقم الهاتف': 'Phone number',
    'الرقم القومي': 'National ID',
    'National ID': 'National ID',
  };

  function hasArabic(text) {
    return /[\u0600-\u06FF]/.test(String(text || ''));
  }

  function translateFieldName(name) {
    if (locale !== 'en') return name;
    return FIELD_NAME_EN[name] || name;
  }

  function translateBloodOutputSource(source) {
    if (source == null || locale !== 'en') return source;
    const s = String(source).trim();
    if (BACKEND_MSG_EN[s]) return BACKEND_MSG_EN[s];
    return s;
  }

  function translateAiText(text) {
    if (text == null || locale !== 'en') return text;
    const s = String(text).trim();
    if (!s) return text;
    if (AI_TITLE_EN[s]) return AI_TITLE_EN[s];
    if (AI_HEALTH_LABEL_EN[s]) return AI_HEALTH_LABEL_EN[s];
    if (AI_RISK_LEVEL_EN[s]) return AI_RISK_LEVEL_EN[s];
    for (const pattern of AI_TEXT_PATTERNS) {
      const match = s.match(pattern.re);
      if (match) return typeof pattern.en === 'function' ? pattern.en(match) : s.replace(pattern.re, pattern.en);
    }
    return translateBackendMessage(s);
  }

  function translateBackendMessage(msg) {
    if (msg == null) return msg;
    const s = String(msg).trim();
    if (!s) return msg;
    if (locale === 'ar') {
      const arFix = {
        'تعذر تحميل بيانات bootstrap. حاول التحديث أو تواصل مع الدعم.': t('msg.api.bootstrapFailed'),
        'تعذر تحميل بيانات النظام. حاول التحديث أو تواصل مع الدعم.': t('msg.api.bootstrapFailed'),
      };
      if (arFix[s]) return arFix[s];
      if (/bootstrap/i.test(s)) return s.replace(/\bbootstrap\b/gi, 'النظام');
      return s;
    }
    if (BACKEND_MSG_EN[s]) return BACKEND_MSG_EN[s];
    for (const pattern of BACKEND_MSG_PATTERNS) {
      const match = s.match(pattern.re);
      if (match) return typeof pattern.en === 'function' ? pattern.en(match) : s.replace(pattern.re, pattern.en);
    }
    if (!hasArabic(s)) return s;
    let out = s;
    const wordMap = [
      ['قيد المراجعة', 'Pending review'], ['تم القبول', 'Approved'], ['تم الرفض', 'Rejected'], ['تم التسليم', 'Delivered'],
      ['تخزين رئيسي:', 'Main storage:'], ['الحالة:', 'Status:'], ['بواسطة', 'by'], ['إلى', 'to'],
      ['دخول للمنظومة عبر API.', 'Signed in via API.'], ['خروج من المنظومة.', 'Signed out of the system.'],
      ['تم إنشاء حساب superadmin الافتراضي.', 'Default superadmin account created.'],
      ['طلب', 'Request'], ['عينة', 'Sample'], ['حالة:', 'Status:'], ['فصيلة:', 'Type:'],
      ['قبول عينة', 'Approve sample'], ['رفض عينة', 'Reject sample'], ['تحديث حالة عينة', 'Update sample status to'],
      ['تحديث عينة', 'Update sample'],       ['تم تحديث', 'Updated'], ['غرفة', 'room(s)'], ['في نظام التخزين.', 'in storage system.'],
      ['طلب نسخ احتياطي — البيانات محفوظة في db.sqlite3 على الخادم.', 'Backup requested — data stored in db.sqlite3 on server.'],
      ['تم اعتماد', 'Approved'], ['وتقسيمها إلى 3 مكونات', 'and split into 3 components'],
      ['كرات + بلازما + صفائح', 'RBC + plasma + platelets'],
      ['تم رفض واتلاف الكيس', 'Rejected and disposed bag'],
      ['السبب:', 'Reason:'],
      ['تم تسليم', 'Delivered'], ['كيس', 'bag(s)'], ['إلى', 'to'],
      ['المستلم:', 'Recipient:'],
      ['الأمراض المكتشفة:', 'Detected diseases:'],
      ['لا يوجد', 'None'],
    ];
    wordMap.forEach(([ar, en]) => { out = out.split(ar).join(en); });
    return hasArabic(out) ? s : out;
  }

  function translateAuditText(text) {
    if (!text || locale !== 'en') return text;
    const s = String(text).trim();
    if (AUDIT_ACTION_EN[s]) return AUDIT_ACTION_EN[s];
    return translateBackendMessage(s);
  }

  function getDateLocale() {
    return locale === 'ar' ? 'ar-EG' : 'en-US';
  }

  function formatLocaleDateTime(value, options) {
    if (!value) return t('common.empty');
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString(getDateLocale(), options || {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return String(value);
    }
  }

  function formatLocaleTime(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return date.toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
  }

  let locale = localStorage.getItem(STORAGE_KEY) || 'ar';
  if (locale !== 'ar' && locale !== 'en') locale = 'ar';

  function getLocale() { return locale; }

  function interpolate(str, vars) {
    if (!str || !vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? vars[name] : `{${name}}`));
  }

  function t(key, fallback, vars) {
    const parts = String(key || '').split('.');
    let node = STRINGS[locale];
    for (const part of parts) {
      if (!node || typeof node !== 'object') {
        const fb = fallback != null ? fallback : key;
        return vars ? interpolate(fb, vars) : fb;
      }
      node = node[part];
    }
    if (node == null || node === '') {
      const fb = fallback != null ? fallback : key;
      return vars ? interpolate(fb, vars) : fb;
    }
    const val = String(node);
    return vars ? interpolate(val, vars) : val;
  }

  function tf(key, vars, fallback) { return t(key, fallback, vars); }

  function alertT(key, vars) { alert(t(key, key, vars)); }

  function confirmT(key, vars) { return confirm(t(key, key, vars)); }

  function toastT(titleKey, bodyKey, vars) {
    if (typeof global.triggerToast === 'function') {
      global.triggerToast(t(titleKey, titleKey, vars), t(bodyKey, bodyKey, vars));
    }
  }

  const REQUEST_STATUS_MAP = {
    'قيد المراجعة': { key: 'badge.requestPending', cls: 'badge-warning' },
    'تم القبول': { key: 'badge.requestApproved', cls: 'badge-info' },
    'تم الرفض': { key: 'badge.requestRejected', cls: 'badge-danger' },
    'تم التسليم': { key: 'badge.requestDelivered', cls: 'badge-success' },
    'In-Progress': { key: 'badge.requestInProgress', cls: 'badge-info' },
  };

  function badgeHtml(key, cls, text) {
    const label = t(key, text);
    return `<span class="badge ${cls}">${label}</span>`;
  }

  const ui = {
    requestStatusBadge(status) {
      const cfg = REQUEST_STATUS_MAP[status];
      if (cfg) return badgeHtml(cfg.key, cfg.cls, status);
      return badgeHtml('common.unspecified', 'badge-info', t('common.unspecified'));
    },
    bagStatusBadge(status) {
      const map = { Approved: ['badge.bagApproved', 'badge-success'], Pending: ['badge.bagPending', 'badge-warning'], Reserved: ['badge.bagReserved', 'badge-info'] };
      const cfg = map[status];
      return cfg ? badgeHtml(cfg[0], cfg[1], status) : badgeHtml('common.unspecified', 'badge-info', status);
    },
    donationStatusBadge(status) {
      const map = { Approved: ['badge.donationApproved', 'badge-success'], Pending: ['badge.donationPending', 'badge-warning'], Reserved: ['badge.donationReserved', 'badge-info'] };
      const cfg = map[status];
      return cfg ? badgeHtml(cfg[0], cfg[1], status) : badgeHtml('common.unspecified', 'badge-info', status);
    },
    labStatusBadge(status) {
      const map = { Approved: ['badge.labApproved', 'badge-success'], Pending: ['badge.labPending', 'badge-warning'], Rejected: ['badge.labRejected', 'badge-danger'] };
      const cfg = map[status];
      return cfg ? badgeHtml(cfg[0], cfg[1], status) : badgeHtml('common.unspecified', 'badge-info', status);
    },
    priorityBadge(priority) {
      const p = String(priority || 'low').toLowerCase();
      if (p === 'critical') return badgeHtml('badge.priorityCritical', 'badge-danger', 'Critical');
      if (p === 'high' || p === 'urgent') return badgeHtml('badge.priorityHigh', 'badge-warning', 'High');
      if (p === 'medium') return badgeHtml('badge.priorityMedium', 'badge-info', 'Medium');
      return badgeHtml('badge.priorityLow', 'badge-success', 'Low');
    },
    inventoryHealthBadge(level) {
      const map = { safe: ['badge.inventorySafe', 'badge-success'], low: ['badge.inventoryLow', 'badge-warning'], critical: ['badge.inventoryCritical', 'badge-danger'] };
      const cfg = map[level];
      return cfg ? badgeHtml(cfg[0], cfg[1], level) : badgeHtml('badge.inventorySafe', 'badge-success', level);
    },
    accountStatusBadge(status) {
      return status === 'active'
        ? badgeHtml('badge.accountActive', 'badge-success', 'active')
        : badgeHtml('badge.accountInactive', 'badge-danger', 'inactive');
    },
    roleLabel(role) {
      const raw = String(role || '').trim();
      if (locale === 'en' && ROLE_LABEL_AR[raw]) return t(ROLE_LABEL_AR[raw]);
      const r = raw.toLowerCase();
      if (r === 'superadmin' || r === 'dr') return t('role.superadmin');
      if (r === 'admin' || r === 'adm') return t('role.admin');
      if (r === 'lab' || r === 'mls') return t('role.lab');
      return raw || t('role.lab');
    },
    daysLeftLabel(days) {
      const d = Number(days);
      if (d < 0) return t('toast.daysExpired');
      if (d === 0) return t('toast.daysToday');
      if (d === 1) return t('toast.daysTomorrow');
      return `${d} ${t('table.daysLeftUnit')}`;
    },
    formatDonorName(name) {
      const value = String(name ?? '').trim();
      const lowered = value.toLowerCase();
      if (!value || lowered === 'unknown' || value === 'مجهول' || lowered === 'donor.unknown') {
        return t('donor.unknown');
      }
      return value;
    },
    formatTableDate(value, dateOnly) {
      if (!value) return t('common.empty');
      try {
        const raw = String(value).trim();
        const date = /[T ]/.test(raw) ? new Date(raw) : new Date(`${raw}T00:00:00`);
        if (Number.isNaN(date.getTime())) return raw;
        const loc = getDateLocale();
        if (dateOnly) {
          return date.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return date.toLocaleString(loc, {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
      } catch {
        return String(value);
      }
    },
    formatLocation(location) {
      if (!location) return t('common.empty');
      if (locale !== 'en') return String(location);
      return String(location).replace(/تخزين رئيسي:/g, 'Main storage:');
    },
    formatWorker(name) {
      if (!name) return t('common.empty');
      if (locale === 'en' && (name === 'النظام' || name === 'System')) return 'System';
      return String(name);
    },
    formatChatSender(name) {
      const s = String(name || '').trim();
      if (!s || s.toLowerCase() === 'unknown' || s === 'غير معروف') return t('common.unknownUser');
      if (locale === 'en' && (s === '📢 النظام' || s === 'النظام')) return t('chat.systemSender');
      return s || t('common.user');
    },
  };

  function applyDocumentDirection() {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.body?.classList.toggle('locale-en', locale === 'en');
    document.body?.classList.toggle('locale-ar', locale === 'ar');
    document.title = t('app.title');
  }

  function applyDataI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key, '');
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key, '');
      if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const val = t(key, '');
      if (val) el.title = val;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      const val = t(key, '');
      if (val) el.setAttribute('aria-label', val);
    });
  }

  function applyFilterSelects() {
    const maps = {
      'inventory-filter-blood': [{ v: '', k: 'filter.allBloodTypes' }],
      'inventory-filter-product': [
        { v: '', k: 'filter.allProducts' }, { v: 'RBC', k: 'product.RBCshort' }, { v: 'Plasma', k: 'product.Plasma' }, { v: 'Platelets', k: 'product.Plateletsshort' },
      ],
      'inventory-filter-status': [
        { v: '', k: 'filter.allActiveStatuses' }, { v: 'Approved', k: 'filter.approved' }, { v: 'Pending', k: 'filter.pending' }, { v: 'Reserved', k: 'filter.reserved' },
      ],
      'lab-filter-status': [
        { v: '', k: 'filter.allStatuses' }, { v: 'Pending', k: 'filter.pending' }, { v: 'Approved', k: 'filter.approved' }, { v: 'Rejected', k: 'filter.rejected' },
      ],
      'new-account-role': [{ v: 'admin', k: 'section.roleAdmin' }, { v: 'lab', k: 'section.roleLab' }],
      'edit-account-role': [{ v: 'admin', k: 'section.roleAdmin' }, { v: 'lab', k: 'section.roleLab' }],
      'edit-account-status': [{ v: 'active', k: 'section.accountActive' }, { v: 'inactive', k: 'section.accountInactive' }],
    };
    Object.entries(maps).forEach(([id, opts]) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      opts.forEach((o, i) => {
        const opt = sel.options[i];
        if (opt && opt.value === o.v) opt.textContent = t(o.k);
      });
    });
    document.querySelectorAll('[data-i18n-option]').forEach((opt) => {
      opt.textContent = t(opt.getAttribute('data-i18n-option'), opt.textContent);
    });
  }

  function applyNavLabels() {
    const navMap = {
      dashboard: 'nav.dashboard', statistics: 'nav.statistics', donations: 'nav.donations', lab: 'nav.lab',
      inventory: 'nav.inventory', storage: 'nav.storage', requests: 'nav.requests', hospitals: 'nav.hospitals',
      donors: 'nav.donors', beneficiaries: 'nav.beneficiaries', audit: 'nav.audit', disposal: 'nav.disposal',
    };
    document.querySelectorAll('.nav-item[data-pages]').forEach((btn) => {
      const key = navMap[btn.dataset.pages];
      const textEl = btn.querySelector('.nav-text');
      if (key && textEl) textEl.textContent = t(key);
    });
  }

  function applyTopbarStatic() {
    document.querySelectorAll('.topbar-left .topbar-pill').forEach((btn) => {
      const onclick = btn.getAttribute('onclick') || '';
      let key = null;
      if (onclick.includes('notifications')) key = 'topbar.notifications';
      if (onclick.includes('messages')) key = 'topbar.messages';
      if (!key) return;
      const iconWrap = btn.querySelector('.topbar-icon-wrap');
      btn.replaceChildren();
      if (iconWrap) btn.appendChild(iconWrap);
      btn.append(document.createTextNode(` ${t(key)}`));
    });
    const profileMenu = document.getElementById('profile-menu');
    if (profileMenu) {
      const buttons = profileMenu.querySelectorAll('button');
      if (buttons[0]) buttons[0].textContent = t('topbar.profile');
      if (buttons[1]) buttons[1].textContent = t('topbar.settings');
      if (buttons[2]) buttons[2].textContent = t('topbar.logout');
    }
    const langLabel = document.getElementById('lang-toggle-label');
    if (langLabel) langLabel.textContent = t('topbar.langSwitch');
    const langLogin = document.getElementById('lang-toggle-label-login');
    if (langLogin) langLogin.textContent = t('topbar.langSwitch');
    document.querySelectorAll('.lang-toggle').forEach((btn) => {
      btn.title = t('topbar.langSwitchTitle');
    });
  }

  function applyTableHeaders() {
    const maps = {
      'table-donations-full': ['table.bagId', 'table.donor', 'table.component', 'table.bloodType', 'table.qty', 'table.date', 'table.bagStatus', 'table.storageLocation'],
      'table-inventory-bags-full': ['table.bagId', 'table.component', 'table.bloodType', 'table.donor', 'table.addDate', 'table.expiry', 'table.daysLeft', 'table.status', 'table.location', 'table.actions'],
      'table-inventory-summary-full': ['table.bloodType', 'table.component', 'table.available', 'table.reserved', 'table.issued', 'table.expired', 'table.medicalStatus'],
      'table-donors-full': ['table.fileNo', 'table.fullName', 'table.bloodType', 'table.phone', 'table.age', 'table.address', 'table.lastDonation', 'table.donationCount'],
      'table-beneficiaries-full': ['table.name', 'table.phone', 'table.nationalId', 'table.consumedType', 'table.component', 'table.consumed', 'table.registeredAt', 'table.actions'],
      'table-lab-full': ['table.bagId', 'table.donor', 'table.component', 'table.bloodType', 'table.labStatus', 'table.date', 'table.actions'],
      'table-requests-full': ['table.requestId', 'table.destinationHospital', 'table.bloodType', 'table.component', 'table.qty', 'table.priority', 'table.status', 'table.actions'],
      'table-hospitals-full': ['table.hospitalName', 'table.address', 'table.phone', 'table.managerName', 'table.actions'],
      'table-hospital-deliveries-full': ['table.requestId', 'table.hospital', 'table.bloodType', 'table.qty', 'table.recipient', 'table.recipientPhone', 'table.date'],
      'table-disposal-full': ['table.damagedBagId', 'table.bagType', 'table.component', 'table.bloodType', 'table.donor', 'table.diseases', 'table.disposalDate', 'table.medicalReason', 'table.responsibleWorker'],
      'table-audit-full': ['table.timestamp', 'table.worker', 'table.role', 'table.actionType', 'table.actionDetails'],
      'table-accounts-full': ['table.username', 'table.fullName', 'table.role', 'table.email', 'table.accountStatus', 'table.actions'],
      'table-dashboard-blood-output': ['table.source', 'table.name', 'table.bloodType', 'table.component', 'table.count', 'table.date'],
      'table-blood-output-recent': ['table.source', 'table.name', 'table.bloodType', 'table.component', 'table.count', 'table.date'],
      'table-dashboard-urgent': ['table.hospital', 'table.bloodType', 'table.component', 'table.qty', 'table.priority', 'table.actions'],
    };
    Object.entries(maps).forEach(([tbodyId, keys]) => {
      const tbody = document.getElementById(tbodyId);
      const table = tbody?.closest('table');
      const headers = table?.querySelectorAll('thead th');
      if (!headers) return;
      keys.forEach((key, i) => {
        if (headers[i]) headers[i].textContent = t(key);
      });
    });
    // inventory summary uses different tbody id
    const summaryBody = document.getElementById('table-inventory-summary');
    if (summaryBody) {
      const headers = summaryBody.closest('table')?.querySelectorAll('thead th');
      const keys = maps['table-inventory-summary-full'];
      if (headers && keys) keys.forEach((key, i) => { if (headers[i]) headers[i].textContent = t(key); });
    }
  }

  function applyModalShell(modalId, titleKey, subtitleKey, footerBtns) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const h3 = modal.querySelector('h3');
    const sub = modal.querySelector('.modal-subtitle');
    if (h3 && titleKey) h3.textContent = t(titleKey);
    if (sub && subtitleKey) sub.textContent = t(subtitleKey);
    modal.querySelectorAll('.modal-close-btn').forEach((b) => {
      b.setAttribute('aria-label', t('topbar.close'));
    });
    (footerBtns || []).forEach(({ sel, key, index }) => {
      const nodes = modal.querySelectorAll(sel);
      const el = typeof index === 'number' ? nodes[index] : nodes[0];
      if (el && key) el.textContent = t(key);
    });
  }

  function applyProductSelectOptions() {
    const productMap = {
      RBC: 'product.RBC',
      Plasma: 'product.Plasma',
      Platelets: 'product.Platelets',
    };
    document.querySelectorAll('select option[value="RBC"], select option[value="Plasma"], select option[value="Platelets"]').forEach((opt) => {
      const key = productMap[opt.value];
      if (key) opt.textContent = t(key);
    });
  }

  function applyPrioritySelect() {
    const keys = ['priority.critical', 'priority.high', 'priority.medium', 'priority.low'];
    ['req-priority', 'edit-request-priority'].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      Array.from(sel.options).forEach((opt, i) => {
        if (keys[i]) opt.textContent = t(keys[i]);
      });
    });
  }

  function applyBagStatusSelect() {
    const sel = document.getElementById('edit-bag-status');
    if (!sel) return;
    const map = { Approved: 'filter.approved', Pending: 'filter.pending', Rejected: 'filter.rejected' };
    Array.from(sel.options).forEach((opt) => {
      const key = map[opt.value];
      if (key) opt.textContent = t(key);
    });
  }

  function populateEditAccountRoleSelect(selectEl, accountRole) {
    if (!selectEl) return;
    if (accountRole === 'superadmin') {
      selectEl.innerHTML = `<option value="superadmin">${t('section.roleSuperAdmin')}</option>`;
      selectEl.value = 'superadmin';
      selectEl.disabled = true;
      return;
    }
    selectEl.innerHTML = `<option value="admin">${t('section.roleAdmin')}</option><option value="lab">${t('section.roleLab')}</option>`;
    selectEl.value = accountRole === 'lab' ? 'lab' : 'admin';
    selectEl.disabled = false;
  }

  function applyRequestStatusSelect() {
    const sel = document.getElementById('edit-request-status');
    if (!sel) return;
    const keys = ['badge.requestPending', 'badge.requestApproved', 'badge.requestRejected', 'badge.requestDelivered'];
    Array.from(sel.options).forEach((opt, i) => {
      if (keys[i]) opt.textContent = t(keys[i]);
    });
  }

  function applyDonationModalExtras() {
    const bagHint = document.querySelector('#donation-section-bag > div[style*="background"]');
    const donorHint = document.querySelector('#donation-section-donor > div[style*="background"]');
    if (bagHint) bagHint.innerHTML = t('donation.bagModeHint');
    if (donorHint) donorHint.innerHTML = t('donation.donorModeHint');
    document.querySelectorAll('.don-mode-option').forEach((label) => {
      const input = label.querySelector('input[name="don-mode"]');
      if (!input) return;
      const text = input.value === 'bag' ? t('form.entryBag') : t('form.entryDonor');
      label.lastChild.textContent = ` ${text}`;
    });
    const placeholders = [
      ['donor-fullname', 'form.placeholder.fullName'],
      ['donor-national', 'form.placeholder.nationalId14'],
      ['donor-phone', 'form.placeholder.phone11'],
      ['donor-address', 'form.placeholder.addressFull'],
      ['req-hospital-input', 'form.placeholder.hospitalSearch'],
      ['delivery-recipient-name', 'form.placeholder.recipientName'],
      ['delivery-notes', 'form.placeholder.deliveryNotes'],
      ['new-hospital-name', 'form.placeholder.hospitalNameExample'],
      ['new-hospital-address', 'form.placeholder.hospitalAddressExample'],
      ['new-hospital-manager', 'form.placeholder.managerExample'],
      ['new-hospital-phone', 'form.placeholder.hospitalPhoneExample'],
      ['new-account-username', 'form.placeholder.usernameExample'],
      ['new-account-name', 'form.placeholder.fullNameQuad'],
      ['new-account-password', 'form.placeholder.strongPassword'],
      ['edit-account-password', 'form.placeholder.newPassword'],
      ['dispose-bag', 'form.placeholder.bagCodeExample'],
      ['dispose-reason', 'form.placeholder.disposalReason'],
      ['m-dr-name', 'form.placeholder.fullNameQuad'],
      ['m-dr-phone', 'form.placeholder.phone11'],
      ['new-beneficiary-name', 'form.placeholder.fullName'],
      ['new-beneficiary-phone', 'form.placeholder.phone11'],
      ['new-beneficiary-national-id', 'form.placeholder.nationalId14'],
    ];
    placeholders.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.placeholder = t(key);
    });
  }

  function applyDonorProfileModal() {
    const modal = document.getElementById('modal-donor-profile');
    if (!modal) return;
    modal.querySelectorAll('span[style*="color:var(--text-gray)"]').forEach((span, i) => {
      const keys = ['modal.donorProfile.totalDonations', 'render.nationalIdLabel', 'modal.donorProfile.lastDonation'];
      if (keys[i]) span.textContent = t(keys[i]);
    });
    const closeBtn = modal.querySelector('.modal-footer .btn-secondary');
    if (closeBtn) closeBtn.textContent = t('modal.donorProfile.closeWindow');
  }

  function applyModals() {
    const modalMap = [
      ['modal-add-account', 'h3', 'modal.addAccount.title', 'p.modal-subtitle', 'modal.addAccount.subtitle'],
    ];
    const addAccount = document.getElementById('modal-add-account');
    if (addAccount) {
      const h3 = addAccount.querySelector('h3');
      const sub = addAccount.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.addAccount.title');
      if (sub) sub.textContent = t('modal.addAccount.subtitle');
      const cancel = addAccount.querySelector('.btn-secondary');
      const save = addAccount.querySelector('.btn-primary');
      if (cancel) cancel.textContent = t('common.cancel');
      if (save) save.textContent = t('btn.saveAccount');
    }
    const editAccount = document.getElementById('modal-edit-account');
    if (editAccount) {
      const title = editAccount.querySelector('#edit-account-title') || editAccount.querySelector('h3');
      const sub = editAccount.querySelector('.modal-subtitle');
      if (title) title.textContent = t('modal.editAccount.title');
      if (sub) sub.textContent = t('modal.editAccount.subtitle');
      editAccount.querySelectorAll('.btn-secondary').forEach((b) => { b.textContent = t('common.cancel'); });
      const save = editAccount.querySelector('.btn-primary');
      if (save) save.textContent = t('btn.saveChanges');
      const del = editAccount.querySelector('#edit-account-delete-btn');
      if (del) del.textContent = t('btn.deleteAccount');
    }
    const labModal = document.getElementById('modal-lab-test');
    if (labModal) {
      const h3 = labModal.querySelector('h3');
      const sub = labModal.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.labTest.title');
      if (sub) sub.textContent = t('modal.labTest.subtitle');
      const hint = document.getElementById('lab-split-hint');
      if (hint) hint.textContent = t('modal.labTest.splitHint');
      const bloodSel = document.getElementById('lab-type');
      if (bloodSel && bloodSel.options[0]) bloodSel.options[0].textContent = t('form.placeholder.selectBloodType');
      const reason = document.getElementById('lab-reason');
      if (reason) reason.placeholder = t('form.placeholder.labRejectReason');
    }
    const disposeModal = document.getElementById('modal-dispose-bag');
    if (disposeModal) {
      const h3 = disposeModal.querySelector('h3');
      const sub = disposeModal.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.disposeBag.title');
      if (sub) sub.textContent = t('modal.disposeBag.subtitle');
      const reason = document.getElementById('dispose-bag-reason');
      if (reason) reason.placeholder = t('form.placeholder.disposeReasonText');
      const cancelD = disposeModal.querySelector('.modal-footer .btn-secondary');
      const confirmD = disposeModal.querySelector('.modal-footer .btn-danger');
      if (cancelD) cancelD.textContent = t('common.cancel');
      if (confirmD) confirmD.textContent = t('btn.confirmDispose');
    }
    const donationModal = document.getElementById('modal-add-donation');
    if (donationModal) {
      const h3 = donationModal.querySelector('h3');
      const sub = donationModal.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.addDonation.title');
      if (sub) sub.textContent = t('modal.addDonation.subtitle');
      const cancelDn = donationModal.querySelector('.modal-footer .btn-secondary');
      const saveDn = donationModal.querySelector('.modal-footer .btn-primary');
      if (cancelDn) cancelDn.textContent = t('common.cancel');
      if (saveDn) saveDn.textContent = t('btn.submitDonation');
    }
    const donorProfile = document.getElementById('modal-donor-profile');
    if (donorProfile) {
      const h3 = donorProfile.querySelector('#dp-title') || donorProfile.querySelector('h3');
      const sub = donorProfile.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.donorProfile.title');
      if (sub) sub.textContent = t('modal.donorProfile.subtitle');
    }
    const secretModal = document.getElementById('modal-superadmin-secret');
    if (secretModal) {
      const h3 = secretModal.querySelector('h3');
      if (h3) h3.textContent = t('modal.sensitiveAction.title');
      const sub = secretModal.querySelector('.modal-subtitle');
      if (sub) sub.textContent = t('modal.sensitiveAction.subtitle');
      const verify = secretModal.querySelector('#superadmin-secret-message + div');
      if (verify) verify.textContent = t('modal.sensitiveAction.verifyHint');
      secretModal.querySelectorAll('.btn-secondary').forEach((b) => { b.textContent = t('common.cancel'); });
      const confirmBtn = secretModal.querySelector('.btn-danger');
      if (confirmBtn) confirmBtn.textContent = t('btn.confirmExecute');
      const pw = document.getElementById('superadmin-secret-password');
      if (pw) pw.placeholder = t('form.placeholder.superAdminPassword');
    }
    const editDisposal = document.getElementById('modal-edit-disposal');
    if (editDisposal) {
      const h3 = editDisposal.querySelector('h3');
      const sub = editDisposal.querySelector('.modal-subtitle');
      if (h3) h3.textContent = t('modal.editDisposal.title');
      if (sub) sub.textContent = t('modal.editDisposal.subtitle');
      editDisposal.querySelectorAll('.modal-footer .btn-secondary').forEach((b) => { b.textContent = t('common.cancel'); });
      const saveDisp = editDisposal.querySelector('.modal-footer .btn-primary');
      if (saveDisp) saveDisp.textContent = t('btn.saveChanges');
    }
    const modalShells = [
      ['modal-edit-bag', 'modal.editBag.title', 'modal.editBag.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '#btn-delete-bag-from-modal', key: 'btn.deleteBag' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveBagEdit' },
      ]],
      ['modal-add-beneficiary', 'modal.addBeneficiary.title', 'modal.addBeneficiary.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveBeneficiary' },
      ]],
      ['modal-edit-beneficiary', 'modal.editBeneficiary.title', 'modal.editBeneficiary.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'common.save' },
      ]],
      ['modal-edit-donor', 'modal.editDonor.title', 'modal.editDonor.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveChanges' },
      ]],
      ['modal-edit-hospital', 'modal.editHospital.title', 'modal.editHospital.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveChanges' },
      ]],
      ['modal-edit-request', 'modal.editRequest.title', 'modal.editRequest.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveChanges' },
      ]],
      ['modal-add-request', 'modal.addRequest.title', 'modal.addRequest.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.sendRequest' },
      ]],
      ['modal-deliver-request', 'modal.deliverRequest.title', 'modal.deliverRequest.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.confirmDelivery' },
      ]],
      ['modal-add-donor', 'modal.addDonor.title', 'modal.addDonor.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveDonor' },
      ]],
      ['modal-add-hospital', 'modal.addHospital.title', 'modal.addHospital.subtitle', [
        { sel: '.modal-footer .btn-secondary', key: 'common.cancel' },
        { sel: '.modal-footer .btn-primary', key: 'btn.saveHospital' },
      ]],
    ];
    modalShells.forEach(([id, title, sub, footers]) => applyModalShell(id, title, sub, footers));
    applyDonationModalExtras();
    applyDonorProfileModal();
    applyProductSelectOptions();
    applyPrioritySelect();
    applyRequestStatusSelect();
    applyBagStatusSelect();
  }

  function applySectionHints() {
    const hints = [
      ['section.hospitalsHint', '.page#page-hospitals .card-header div[style*="font-size:13px"]'],
    ];
    const hospHint = document.querySelector('#page-hospitals .card-header div[style*="font-size:13px"]');
    if (hospHint) hospHint.textContent = t('section.hospitalsHint');
    const delHint = document.querySelector('#page-hospitals .card:nth-child(2) div[style*="font-size:13px"]');
    if (delHint) delHint.textContent = t('section.deliveriesHint');
    const auditHint = document.querySelector('#page-audit div[style*="font-size:14px"]');
    if (auditHint) auditHint.textContent = t('section.auditHint');
    const auditBadge = document.querySelector('#page-audit .badge-danger');
    if (auditBadge) auditBadge.textContent = t('section.auditAdminOnly');
    const dispHint = document.querySelector('#page-disposal div[style*="font-size:14px"]');
    if (dispHint) dispHint.textContent = t('section.disposalHint');
    const adminAccounts = document.querySelector('#admin-accounts-section h3');
    if (adminAccounts) adminAccounts.textContent = t('cards.accountsMgmt');
    const storageCfg = document.querySelector('#page-admin-settings h3');
    if (storageCfg && storageCfg.textContent.includes('🗄️')) storageCfg.textContent = t('storage.configTitle');
    const adminSecurity = document.getElementById('admin-security-section');
    if (adminSecurity) {
      const title = adminSecurity.querySelector('h3');
      const badge = adminSecurity.querySelector('.badge-danger');
      const hint = adminSecurity.querySelector('div[style*="font-size:14px"]');
      if (title) title.textContent = t('cards.superAdminActions');
      if (badge) badge.textContent = t('section.passwordRequired');
      if (hint) hint.textContent = t('section.superAdminSecurityHint');
    }
    document.querySelectorAll('#admin-accounts-section .btn-primary.btn-sm').forEach((b) => {
      if ((b.getAttribute('onclick') || '').includes('modal-add-account')) b.textContent = t('btn.addAccount');
    });
  }

  function applyLabSummaryLine() {
    const el = document.getElementById('lab-summary-line');
    if (!el) return;
    const pending = document.getElementById('lab-pending-count')?.textContent || '0';
    const approved = document.getElementById('lab-approved-count')?.textContent || '0';
    const rejected = document.getElementById('lab-rejected-count')?.textContent || '0';
    el.innerHTML = `<strong style="color:var(--info);">${t('section.labSummary')}</strong> ${t('section.labPending')} <span id="lab-pending-count" style="color:var(--gold);">${pending}</span> | ${t('section.labApproved')} <span id="lab-approved-count" style="color:var(--success);">${approved}</span> | ${t('section.labRejected')} <span id="lab-rejected-count" style="color:var(--red);">${rejected}</span>`;
  }

  function applyStaticButtons() {
    const btnMap = [
      ['btn-add-beneficiary', 'btn.addBeneficiary'],
      ['btn-quick-donation', 'btn.addDonation'],
    ];
    btnMap.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    });
    const loginBtn = document.getElementById('login-submit-btn');
    if (loginBtn && !loginBtn.disabled) {
      loginBtn.innerHTML = `<span data-i18n="login.submit">${t('login.submit')}</span>`;
    }
    document.querySelectorAll('[data-i18n-btn]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n-btn'), el.textContent);
    });
  }

  function setLocale(next) {
    locale = next === 'en' ? 'en' : 'ar';
    localStorage.setItem(STORAGE_KEY, locale);
    applyI18n();
  }

  function toggleLocale() {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }

  function applyI18n() {
    applyDocumentDirection();
    applyDataI18n();
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.setAttribute('aria-label', t('topbar.close'));
    });
    applyNavLabels();
    applyTopbarStatic();
    applyTableHeaders();
    applyFilterSelects();
    applyStaticButtons();
    applyLabSummaryLine();
    applyModals();
    applySectionHints();
    applyRequestStatusSelect();
    applyBagStatusSelect();
    if (typeof global.updatePageHeader === 'function') {
      global.updatePageHeader(global.getActivePageId?.() || 'dashboard');
    }
    if (typeof global.renderAllViews === 'function') {
      global.renderAllViews();
    }
    if (typeof global.updateLiveClock === 'function') {
      global.updateLiveClock();
    }
  }

  function initLocale() {
    applyI18n();
  }

  global.I18n = {
    t, tf, getLocale, setLocale, toggleLocale, apply: applyI18n, init: initLocale, ui,
    alertT, confirmT, toastT, trMsg: translateBackendMessage, translateAuditText,
    translateAiText, translateBloodOutputSource, populateEditAccountRoleSelect,
    formatLocaleDateTime, formatLocaleTime, formatTableDate: ui.formatTableDate, formatDonorName: ui.formatDonorName,
    getDateLocale, REQUEST_STATUS_AR,
  };
  global.populateEditAccountRoleSelect = populateEditAccountRoleSelect;
  global.t = t;
  global.tf = tf;
  global.trMsg = translateBackendMessage;
  global.translateAuditText = translateAuditText;
  global.translateAiText = translateAiText;
  global.translateBloodOutputSource = translateBloodOutputSource;
  global.alertT = alertT;
  global.confirmT = confirmT;
  global.toastT = toastT;
  global.toggleLocale = toggleLocale;
  global.initLocale = initLocale;
  global.formatLocaleDateTime = formatLocaleDateTime;
  global.formatLocaleTime = formatLocaleTime;
  global.formatTableDate = (value, dateOnly) => ui.formatTableDate(value, dateOnly);
  global.getDateLocale = getDateLocale;
})(window);
