import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  X, Layers, Play, Square, RotateCw, Pause, 
  ExternalLink, ArrowRight, Activity, Cpu, HardDrive, 
  RefreshCw, Box, Radio, Settings2
} from 'lucide-react';
import type { GroupContainerItem, ContainerLike } from '../../utils/containerGroups';
import { formatRAM } from '../../utils/format';
import { resolveWebUrl } from '../../utils/url';
import { getIconForImage } from '../../utils/icons';
import { ContainerIcon } from '../ui/ContainerIcon';

interface AppGroupModalProps {
  group: GroupContainerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onEditLink?: (containerId: string) => void;
  customLinks?: Record<string, string>;
}

export function AppGroupModal({
  group,
  isOpen,
  onClose,
  onRefresh,
  onEditLink,
  customLinks = {},
}: AppGroupModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);

  if (!isOpen || !group) return null;

  const handleContainerAction = async (
    e: React.MouseEvent,
    id: string,
    action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause'
  ) => {
    e.stopPropagation();
    setActionLoading(`${id}:${action}`);
    try {
      await fetch(`/api/docker/containers/${id}/${action}`, { method: 'POST' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(`Failed to ${action} container ${id}`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'start' | 'stop' | 'restart') => {
    setBulkActionLoading(action);
    try {
      const promises = group.containers.map(c => 
        fetch(`/api/docker/containers/${c.id}/${action}`, { method: 'POST' })
      );
      await Promise.allSettled(promises);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(`Failed bulk ${action}`, err);
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleSetPrimary = (e: React.MouseEvent, containerId: string) => {
    e.stopPropagation();
    localStorage.setItem(`orbit_stack_primary_${group.groupKey}`, containerId);
    if (onRefresh) onRefresh();
  };

  const getWebLink = (c: ContainerLike): string => {
    if (customLinks[c.id]) return resolveWebUrl(customLinks[c.id]);
    if (c.ports && c.ports.length > 0) {
      const publicPort = c.ports.find(p => p.public_port)?.public_port || c.ports[0].private_port;
      if (publicPort) {
        return resolveWebUrl(publicPort);
      }
    }
    return '';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0e1422]/95 border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-border/80 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* App Icon */}
            <div className="w-14 h-14 rounded-2xl bg-card p-2 flex items-center justify-center border border-border/80 shadow-md shrink-0 relative group">
              <ContainerIcon
                src={group.iconUrl}
                name={group.name}
                size={40}
                className="w-full h-full"
              />
              <div className="absolute -bottom-1 -right-1 p-1 rounded-md bg-orbit-500 text-white shadow-md">
                <Layers className="w-3 h-3" />
              </div>
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight truncate">
                  {group.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orbit-500/20 text-orbit-300 border border-orbit-500/35 font-mono">
                  {group.totalCount} {group.totalCount === 1 ? 'container' : 'containers'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  group.allRunning 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35' 
                    : group.anyRunning 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35' 
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    group.allRunning ? 'bg-emerald-400 animate-pulse' : group.anyRunning ? 'bg-amber-400' : 'bg-zinc-500'
                  }`} />
                  <span>{group.runningCount}/{group.totalCount} ativos</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 truncate">
                Stack gerenciada com {group.totalCount} serviços interconectados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Bulk Stack Actions */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 shadow-inner backdrop-blur-md">
              <button
                onClick={() => handleBulkAction('start')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-xl text-zinc-300 hover:text-emerald-400 hover:bg-emerald-500/15 transition-all disabled:opacity-50"
                title="Iniciar todos os containers do grupo"
              >
                {bulkActionLoading === 'start' ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleBulkAction('restart')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-xl text-zinc-300 hover:text-cyan-400 hover:bg-cyan-500/15 transition-all disabled:opacity-50"
                title="Reiniciar todos os containers do grupo"
              >
                {bulkActionLoading === 'restart' ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> : <RotateCw className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleBulkAction('stop')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-xl text-zinc-300 hover:text-rose-400 hover:bg-rose-500/15 transition-all disabled:opacity-50"
                title="Parar todos os containers do grupo"
              >
                {bulkActionLoading === 'stop' ? <RefreshCw className="w-4 h-4 animate-spin text-rose-400" /> : <Square className="w-4 h-4" />}
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aggregated Bento Metrics with rich gradients */}
        <div className="grid grid-cols-3 gap-3 p-4 sm:px-6 sm:py-4 bg-white/[0.02] border-b border-white/10">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent border border-purple-500/25 shadow-sm">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-purple-300/80 tracking-wider block">
                CPU Total
              </span>
              <span className="text-sm sm:text-base font-bold text-white font-mono">
                {group.totalCpu.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/25 shadow-sm">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider block">
                RAM Total
              </span>
              <span className="text-sm sm:text-base font-bold text-white font-mono">
                {formatRAM(group.totalMemory)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-orbit-500/15 via-orbit-500/5 to-transparent border border-orbit-500/25 shadow-sm">
            <div className="p-2.5 rounded-xl bg-orbit-500/20 text-orbit-300 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-orbit-300/80 tracking-wider block">
                Serviços
              </span>
              <span className="text-sm sm:text-base font-bold text-white font-mono">
                {group.runningCount} / {group.totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Containers List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-orbit-400" />
              Sub-containers do Grupo ({group.containers.length})
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Clique em um container para ver detalhes completos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {group.containers.map((c) => {
              const isRunning = c.state === 'running';
              const isPaused = c.state === 'paused';
              const webLink = getWebLink(c);
              const isSubActionLoading = (action: string) => actionLoading === `${c.id}:${action}`;

              return (
                <div 
                  key={c.id}
                  onClick={() => {
                    onClose();
                    navigate(`/containers/${c.id}`);
                  }}
                  className="group relative bg-[#131b2e]/70 hover:bg-[#18233c]/95 border border-white/10 hover:border-orbit-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl flex flex-col justify-between gap-3 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Container icon with Docker/Orbit fallback */}
                      <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border/80 shrink-0 shadow-sm group-hover:border-orbit-500/40 transition-colors p-1">
                        <ContainerIcon
                          src={getIconForImage(c.image, c.name)}
                          name={c.name}
                          image={c.image}
                          size={24}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-white truncate group-hover:text-orbit-300 transition-colors" title={c.name}>
                            {c.name}
                          </span>
                          {c.id === group.primaryContainer.id ? (
                            <span className="px-2 py-0.5 rounded-full bg-orbit-500/20 text-orbit-300 border border-orbit-500/40 text-[10px] font-bold shrink-0">
                              {t('containers.primary')}
                            </span>
                          ) : (c.ports && c.ports.length > 0) || customLinks[c.id] ? (
                            <button
                              onClick={(e) => handleSetPrimary(e, c.id)}
                              className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-orbit-500/20 text-zinc-400 hover:text-orbit-300 border border-white/10 text-[10px] transition-colors shrink-0"
                              title={t('containers.set_as_primary')}
                            >
                              {t('containers.set_as_primary')}
                            </button>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono truncate block max-w-[200px]" title={c.image}>
                          {c.image.split(':')[0].split('/').pop()}:{c.image.split(':')[1] || 'latest'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-sans ${
                        isRunning 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35' 
                          : isPaused 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35' 
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                        {c.state}
                      </span>
                    </div>
                  </div>

                  {/* Resource Usage & Controls */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs text-zinc-400 font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-purple-300 font-semibold">
                        {(c.cpu_percent || 0).toFixed(1)}% CPU
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-emerald-300 font-semibold">
                        {formatRAM(c.memory_used || 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {webLink && isRunning && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(webLink, '_blank');
                          }}
                          className="px-2 py-1 rounded-lg text-orbit-300 hover:text-white bg-orbit-500/15 hover:bg-orbit-500/30 border border-orbit-500/30 transition-all flex items-center gap-1 text-[11px] font-sans font-medium"
                          title={`Abrir Web UI (${webLink})`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{t('containers.open_app')}</span>
                        </button>
                      )}

                      {onEditLink && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditLink(c.id);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-orbit-500/20 border border-white/10 transition-colors"
                          title={t('containers.edit_link')}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isRunning ? (
                        <>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'restart')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                            title="Reiniciar container"
                          >
                            {isSubActionLoading('restart') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <RotateCw className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'pause')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-amber-500/15 transition-colors"
                            title="Pausar container"
                          >
                            {isSubActionLoading('pause') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'stop')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors"
                            title="Parar container"
                          >
                            {isSubActionLoading('stop') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => handleContainerAction(e, c.id, 'start')}
                          disabled={Boolean(actionLoading)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                          title="Iniciar container"
                        >
                          {isSubActionLoading('start') ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          navigate(`/containers/${c.id}`);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                        title="Ver detalhes do container"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-orbit-400 animate-pulse" />
            <span>Todos os sub-containers compartilham a rede e o ciclo de vida da stack.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors border border-white/10 active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
