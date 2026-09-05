import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ChevronRight, Layers, RefreshCw, RotateCw, Square, Play, PlayCircle, Pause, 
  Globe, Settings2, DownloadCloud 
} from 'lucide-react';
import { formatRAM, formatBytes } from '../../../utils/format';
import { getIconForImage } from '../../../utils/icons';
import { getContainerWebLink, getContainerDiskUsage, type GroupContainerItem } from '../../../utils/containerGroups';
import { ContainerIcon } from '../../ui/ContainerIcon';
import type { Container } from './types';

export interface ContainerTableViewProps {
  items: (GroupContainerItem | { type: 'single'; id: string; name: string; container: Container; iconUrl: string; webLink?: string; isRunning: boolean })[];
  expandedGroups: Record<string, boolean>;
  actionLoading: string | null;
  updatesMap: Record<string, { has_update: boolean }>;
  customLinks: Record<string, string>;
  onToggleGroupExpanded: (groupKey: string) => void;
  onOpenGroupModal: (group: GroupContainerItem) => void;
  onGroupAction: (e: React.MouseEvent, group: GroupContainerItem, action: 'start' | 'stop' | 'restart') => void;
  onAction: (e: React.MouseEvent, id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => void;
  onUpdateContainer: (e: React.MouseEvent, id: string) => void;
  onSetCustomLink: (e: React.MouseEvent, id: string) => void;
}

export function ContainerTableView({
  items,
  expandedGroups,
  actionLoading,
  updatesMap,
  customLinks,
  onToggleGroupExpanded,
  onOpenGroupModal,
  onGroupAction,
  onAction,
  onUpdateContainer,
  onSetCustomLink,
}: ContainerTableViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-auto border border-border rounded-lg glass-panel">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-secondary uppercase bg-white/5 border-b border-border">
          <tr>
            <th className="px-4 py-4 font-medium">Nome</th>
            <th className="px-4 py-4 font-medium">Estado</th>
            <th className="px-4 py-4 font-medium">CPU</th>
            <th className="px-4 py-4 font-medium">RAM</th>
            <th className="px-4 py-4 font-medium">Disco</th>
            <th className="px-4 py-4 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            if (item.type === 'group') {
              const group = item;
              const isExpanded = Boolean(expandedGroups[group.groupKey]);
              const isGroupActionLoading = (action: string) => actionLoading === `group:${group.groupKey}:${action}`;

              return (
                <Fragment key={group.id}>
                  {/* Master Group Row */}
                  <tr 
                    onClick={() => onToggleGroupExpanded(group.groupKey)} 
                    className="border-b border-border bg-orbit-500/[0.04] hover:bg-orbit-500/[0.08] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 font-medium text-primary flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleGroupExpanded(group.groupKey);
                        }}
                        className="p-1 rounded text-orbit-600 dark:text-orbit-400 hover:text-orbit-800 dark:hover:text-white"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-orbit-500/40 shrink-0 relative">
                        <img 
                          src={group.iconUrl} 
                          alt="" 
                          className="w-5 h-5 object-contain" 
                        />
                        <div className="absolute -bottom-1 -right-1 p-0.5 rounded bg-orbit-500 text-white">
                          <Layers className="w-2 h-2" />
                        </div>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary leading-tight">{group.name}</span>
                          <span className="px-2 py-0.5 rounded bg-orbit-500/20 text-orbit-700 dark:text-orbit-300 text-[10px] font-bold border border-orbit-500/30">
                            Stack ({group.totalCount} containers)
                          </span>
                          {(() => {
                            const groupUpdates = group.containers.filter(c => updatesMap[c.id]?.has_update || updatesMap[c.id?.substring(0, 12)]?.has_update).length;
                            return groupUpdates > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-500/30">
                                Atualização ({groupUpdates})
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <span className="text-[11px] text-secondary font-mono leading-tight">
                          {group.containers.map(c => c.name).join(', ')}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${group.allRunning ? 'bg-emerald-500' : group.anyRunning ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span className="text-secondary font-medium">{group.runningCount}/{group.totalCount} ativos</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-purple-700 dark:text-purple-400 font-mono font-bold">
                      {group.totalCpu.toFixed(1)}%
                    </td>

                    <td className="px-4 py-4 text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                      {formatRAM(group.totalMemory)}
                    </td>

                    <td className="px-4 py-4 text-orbit-700 dark:text-orbit-400 font-mono font-bold">
                      {formatBytes(group.totalDisk)}
                    </td>

                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 items-center">
                        <button
                          onClick={() => onOpenGroupModal(group)}
                          className="p-1.5 rounded glass-button text-orbit-700 dark:text-orbit-300 hover:text-orbit-900 dark:hover:text-white bg-orbit-500/15 border border-orbit-500/40 font-medium transition-colors text-xs flex items-center gap-1"
                          title="Ver sub-containers"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Sub-containers</span>
                        </button>

                        <button
                          onClick={(e) => onGroupAction(e, group, 'restart')}
                          disabled={Boolean(actionLoading)}
                          className="p-1.5 rounded glass-button hover:text-cyan-400 transition-colors"
                          title="Reiniciar Stack"
                        >
                          {isGroupActionLoading('restart') ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                        </button>

                        {group.anyRunning ? (
                          <button
                            onClick={(e) => onGroupAction(e, group, 'stop')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded glass-button hover:text-rose-400 transition-colors"
                            title="Parar Stack"
                          >
                            {isGroupActionLoading('stop') ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => onGroupAction(e, group, 'start')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded glass-button text-emerald-500 hover:text-emerald-400 transition-colors"
                            title="Iniciar Stack"
                          >
                            {isGroupActionLoading('start') ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Sub-container Rows */}
                  {isExpanded && group.containers.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={() => navigate(`/containers/${c.id}`)} 
                      className="border-b border-border/60 bg-accent/20 hover:bg-accent/40 transition-colors cursor-pointer text-xs"
                    >
                      <td className="px-4 py-3 pl-12 font-medium text-primary flex items-center gap-3 border-l-2 border-orbit-500/50">
                        <ContainerIcon
                          src={getIconForImage(c.image, c.name)}
                          name={c.name}
                          image={c.image}
                          size={20}
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{c.name}</span>
                            {(updatesMap[c.id]?.has_update || updatesMap[c.id?.substring(0, 12)]?.has_update) && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-500/30">
                                Atualização
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-secondary font-mono">{c.image}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${c.state === 'running' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="capitalize text-secondary text-xs">{c.state}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-primary">
                        {c.cpu_percent?.toFixed(1) || '0.0'}%
                      </td>

                      <td className="px-4 py-3 font-mono text-primary">
                        {formatRAM(c.memory_used)}
                      </td>

                      <td className="px-4 py-3 font-mono text-primary">
                        {formatBytes(getContainerDiskUsage(c))}
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 items-center">
                          {c.state === 'running' ? (
                            <>
                              <button onClick={(e) => onAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="p-1 rounded glass-button hover:text-rose-400" title="Parar">
                                <Square className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => onAction(e, c.id, 'restart')} disabled={actionLoading === c.id} className="p-1 rounded glass-button hover:text-emerald-600 dark:hover:text-emerald-400" title="Reiniciar">
                                <RotateCw className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button onClick={(e) => onAction(e, c.id, 'start')} disabled={actionLoading === c.id} className="p-1 rounded glass-button text-emerald-700 dark:text-emerald-400 font-semibold" title="Iniciar">
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            }

            const c = item.container;
            return (
              <tr key={c.id} onClick={() => navigate(`/containers/${c.id}`)} className="border-b border-border hover:bg-accent/40 transition-colors cursor-pointer">
                <td className="px-4 py-4 font-medium text-primary flex items-center gap-3">
                  <ContainerIcon
                    src={getIconForImage(c.image, c.name)}
                    name={c.name}
                    image={c.image}
                    size={24}
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary leading-tight">{c.name}</span>
                      {(updatesMap[c.id]?.has_update || updatesMap[c.id?.substring(0, 12)]?.has_update) && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-500/30">
                          Atualização
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-secondary font-mono leading-tight">{c.image}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${c.state?.toLowerCase() === 'running' ? 'bg-emerald-500' : c.state?.toLowerCase() === 'paused' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <span className="capitalize text-secondary">{c.state}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-primary font-mono">
                  {c.cpu_percent?.toFixed(1) || '0.0'}%
                </td>
                <td className="px-4 py-4 text-primary font-mono">
                  {formatRAM(c.memory_used)}
                </td>
                <td className="px-4 py-4 text-primary font-mono">
                  {formatBytes(getContainerDiskUsage(c))}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2 items-center">
                    {/* Tabela: Links Rápidos */}
                    {(() => {
                      const webLink = getContainerWebLink(c, customLinks);
                      if (webLink) {
                        return (
                          <button 
                            onClick={(e) => { e.stopPropagation(); window.open(webLink, '_blank'); }}
                            className="px-2 py-1 rounded glass-button text-orbit-600 dark:text-orbit-400 hover:text-orbit-700 dark:hover:text-orbit-300 border border-orbit-500/30 transition-colors text-xs flex items-center gap-1 font-semibold" 
                            title={`Abrir ${c.name} (${webLink})`}
                          >
                            <Globe className="w-3.5 h-3.5 text-orbit-600 dark:text-orbit-400" />
                            <span className="hidden xl:inline">{t('containers.open_app')}</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetCustomLink(e, c.id);
                      }}
                      className="p-1.5 rounded glass-button hover:text-primary transition-colors text-xs flex items-center gap-1" 
                      title={customLinks[c.id] ? `Custom Link: ${customLinks[c.id]}` : 'Configurar Link'}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px h-4 bg-border mx-1"></div>

                    {updatesMap[c.id]?.has_update && (
                      <button 
                        onClick={(e) => onUpdateContainer(e, c.id)}
                        className="p-1.5 rounded glass-button text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-white bg-violet-500/20 border border-violet-500/30 transition-colors text-xs flex items-center gap-1 font-semibold" 
                        title="Atualizar container"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {c.state?.toLowerCase() === 'running' ? (
                      <>
                        <button onClick={(e) => onAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-rose-400 transition-colors" title="Parar">
                          <Square className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onAction(e, c.id, 'pause')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-amber-400 transition-colors" title="Pausar">
                          <Pause className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onAction(e, c.id, 'restart')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Reiniciar">
                          <RotateCw className={`w-4 h-4 ${actionLoading === c.id ? 'animate-spin' : ''}`} />
                        </button>
                      </>
                    ) : c.state?.toLowerCase() === 'paused' ? (
                      <>
                        <button onClick={(e) => onAction(e, c.id, 'unpause')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Retomar">
                          <PlayCircle className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-rose-400 transition-colors" title="Parar">
                          <Square className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button onClick={(e) => onAction(e, c.id, 'start')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold transition-colors" title="Iniciar">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
