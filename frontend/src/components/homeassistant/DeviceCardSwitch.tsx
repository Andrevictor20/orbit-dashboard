import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, ToggleLeft, ToggleRight, Loader2, Gauge } from 'lucide-react';
import type { GroupedSwitchDevice, HAEntity } from './types';

interface DeviceCardSwitchProps {
  device: GroupedSwitchDevice;
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
}

export const DeviceCardSwitch: React.FC<DeviceCardSwitchProps> = ({
  device,
  isPending,
  onToggle,
}) => {
  const { t } = useTranslation();
  const sw = device.switchEntity;
  const isOn = sw.state === 'on';
  const pending = isPending(sw.entity_id);

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between p-4 sm:p-5 bg-card/60 backdrop-blur-3xl saturate-[190%] shadow-lg relative overflow-hidden group hover:scale-[1.01] ${
        isOn
          ? 'border-indigo-500/40 shadow-indigo-500/10 ring-1 ring-indigo-500/20'
          : 'border-border/70 hover:border-border'
      }`}
    >
      {/* Glow de fundo */}
      {isOn && (
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none transition-opacity duration-500" />
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl transition-all duration-300 shadow-sm ${
              isOn
                ? 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/30 shadow-indigo-500/20'
                : 'bg-accent/80 text-secondary'
            }`}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-primary truncate" title={device.name}>
              {device.name}
            </h4>
            <span className="text-[11px] text-secondary font-mono truncate block">
              {sw.entity_id}
            </span>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(sw)}
          disabled={pending}
          aria-label={`Alternar ${device.name}`}
          className={`p-1.5 rounded-xl transition-all active:scale-95 shrink-0 ${
            isOn
              ? 'text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25'
              : 'text-secondary hover:text-primary bg-accent/60'
          }`}
          title={isOn ? t('homeassistant.state_on') : t('homeassistant.state_off')}
        >
          {pending ? (
            <Loader2 className="w-6 h-6 animate-spin text-orbit-400" />
          ) : isOn ? (
            <ToggleRight className="w-6 h-6" />
          ) : (
            <ToggleLeft className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Se houver telemetria de energia/potência associada */}
      {(device.energyEntity || device.powerEntity) && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2 text-xs relative z-10">
          {device.energyEntity && (
            <div className="flex items-center gap-1.5 text-secondary">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">{t('homeassistant.energy_consumed')}:</span>
              <span className="font-bold text-primary tabular-nums">
                {device.energyEntity.state}{' '}
                <span className="text-[10px] font-normal text-secondary">
                  {device.energyEntity.attributes.unit_of_measurement || 'kWh'}
                </span>
              </span>
            </div>
          )}

          {device.powerEntity && (
            <div className="flex items-center gap-1.5 text-secondary">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-primary tabular-nums">
                {device.powerEntity.state}{' '}
                <span className="text-[10px] font-normal text-secondary">
                  {device.powerEntity.attributes.unit_of_measurement || 'W'}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
