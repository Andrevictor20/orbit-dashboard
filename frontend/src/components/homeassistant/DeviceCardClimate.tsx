import React from 'react';
import { useTranslation } from 'react-i18next';
import { Thermometer, Droplets, Plus, Minus, Loader2 } from 'lucide-react';
import type { HAEntity } from './types';

interface DeviceCardClimateProps {
  entity: HAEntity;
  isPending: (entityId: string) => boolean;
  onSetTemperature?: (entityId: string, temp: number) => void;
}

export const DeviceCardClimate: React.FC<DeviceCardClimateProps> = ({
  entity,
  isPending,
  onSetTemperature,
}) => {
  const { t } = useTranslation();
  const pending = isPending(entity.entity_id);
  const friendlyName = entity.attributes.friendly_name || entity.entity_id;

  const currentTemp =
    entity.attributes.current_temperature !== undefined
      ? entity.attributes.current_temperature
      : !isNaN(Number(entity.state))
      ? Number(entity.state)
      : null;

  const targetTemp = entity.attributes.temperature;
  const humidity = entity.attributes.current_humidity || entity.attributes.humidity;

  const handleAdjustTarget = (delta: number) => {
    if (!onSetTemperature || targetTemp === undefined) return;
    onSetTemperature(entity.entity_id, targetTemp + delta);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-5 shadow-lg flex flex-col justify-between group hover:border-border transition-all duration-300 relative overflow-hidden">
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-sm">
            <Thermometer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
              {friendlyName}
            </h4>
            <span className="text-[11px] text-secondary capitalize block">
              {entity.state === 'unavailable'
                ? t('common.unavailable', 'Indisponível')
                : currentTemp !== null && !entity.attributes.hvac_modes
                ? t('homeassistant.temperature', 'Temperatura')
                : entity.state}
            </span>
          </div>
        </div>

        {/* Badge de Umidade se disponível */}
        {humidity !== undefined && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-semibold">
            <Droplets className="w-3.5 h-3.5" />
            <span>{humidity}%</span>
          </div>
        )}
      </div>

      {/* Leitura Grande da Temperatura */}
      <div className="my-5 relative z-10">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight text-primary tabular-nums">
            {currentTemp !== null ? currentTemp : '—'}
          </span>
          <span className="text-xl font-medium text-secondary">°C</span>
        </div>
        <p className="text-xs text-secondary mt-1">
          {entity.attributes.device_class === 'temperature'
            ? t('homeassistant.temperature')
            : t('homeassistant.tab_climate')}
        </p>
      </div>

      {/* Controles de Alvo se for entidade climate com targetTemp */}
      {targetTemp !== undefined && onSetTemperature && (
        <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs relative z-10">
          <span className="text-secondary">
            {t('homeassistant.target')}: <strong className="text-primary">{targetTemp}°C</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAdjustTarget(-0.5)}
              disabled={pending}
              className="p-1.5 rounded-lg bg-accent/70 hover:bg-accent text-secondary hover:text-primary active:scale-95 transition-all"
              title="Diminuir 0.5°C"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleAdjustTarget(0.5)}
              disabled={pending}
              className="p-1.5 rounded-lg bg-accent/70 hover:bg-accent text-secondary hover:text-primary active:scale-95 transition-all"
              title="Aumentar 0.5°C"
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orbit-400" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
