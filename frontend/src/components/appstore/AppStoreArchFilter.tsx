import { Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface AppStoreArchFilterProps {
  selectedArch: string;
  onSelectArch: (arch: string) => void;
  hostArch?: string;
}

export function AppStoreArchFilter({
  selectedArch,
  onSelectArch,
  hostArch,
}: AppStoreArchFilterProps) {
  const { t } = useTranslation();
  const options = [
    { id: 'all', label: t('store.arch_all', 'Todas as CPUs') },
    ...(hostArch
      ? [{ id: 'compatible', label: t('store.arch_compatible_host', `Compatível (${hostArch})`) }]
      : []),
    { id: 'multi', label: 'x86 & ARM' },
    { id: 'x86', label: 'Apenas x86' },
    { id: 'arm', label: 'Apenas ARM' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center gap-1 text-xs text-secondary mr-1">
        <Cpu className="w-3.5 h-3.5 text-saturn-500" />
        <span className="hidden sm:inline">{t('store.arch_filter_label', 'CPU:')}</span>
      </div>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelectArch(opt.id)}
          className={`text-xs px-2.5 py-1 rounded-lg transition-all font-medium border ${
            selectedArch === opt.id
              ? 'bg-saturn-500 text-white border-saturn-500 shadow-sm shadow-saturn-500/20'
              : 'bg-card text-secondary hover:text-primary border-border hover:border-border/80'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
