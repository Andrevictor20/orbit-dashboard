import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ToggleLeft, ToggleRight, Loader2, RefreshCw, Eye, Sparkles, Wind } from 'lucide-react';
import type { GroupedCameraDevice, HAEntity } from './types';

interface DeviceCardCameraProps {
  device: GroupedCameraDevice;
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
}

export const DeviceCardCamera: React.FC<DeviceCardCameraProps> = ({
  device,
  isPending,
  onToggle,
}) => {
  const { t } = useTranslation();
  const [imageKey, setImageKey] = useState(Date.now());
  const [hasImageError, setHasImageError] = useState(false);

  const cam = device.cameraEntity;
  const isAvailable = cam && cam.state !== 'unavailable';

  const proxyUrl = cam
    ? `/api/homeassistant/camera_proxy/${encodeURIComponent(cam.entity_id)}?t=${imageKey}`
    : null;

  const refreshSnapshot = () => {
    setImageKey(Date.now());
    setHasImageError(false);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] shadow-lg overflow-hidden flex flex-col justify-between group hover:border-border transition-all duration-300">
      {/* Visualização de Vídeo / Snapshot */}
      <div className="relative w-full aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
        {proxyUrl && !hasImageError ? (
          <img
            src={proxyUrl}
            alt={device.name}
            onError={() => setHasImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-secondary">
            <Camera className="w-10 h-10 opacity-40" />
            <span className="text-xs font-medium">
              {device.name} {isAvailable ? '' : `(${t('common.unavailable', 'Indisponível')})`}
            </span>
          </div>
        )}

        {/* Overlay com nome e botão de atualizar snapshot */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white truncate drop-shadow-sm">
            {device.name}
          </span>
          {cam && (
            <button
              onClick={refreshSnapshot}
              className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/90 hover:text-white transition-all backdrop-blur-md active:scale-95"
              title={t('homeassistant.sync')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controles C200 (Autofocus, IR Lamp, Wiper) */}
      <div className="p-4 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-secondary flex items-center justify-between">
          <span>{t('homeassistant.cameras')}</span>
          <span className="font-mono text-[10px] text-secondary/70 truncate max-w-[140px]">
            {cam ? cam.entity_id : device.id}
          </span>
        </div>

        <div className="space-y-2 pt-1 border-t border-border/50">
          {/* Autofocus */}
          {device.autofocusEntity && (
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-2 text-primary font-medium">
                <Sparkles className="w-3.5 h-3.5 text-orbit-400" />
                {t('homeassistant.autofocus')}
              </span>
              <button
                onClick={() => onToggle(device.autofocusEntity!)}
                disabled={isPending(device.autofocusEntity.entity_id)}
                className="text-secondary hover:text-primary transition-all active:scale-95"
              >
                {isPending(device.autofocusEntity.entity_id) ? (
                  <Loader2 className="w-5 h-5 animate-spin text-orbit-400" />
                ) : device.autofocusEntity.state === 'on' ? (
                  <ToggleRight className="w-6 h-6 text-orbit-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
            </div>
          )}

          {/* IR Lamp */}
          {device.irLampEntity && (
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-2 text-primary font-medium">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                {t('homeassistant.ir_lamp')}
              </span>
              <button
                onClick={() => onToggle(device.irLampEntity!)}
                disabled={isPending(device.irLampEntity.entity_id)}
                className="text-secondary hover:text-primary transition-all active:scale-95"
              >
                {isPending(device.irLampEntity.entity_id) ? (
                  <Loader2 className="w-5 h-5 animate-spin text-orbit-400" />
                ) : device.irLampEntity.state === 'on' ? (
                  <ToggleRight className="w-6 h-6 text-amber-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
            </div>
          )}

          {/* Wiper */}
          {device.wiperEntity && (
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-2 text-primary font-medium">
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                {t('homeassistant.wiper')}
              </span>
              <button
                onClick={() => onToggle(device.wiperEntity!)}
                disabled={isPending(device.wiperEntity.entity_id)}
                className="text-secondary hover:text-primary transition-all active:scale-95"
              >
                {isPending(device.wiperEntity.entity_id) ? (
                  <Loader2 className="w-5 h-5 animate-spin text-orbit-400" />
                ) : device.wiperEntity.state === 'on' ? (
                  <ToggleRight className="w-6 h-6 text-cyan-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
