import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tv, Power, Loader2, Play, Volume2 } from 'lucide-react';
import type { GroupedMediaDevice, HAEntity } from './types';

interface DeviceCardMediaProps {
  device: GroupedMediaDevice;
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
  onCallService: (domain: string, service: string, payload: Record<string, any>) => void;
}

export const DeviceCardMedia: React.FC<DeviceCardMediaProps> = ({
  device,
  isPending,
  onToggle,
  onCallService,
}) => {
  const { t } = useTranslation();
  const media = device.mediaEntity;
  const script = device.scriptEntity;

  const isOn = media ? media.state !== 'off' && media.state !== 'standby' && media.state !== 'unavailable' : false;
  const pending = media ? isPending(media.entity_id) : script ? isPending(script.entity_id) : false;

  const handlePowerClick = () => {
    if (media) {
      onToggle(media);
    } else if (script) {
      onCallService('script', 'turn_on', { entity_id: script.entity_id });
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between p-4 sm:p-5 bg-card/60 backdrop-blur-3xl saturate-[190%] shadow-lg relative overflow-hidden group hover:scale-[1.01] ${
        isOn
          ? 'border-sky-500/40 shadow-sky-500/10 ring-1 ring-sky-500/20'
          : 'border-border/70 hover:border-border'
      }`}
    >
      {/* Fundo sutil */}
      {isOn && (
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-sky-500/15 blur-2xl pointer-events-none" />
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl transition-all duration-300 shadow-sm ${
              isOn
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/30 shadow-sky-500/20'
                : 'bg-accent/80 text-secondary'
            }`}
          >
            <Tv className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-primary truncate" title={device.name}>
              {device.name}
            </h4>
            <span className="text-[11px] text-secondary font-mono truncate block">
              {media ? media.entity_id : script?.entity_id}
            </span>
          </div>
        </div>

        {/* Botão Power */}
        <button
          onClick={handlePowerClick}
          disabled={pending}
          aria-label={`${t('homeassistant.quick_controls')}: ${device.name}`}
          className={`p-2.5 rounded-xl transition-all active:scale-95 shrink-0 ${
            isOn
              ? 'text-sky-600 dark:text-sky-400 bg-sky-500/20 hover:bg-sky-500/30 shadow-sm'
              : 'text-secondary hover:text-primary bg-accent/70 hover:bg-accent'
          }`}
          title={isOn ? t('homeassistant.state_on') : t('homeassistant.state_off')}
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin text-orbit-600 dark:text-orbit-400" />
          ) : (
            <Power className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Detalhes de reprodução e estado */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs relative z-10">
        <div className="flex items-center gap-2 text-secondary truncate">
          {isOn ? (
            <>
              <Play className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="font-medium text-primary truncate">
                {media?.attributes.media_title || t('homeassistant.state_on')}
              </span>
            </>
          ) : (
            <span className="text-secondary text-[11px]">
              {media?.state === 'unavailable' ? 'Indisponível' : t('homeassistant.state_off')}
            </span>
          )}
        </div>

        {media?.attributes.volume_level !== undefined && isOn && (
          <div className="flex items-center gap-1.5 text-[11px] text-secondary shrink-0">
            <Volume2 className="w-3.5 h-3.5" />
            <span className="font-bold text-primary">
              {Math.round(media.attributes.volume_level * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
