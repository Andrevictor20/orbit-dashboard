import React from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Battery, BatteryLow, BatteryMedium, MapPin } from 'lucide-react';
import type { GroupedMobileDevice } from './types';

interface DeviceCardMobileProps {
  device: GroupedMobileDevice;
}

export const DeviceCardMobile: React.FC<DeviceCardMobileProps> = ({ device }) => {
  const { t } = useTranslation();
  const state = device.trackerEntity.state.toLowerCase();
  const isHome = state === 'home' || state === 'casa';

  const battery = device.batteryLevel;
  const BatteryIcon =
    battery === undefined
      ? Battery
      : battery > 70
      ? Battery
      : battery > 25
      ? BatteryMedium
      : BatteryLow;

  const batteryColor =
    battery === undefined
      ? 'text-secondary'
      : battery > 50
      ? 'text-emerald-600 dark:text-emerald-400'
      : battery > 20
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-4 sm:p-5 shadow-lg flex items-center justify-between gap-3 group hover:border-border transition-all duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-3 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20 shadow-sm">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-primary truncate" title={device.name}>
            {device.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isHome
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-accent text-primary/80 dark:text-secondary border border-border/60'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {isHome ? t('homeassistant.at_home') : t('homeassistant.away')}
            </span>
          </div>
        </div>
      </div>

      {/* Indicador de Bateria */}
      {battery !== undefined && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${batteryColor}`}>
            <BatteryIcon className="w-4 h-4" />
            <span className="tabular-nums">{battery}%</span>
          </div>
          <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                battery > 50 ? 'bg-emerald-400' : battery > 20 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, battery))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
