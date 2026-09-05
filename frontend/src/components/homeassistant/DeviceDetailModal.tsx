import React, { useState } from 'react';
import {
  X,
  Sliders,
  Power,
  Copy,
  Check,
  Zap,
  Activity,
  Lightbulb,
  Tv,
  Camera,
  Smartphone,
  Thermometer,
  Sun,
  ArrowUpCircle
} from 'lucide-react';
import type { HADeviceGroup } from './types';

interface DeviceDetailModalProps {
  device: HADeviceGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (entityId: string, currentState: string) => Promise<void>;
  onServiceCall?: (domain: string, service: string, serviceData: Record<string, any>) => Promise<void>;
  isPendingAction?: Record<string, boolean>;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  isOpen,
  onClose,
  onToggle,
  onServiceCall: _onServiceCall,
  isPendingAction = {},
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isActionable = (entityId: string) => {
    const domain = entityId.split('.')[0];
    return ['light', 'switch', 'input_boolean', 'script', 'button'].includes(domain);
  };

  const getEntityIcon = (entityId: string) => {
    const domain = entityId.split('.')[0];
    switch (domain) {
      case 'light':
        return Lightbulb;
      case 'switch':
        return Zap;
      case 'media_player':
        return Tv;
      case 'camera':
        return Camera;
      case 'device_tracker':
      case 'person':
        return Smartphone;
      case 'climate':
        return Thermometer;
      case 'sun':
        return Sun;
      case 'update':
        return ArrowUpCircle;
      default:
        return Activity;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[88vh] rounded-3xl bg-card/90 backdrop-blur-3xl saturate-[190%] border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular light highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 border-b border-border/60 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-orbit-500/15 border border-orbit-500/30 text-orbit-400 shadow-inner">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-primary">{device.name}</h2>
                {device.stateBadge && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      device.stateBadge.variant === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : device.stateBadge.variant === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : device.stateBadge.variant === 'info'
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                        : 'bg-accent text-secondary border-border/60'
                    }`}
                  >
                    {device.stateBadge.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {device.entities.length} {device.entities.length === 1 ? 'entidade associada' : 'entidades associadas a este dispositivo'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-accent/60 hover:bg-accent text-secondary hover:text-primary transition-all border border-border/60"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable Entity Inspector */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-border">
          {device.summary && (
            <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/60 text-xs font-mono text-secondary flex items-center justify-between">
              <span>Status Consolidado:</span>
              <span className="font-semibold text-primary">{device.summary}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Entidades & Controles deste Dispositivo
            </h3>

            <div className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-background/50 overflow-hidden">
              {device.entities.map((ent) => {
                const Icon = getEntityIcon(ent.entity_id);
                const actionable = isActionable(ent.entity_id);
                const isPending = Boolean(isPendingAction[ent.entity_id]);
                const isOn = ent.state === 'on';

                return (
                  <div
                    key={ent.entity_id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-card border border-border/60 text-secondary shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary truncate">
                            {ent.attributes.friendly_name || ent.entity_id.split('.')[1].replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-secondary truncate">
                            {ent.entity_id}
                          </span>
                          <button
                            onClick={() => handleCopy(ent.entity_id)}
                            className="text-secondary hover:text-primary transition-colors p-0.5"
                            title="Copiar ID da entidade"
                          >
                            {copiedId === ent.entity_id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* State Badge / Reading */}
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-accent border border-border/60 text-primary">
                        {ent.state} {ent.attributes.unit_of_measurement || ''}
                      </span>

                      {/* Interactive toggle for actionable entities */}
                      {actionable && (
                        <button
                          disabled={isPending}
                          onClick={() => onToggle(ent.entity_id, ent.state)}
                          className={`p-2 rounded-xl border transition-all active:scale-95 ${
                            isOn
                              ? 'bg-orbit-500 text-white border-orbit-400 shadow-md shadow-orbit-500/25'
                              : 'bg-card text-secondary hover:text-primary border-border/80'
                          }`}
                          title={isOn ? 'Desligar' : 'Ligar'}
                        >
                          <Power className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/60 bg-card/40 flex items-center justify-between">
          <span className="text-xs text-secondary font-mono">
            {device.category.toUpperCase()} · ID: {device.id}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 text-white font-medium text-xs shadow-md shadow-orbit-500/20 transition-all active:scale-95"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
