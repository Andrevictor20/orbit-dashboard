import { useState, useEffect, useRef } from 'react';
import { Palette, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface LanguageOption {
  code: string;
  flag: string;
  nativeName: string;
}

export interface MobilePreferencesDropdownProps {
  color: string;
  onColorChange: (val: string) => void;
  currentLang: string;
  onLangChange: (val: string) => void;
  languages: LanguageOption[];
}

export const COLOR_THEMES_LIST = [
  { value: 'zinc', label: 'Zinc', dot: 'bg-zinc-500' },
  { value: 'rose', label: 'Rose', dot: 'bg-rose-500' },
  { value: 'blue', label: 'Blue', dot: 'bg-blue-500' },
  { value: 'green', label: 'Green', dot: 'bg-emerald-500' },
  { value: 'catppuccin', label: 'Catppuccin', dot: 'bg-purple-400' },
  { value: 'tokyonight', label: 'Tokyo Night', dot: 'bg-indigo-400' },
  { value: 'gruvbox', label: 'Gruvbox', dot: 'bg-amber-600' },
  { value: 'nord', label: 'Nord', dot: 'bg-sky-400' },
  { value: 'dracula', label: 'Dracula', dot: 'bg-fuchsia-500' },
  { value: 'onedark', label: 'One Dark', dot: 'bg-blue-600' },
  { value: 'synthwave', label: 'Synthwave', dot: 'bg-pink-500' },
];

export function MobilePreferencesDropdown({
  color,
  onColorChange,
  currentLang,
  onLangChange,
  languages,
}: MobilePreferencesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative sm:hidden" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/70 bg-card/50 hover:bg-card/85 hover:border-orbit-500/40 backdrop-blur-2xl transition-all duration-200 text-secondary hover:text-primary active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none"
        title="Preferências (Tema e Idioma)"
        aria-label="Preferências (Tema e Idioma)"
        aria-expanded={isOpen}
      >
        <Palette className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border/80 bg-card/95 backdrop-blur-3xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              {t('header.preferences', 'Preferências')}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              aria-label="Fechar preferências"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Color Theme Selector */}
            <div>
              <span className="text-[11px] font-medium text-secondary mb-1.5 block">
                {t('header.color_theme', 'Tema de Cores')}
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {COLOR_THEMES_LIST.map((th) => (
                  <button
                    key={th.value}
                    onClick={() => {
                      onColorChange(th.value);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                      color === th.value
                        ? 'bg-orbit-500/15 text-orbit-500 font-semibold border border-orbit-500/30'
                        : 'text-primary hover:bg-accent/60'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${th.dot}`} />
                    <span className="truncate">{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <span className="text-[11px] font-medium text-secondary mb-1.5 block">
                {t('header.language', 'Idioma')}
              </span>
              <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLangChange(lang.code);
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                      currentLang === lang.code
                        ? 'bg-orbit-500/15 text-orbit-500 font-semibold border border-orbit-500/30'
                        : 'text-primary hover:bg-accent/60'
                    }`}
                  >
                    <span className="text-sm shrink-0">{lang.flag}</span>
                    <span className="truncate">{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
