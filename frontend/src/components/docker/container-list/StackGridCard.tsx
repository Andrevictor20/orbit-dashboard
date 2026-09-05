import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Globe, Settings2, ExternalLink, RefreshCw, RotateCw, Square, Play } from 'lucide-react';
import { formatRAM, formatBytes } from '../../../utils/format';
import { resolveWebUrl } from '../../../utils/url';
import { getSortedDeduplicatedPorts, type GroupContainerItem } from '../../../utils/containerGroups';
import { ContainerIcon } from '../../ui/ContainerIcon';

export interface StackGridCardProps {
  group: GroupContainerItem;
  actionLoading: string | null;
  onOpenGroupModal: (group: GroupContainerItem) => void;
  onOpenPrimarySelector: (group: GroupContainerItem) => void;
  onGroupAction: (e: React.MouseEvent, group: GroupContainerItem, action: 'start' | 'stop' | 'restart') => void;
}

export function StackGridCard({
  group,
  actionLoading,
  onOpenGroupModal,
  onOpenPrimarySelector,
  onGroupAction,
}: StackGridCardProps) {
  const { t } = useTranslation();

  const isGroupActionLoading = (action: string) => 
    actionLoading === `group:${group.groupKey}:${action}` ||
    group.containers.some(c => actionLoading === `${c.id}-${action}`);

  return (
    <div
      onClick={() => onOpenGroupModal(group)}
      className="bg-card border-2 border-orbit-500/30 hover:border-orbit-500 rounded-2xl p-5 flex flex-col justify-between gap-4 relative group transition-all cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Top Layer indicator background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orbit-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 bg-card rounded-xl flex items-center justify-center border border-orbit-500/40 shadow-sm shrink-0 relative group-hover:scale-105 transition-transform p-1.5">
            <ContainerIcon
              src={group.iconUrl}
              name={group.name}
              size={32}
              className="w-full h-full"
            />
            <div className="absolute -bottom-1 -right-1 p-0.5 rounded bg-orbit-500 text-white shadow-sm">
              <Layers className="w-2.5 h-2.5" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-primary text-base truncate group-hover:text-orbit-400 transition-colors" title={group.name}>
              {group.name}
            </span>
            <span className="text-[11px] text-orbit-600 dark:text-orbit-400 font-mono flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3" />
              <span>Stack ({group.totalCount} containers)</span>
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${group.allRunning ? 'bg-emerald-500 animate-pulse' : group.anyRunning ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-xs text-secondary font-medium">{group.runningCount}/{group.totalCount} ativos</span>
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-orbit-500/20 text-orbit-700 dark:text-orbit-300 border border-orbit-500/40 text-[11px] font-bold font-mono shrink-0">
          Stack
        </span>
      </div>

      {/* Resource Metrics */}
      <div className="grid grid-cols-3 gap-2 bg-background/80 p-2.5 rounded-xl border border-border/60">
        <div className="flex flex-col">
          <span className="text-[10px] text-purple-700 dark:text-purple-400 uppercase font-semibold tracking-wider">CPU</span>
          <span className="text-xs text-primary font-mono font-bold">{group.totalCpu.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold tracking-wider">RAM</span>
          <span className="text-xs text-primary font-mono font-bold">{formatRAM(group.totalMemory)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-orbit-700 dark:text-orbit-400 uppercase font-semibold tracking-wider">Disco</span>
          <span className="text-xs text-primary font-mono font-bold">{formatBytes(group.totalDisk)}</span>
        </div>
      </div>

      {/* Sub-containers mini preview pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {group.containers.slice(0, 3).map(sub => (
          <span key={sub.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent text-primary/90 dark:text-zinc-300 border border-border truncate max-w-[110px] font-medium" title={sub.name}>
            {sub.name.replace(`${group.groupKey}-`, '')}
          </span>
        ))}
        {group.containers.length > 3 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orbit-500/15 text-orbit-700 dark:text-orbit-300 font-bold border border-orbit-500/30">
            +{group.containers.length - 3}
          </span>
        )}
      </div>

      {/* Stack Network / Ports / Web Link row */}
      <div className="flex items-center justify-between text-xs text-secondary gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          {(() => {
            const sortedPorts = getSortedDeduplicatedPorts(
              group.primaryContainer.ports,
              group.primaryContainer.image,
              group.primaryContainer.name,
              group.primaryContainer.labels
            );
            if (sortedPorts.length > 0) {
              return (
                <div className="flex items-center gap-1 overflow-hidden">
                  {sortedPorts.slice(0, 2).map((p, idx) => {
                    const targetUrl = resolveWebUrl(p.public_port || p.private_port);
                    const isPrimary = idx === 0 && Boolean(p.public_port || p.private_port);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
                          isPrimary
                            ? 'bg-orbit-500/15 border-orbit-500/40 text-orbit-500 font-semibold shadow-xs'
                            : 'bg-background border-border/50 text-secondary'
                        }`}
                      >
                        {p.public_port ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(targetUrl, '_blank');
                            }}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                            title={`Abrir porta principal: ${targetUrl}`}
                          >
                            <span>{p.public_port}:{p.private_port}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(targetUrl, '_blank');
                            }}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                            title={`Abrir porta: ${targetUrl}`}
                          >
                            <span>{p.private_port}/{p.typ || 'tcp'}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {sortedPorts.length > 2 && (
                    <span className="text-[10px] text-secondary font-mono">+{sortedPorts.length - 2}</span>
                  )}
                </div>
              );
            }
            return <span className="text-xs text-secondary font-mono">{t('containers.no_public_ports')}</span>;
          })()}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {group.webLink && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(resolveWebUrl(group.webLink), '_blank');
              }}
              className="glass-button px-2.5 py-1 text-xs rounded-lg text-orbit-600 dark:text-orbit-400 hover:text-orbit-700 dark:hover:text-orbit-300 flex items-center gap-1 transition-colors border border-orbit-500/30 font-medium"
              title={`Abrir ${group.primaryContainer.name} (${group.webLink})`}
            >
              <Globe className="w-3 h-3 text-orbit-600 dark:text-orbit-400" />
              <span className="truncate max-w-[70px]">{t('containers.open_app')}</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPrimarySelector(group);
            }}
            className="glass-button p-1 text-xs rounded-lg text-secondary hover:text-orbit-600 dark:hover:text-orbit-300 transition-colors border border-border/50"
            title={`${t('containers.select_primary')} (${group.primaryContainer.name})`}
          >
            <Settings2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Group Action Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onOpenGroupModal(group)}
          className="glass-button px-3 py-1.5 text-xs rounded-lg text-orbit-700 dark:text-orbit-300 hover:text-orbit-900 dark:hover:text-white bg-orbit-500/15 hover:bg-orbit-500/30 border border-orbit-500/40 flex-1 flex items-center justify-center gap-1.5 font-semibold transition-colors"
          title="Ver e gerenciar todos os sub-containers"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ver Sub-containers</span>
        </button>

        <button
          onClick={(e) => onGroupAction(e, group, 'restart')}
          disabled={Boolean(actionLoading)}
          className="glass-button p-2 text-xs rounded-lg text-secondary hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          title="Reiniciar todos os containers da stack"
        >
          {isGroupActionLoading('restart') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <RotateCw className="w-3.5 h-3.5" />}
        </button>

        {group.anyRunning ? (
          <button
            onClick={(e) => onGroupAction(e, group, 'stop')}
            disabled={Boolean(actionLoading)}
            className="glass-button p-2 text-xs rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Parar todos os containers da stack"
          >
            {isGroupActionLoading('stop') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Square className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <button
            onClick={(e) => onGroupAction(e, group, 'start')}
            disabled={Boolean(actionLoading)}
            className="glass-button p-2 text-xs rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold transition-colors"
            title="Iniciar todos os containers da stack"
          >
            {isGroupActionLoading('start') ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
