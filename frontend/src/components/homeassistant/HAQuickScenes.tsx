import { useTranslation } from 'react-i18next';
import { Film } from 'lucide-react';
import type { HAEntity } from './types';

interface HAQuickScenesProps {
  formattedDate: string;
  activeDevicesCount: number;
  quickBooleans: HAEntity[];
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
}

export function HAQuickScenes({
  formattedDate,
  activeDevicesCount,
  quickBooleans,
  isPending,
  onToggle,
}: HAQuickScenesProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2.5 text-xs text-secondary flex-wrap">
        <span className="font-semibold text-primary">{t('homeassistant.hello', 'Olá! 👋')}</span>
        <span className="text-secondary/50">•</span>
        <span className="capitalize">{formattedDate}</span>
        <span className="text-secondary/50">•</span>
        <span className="font-medium text-saturn-600 dark:text-saturn-400">
          {activeDevicesCount} {t('homeassistant.active_devices', 'dispositivos ativos')}
        </span>
      </div>

      {/* Cenas Rápidas Compactas */}
      {quickBooleans.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {quickBooleans.map((bool) => {
            const isOn = bool.state === 'on';
            const pending = isPending(bool.entity_id);
            return (
              <button
                key={bool.entity_id}
                onClick={() => onToggle(bool)}
                disabled={pending}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                  isOn
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/10 font-bold'
                    : 'bg-card/70 border-border/80 text-secondary hover:text-primary hover:bg-card'
                }`}
              >
                <Film className={`w-3.5 h-3.5 ${isOn ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                <span>{bool.attributes.friendly_name || t('homeassistant.cinema_mode')}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
