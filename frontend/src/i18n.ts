import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, supportedLanguages } from './locales';

export { supportedLanguages };
export type { LanguageOption } from './locales';

const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('orbit_language') : null;
const initialLanguage = savedLanguage || 'pt';

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
    localStorage.setItem('orbit_language', lng);
  }
});

export default i18n;
