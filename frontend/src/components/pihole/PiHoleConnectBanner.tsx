import { useTranslation } from 'react-i18next';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface PiHoleConnectBannerProps {
  onOpenConfig: () => void;
}

export function PiHoleConnectBanner({ onOpenConfig }: PiHoleConnectBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-8 sm:p-12 text-center flex flex-col items-center max-w-xl mx-auto space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-primary">
        {t('pihole.connect_banner_title')}
      </h2>
      <p className="text-xs text-secondary leading-relaxed max-w-md">
        {t('pihole.connect_banner_desc')}
      </p>
      <button
        type="button"
        onClick={onOpenConfig}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 shadow-lg shadow-orbit-500/25 active:scale-95 transition-all mt-2"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>{t('pihole.connect_button_cta')}</span>
      </button>
    </div>
  );
}
