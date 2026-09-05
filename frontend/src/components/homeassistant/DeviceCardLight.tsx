import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, ToggleLeft, ToggleRight, Sliders, Moon, Loader2 } from 'lucide-react';
import type { GroupedLightDevice, HAEntity } from './types';

interface DeviceCardLightProps {
  device: GroupedLightDevice;
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
  onBrightnessChange: (entityId: string, value: number) => void;
  onSelectOption?: (entityId: string, option: string) => void;
}

export const DeviceCardLight: React.FC<DeviceCardLightProps> = ({
  device,
  isPending,
  onToggle,
  onBrightnessChange,
  onSelectOption,
}) => {
  const { t } = useTranslation();
  const light = device.lightEntity;
  const isOn = light.state === 'on';
  const pending = isPending(light.entity_id);

  const supportsBrightness =
    Array.isArray(light.attributes.supported_color_modes) &&
    light.attributes.supported_color_modes.some((m) => m.includes('brightness'));

  const brightnessPct = light.attributes.brightness
    ? Math.round((light.attributes.brightness / 255) * 100)
    : 0;

  const dndOn = device.doNotDisturbEntity?.state === 'on';

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between p-4 sm:p-5 bg-card/60 backdrop-blur-3xl saturate-[190%] shadow-lg relative overflow-hidden group hover:scale-[1.01] ${
        isOn
          ? 'border-amber-500/40 shadow-amber-500/10 ring-1 ring-amber-500/20'
          : 'border-border/70 hover:border-border'
      }`}
    >
      {/* Orb de fundo quando ligada */}
      {isOn && (
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-500/15 blur-2xl pointer-events-none transition-opacity duration-500" />
      )}

      {/* Cabeçalho do dispositivo */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl transition-all duration-300 shadow-sm ${
              isOn
                ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30 shadow-amber-500/20'
                : 'bg-accent/80 text-secondary'
            }`}
          >
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-primary truncate" title={device.name}>
              {device.name}
            </h4>
            <span className="text-[11px] text-secondary font-mono truncate block">
              {light.entity_id}
            </span>
          </div>
        </div>

        {/* Toggle Principal */}
        <button
          onClick={() => onToggle(light)}
          disabled={pending}
          aria-label={`Alternar ${device.name}`}
          className={`p-1.5 rounded-xl transition-all active:scale-95 shrink-0 ${
            isOn
              ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
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

      {/* Controles estendidos */}
      <div className="mt-4 space-y-3 relative z-10 pt-3 border-t border-border/50">
        {/* Slider de Brilho */}
        {supportsBrightness && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-secondary">
              <span className="flex items-center gap-1.5 font-medium">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                {t('homeassistant.brightness')}
              </span>
              <span className="font-semibold text-primary tabular-nums">
                {isOn ? `${brightnessPct}%` : '0%'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="255"
              disabled={!isOn || pending}
              defaultValue={light.attributes.brightness || 255}
              onChange={(e) => onBrightnessChange(light.entity_id, parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-accent rounded-lg disabled:opacity-40"
            />
          </div>
        )}

        {/* Seletor de Cena se houver */}
        {device.sceneEntity && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-secondary text-[11px] font-medium">{t('homeassistant.scene')}:</span>
            {device.sceneEntity.attributes.options && device.sceneEntity.attributes.options.length > 0 ? (
              <select
                value={device.sceneEntity.state}
                disabled={isPending(device.sceneEntity.entity_id)}
                onChange={(e) =>
                  onSelectOption && onSelectOption(device.sceneEntity!.entity_id, e.target.value)
                }
                className="bg-accent/70 text-primary border border-border/70 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 truncate max-w-[140px]"
              >
                {device.sceneEntity.attributes.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-accent text-secondary text-[11px] font-mono">
                {device.sceneEntity.state}
              </span>
            )}
          </div>
        )}

        {/* Cronômetro e Não Perturbe */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {device.timerEntity && (
            <div className="flex items-center gap-1.5 text-[11px] text-secondary">
              <span className="font-medium">{t('homeassistant.timer')}:</span>
              <span className="px-2 py-0.5 rounded bg-accent font-mono text-primary text-[11px]">
                {device.timerEntity.state || '00:00'}
              </span>
            </div>
          )}

          {device.doNotDisturbEntity && (
            <button
              onClick={() => onToggle(device.doNotDisturbEntity!)}
              disabled={isPending(device.doNotDisturbEntity.entity_id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 border ${
                dndOn
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-accent/60 border-border/60 text-secondary hover:text-primary'
              }`}
              title={t('homeassistant.do_not_disturb')}
            >
              <Moon className="w-3 h-3" />
              <span>{t('homeassistant.do_not_disturb')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
