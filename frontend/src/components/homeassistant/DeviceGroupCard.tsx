import React from 'react';
import {
  Lightbulb,
  Zap,
  Tv,
  Camera,
  Smartphone,
  Thermometer,
  Globe,
  Database,
  Sun,
  Cloud,
  ArrowUpCircle,
  Sliders,
  ChevronRight,
  Activity
} from 'lucide-react';
import type { HADeviceGroup, DeviceCategory } from './types';

interface DeviceGroupCardProps {
  device: HADeviceGroup;
  onClick: () => void;
  onQuickToggle?: (entityId: string, currentState: string) => void;
  isPending?: boolean;
}

export const DeviceGroupCard: React.FC<DeviceGroupCardProps> = ({
  device,
  onClick,
  onQuickToggle,
  isPending = false,
}) => {
  const getCategoryTheme = (category: DeviceCategory) => {
    switch (category) {
      case 'light':
        return {
          icon: Lightbulb,
          color: 'text-amber-400',
          bg: 'bg-amber-500/15 border-amber-500/30 shadow-amber-500/10',
          glow: 'group-hover:border-amber-500/50',
          label: 'Iluminação',
        };
      case 'switch':
        return {
          icon: Zap,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/15 border-indigo-500/30 shadow-indigo-500/10',
          glow: 'group-hover:border-indigo-500/50',
          label: 'Tomada / Interruptor',
        };
      case 'media':
        return {
          icon: Tv,
          color: 'text-purple-400',
          bg: 'bg-purple-500/15 border-purple-500/30 shadow-purple-500/10',
          glow: 'group-hover:border-purple-500/50',
          label: 'Mídia & TV',
        };
      case 'camera':
        return {
          icon: Camera,
          color: 'text-rose-400',
          bg: 'bg-rose-500/15 border-rose-500/30 shadow-rose-500/10',
          glow: 'group-hover:border-rose-500/50',
          label: 'Câmera',
        };
      case 'mobile':
        return {
          icon: Smartphone,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15 border-emerald-500/30 shadow-emerald-500/10',
          glow: 'group-hover:border-emerald-500/50',
          label: 'Dispositivo Móvel',
        };
      case 'climate':
        return {
          icon: Thermometer,
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/15 border-cyan-500/30 shadow-cyan-500/10',
          glow: 'group-hover:border-cyan-500/50',
          label: 'Climatização',
        };
      case 'network':
        return {
          icon: Globe,
          color: 'text-sky-400',
          bg: 'bg-sky-500/15 border-sky-500/30 shadow-sky-500/10',
          glow: 'group-hover:border-sky-500/50',
          label: 'Rede & Internet',
        };
      case 'system':
        if (device.id.includes('sun')) {
          return {
            icon: Sun,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/15 border-yellow-500/30 shadow-yellow-500/10',
            glow: 'group-hover:border-yellow-500/50',
            label: 'Ciclo Solar',
          };
        }
        if (device.id.includes('backup')) {
          return {
            icon: Database,
            color: 'text-blue-400',
            bg: 'bg-blue-500/15 border-blue-500/30 shadow-blue-500/10',
            glow: 'group-hover:border-blue-500/50',
            label: 'Backups',
          };
        }
        if (device.id.includes('cloud')) {
          return {
            icon: Cloud,
            color: 'text-teal-400',
            bg: 'bg-teal-500/15 border-teal-500/30 shadow-teal-500/10',
            glow: 'group-hover:border-teal-500/50',
            label: 'Nuvem & Voz',
          };
        }
        return {
          icon: ArrowUpCircle,
          color: 'text-violet-400',
          bg: 'bg-violet-500/15 border-violet-500/30 shadow-violet-500/10',
          glow: 'group-hover:border-violet-500/50',
          label: 'Sistema',
        };
      case 'automation':
        return {
          icon: Sliders,
          color: 'text-amber-300',
          bg: 'bg-amber-500/15 border-amber-500/30 shadow-amber-500/10',
          glow: 'group-hover:border-amber-500/50',
          label: 'Automação / Modo',
        };
      default:
        return {
          icon: Activity,
          color: 'text-orbit-400',
          bg: 'bg-orbit-500/15 border-orbit-500/30 shadow-orbit-500/10',
          glow: 'group-hover:border-orbit-500/50',
          label: 'Dispositivo',
        };
    }
  };

  const theme = getCategoryTheme(device.category);
  const Icon = theme.icon;

  const canQuickToggle =
    (device.category === 'light' || device.category === 'switch' || device.category === 'automation') &&
    onQuickToggle;
  const isPrimaryOn =
    device.primaryEntity.state === 'on' ||
    device.primaryEntity.state === 'playing' ||
    device.primaryEntity.state === 'above_horizon';

  return (
    <div
      onClick={onClick}
      className={`group relative p-5 rounded-2xl bg-card/60 backdrop-blur-3xl saturate-[190%] border border-border/80 ${theme.glow} transition-all duration-300 shadow-lg hover:shadow-2xl cursor-pointer flex flex-col justify-between overflow-hidden hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl border ${theme.bg} ${theme.color} shadow-inner transition-transform group-hover:scale-105`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                {theme.label}
              </span>
              {device.stateBadge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
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
            <h3 className="text-sm font-bold text-primary truncate mt-0.5 group-hover:text-orbit-400 transition-colors">
              {device.name}
            </h3>
          </div>
        </div>

        {canQuickToggle && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onQuickToggle(device.primaryEntity.entity_id, device.primaryEntity.state);
            }}
            className="shrink-0"
          >
            <button
              disabled={isPending}
              aria-label={`Alternar ${device.name}`}
              title={`Alternar ${device.name}`}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 border ${
                isPrimaryOn
                  ? 'bg-orbit-500 border-orbit-400 shadow-md shadow-orbit-500/30'
                  : 'bg-accent border-border/80'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isPrimaryOn ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {device.summary && (
        <div className="mt-3.5 text-xs text-secondary/90 truncate font-mono bg-accent/40 px-3 py-1.5 rounded-xl border border-border/40">
          {device.summary}
        </div>
      )}

      <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-secondary font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-orbit-400" />
          {device.entities.length} {device.entities.length === 1 ? 'entidade' : 'entidades agrupadas'}
        </span>

        <span className="inline-flex items-center gap-1 text-orbit-400 font-semibold group-hover:translate-x-0.5 transition-transform">
          <span>Ver controles</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
