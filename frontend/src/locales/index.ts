import { pt } from './pt';
import { en } from './en';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const supportedLanguages: LanguageOption[] = [
  { code: 'pt', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
];

export const resources = {
  pt: { translation: pt },
  en: { translation: en },
};
