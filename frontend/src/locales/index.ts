export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

export const supportedLanguages: LanguageOption[] = [
  { code: 'pt', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Simplified Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
];

// Dynamically load all modular JSON namespaces from subdirectories
const modules = import.meta.glob<Record<string, any>>('./*/*.json', { eager: true });

export const resources: Record<string, { translation: Record<string, any> }> = {};

for (const path in modules) {
  const match = path.match(/\.\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\.json$/);
  if (match) {
    const [, lang, domain] = match;
    if (!resources[lang]) {
      resources[lang] = { translation: {} };
    }
    const mod = modules[path] as { default?: any };
    resources[lang].translation[domain] = mod.default || mod;
  }
}

// Backward compatibility exports
export const pt = resources.pt?.translation || {};
export const en = resources.en?.translation || {};
export default resources;
