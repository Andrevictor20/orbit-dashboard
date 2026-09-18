import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, supportedLanguages } from './locales';

export { supportedLanguages };
export type { LanguageOption } from './locales';

const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('saturn_language') : null;
const initialLanguage = savedLanguage || 'pt';

const syncDocumentDirection = (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
    const langConfig = supportedLanguages.find((l) => l.code === lng);
    const isRtl = langConfig?.dir === 'rtl' || lng === 'ar' || (i18n.dir && i18n.dir(lng) === 'rtl');
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }
};

// Apply direction on initial load
syncDocumentDirection(initialLanguage);

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('saturn_language', lng);
    syncDocumentDirection(lng);
  }
});

export default i18n;
