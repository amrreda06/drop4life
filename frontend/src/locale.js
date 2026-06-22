const STORAGE_KEY = 'drop4life_locale';

export function getSavedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

const SHELL_STRINGS = {
  ar: {
    checkingSession: 'جاري التحقق من الجلسة...',
    loadingApp: 'جاري تحميل التطبيق...',
    title: 'Drop4Life — بنك الدم الذكي',
  },
  en: {
    checkingSession: 'Checking session...',
    loadingApp: 'Loading application...',
    title: 'Drop4Life — Smart Blood Bank',
  },
};

export function shellText(key) {
  const locale = getSavedLocale();
  return SHELL_STRINGS[locale][key] || SHELL_STRINGS.en[key] || key;
}

export function applyShellDocumentLocale() {
  const locale = getSavedLocale();
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.title = shellText('title');
}
