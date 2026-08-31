import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Layers, Play, Square, RotateCw, Pause, 
  ExternalLink, ArrowRight, Activity, Cpu, HardDrive, 
  CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import type { GroupContainerItem, ContainerLike } from '../../utils/containerGroups';
import { formatRAM } from '../../utils/format';

interface AppGroupModalProps {
  group: GroupContainerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  customLinks?: Record<string, string>;
}

export function AppGroupModal({
  group,
  isOpen,
  onClose,
  onRefresh,
  customLinks = {},
}: AppGroupModalProps) {
  const navigate = useNavigate();
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

  const getWebLink = (c: ContainerLike): string => {
    if (customLinks[c.id]) return customLinks[c.id];
    if (c.ports && c.ports.length > 0) {
      const publicPort = c.ports.find(p => p.public_port)?.public_port || c.ports[0].private_port;
      if (publicPort) {
        const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost';
        return `http://${hostname}:${publicPort}`;
      }
    }
    return '';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-border/80 bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900/80 p-2.5 flex items-center justify-center border border-border/80 shadow-inner shrink-0 relative group">
              <img 
                src={group.iconUrl} 
                alt={group.name} 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orbit-500/15 text-orbit-300 border border-orbit-500/30 font-mono">
                  {group.totalCount} {group.totalCount === 1 ? 'container' : 'containers'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  group.allRunning 
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                    : group.anyRunning 
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  {group.allRunning ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                  )}
                  <span>{group.runningCount}/{group.totalCount} ativos</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-secondary mt-1 truncate">
                Stack gerenciada com {group.totalCount} serviços interconectados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Bulk Stack Actions */}
            <div className="flex items-center bg-background/80 border border-border/80 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => handleBulkAction('start')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-lg text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                title="Iniciar todos os containers do grupo"
              >
                {bulkActionLoading === 'start' ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleBulkAction('restart')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-lg text-secondary hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
                title="Reiniciar todos os containers do grupo"
              >
                {bulkActionLoading === 'restart' ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> : <RotateCw className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleBulkAction('stop')}
                disabled={Boolean(bulkActionLoading)}
                className="p-2 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                title="Parar todos os containers do grupo"
              >
                {bulkActionLoading === 'stop' ? <RefreshCw className="w-4 h-4 animate-spin text-rose-400" /> : <Square className="w-4 h-4" />}
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-accent transition-colors ml-1"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aggregated Bento Metrics */}
        <div className="grid grid-cols-3 gap-3 p-5 sm:px-6 sm:py-4 bg-accent/20 border-b border-border/60">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/70 border border-border/60 shadow-sm">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-secondary tracking-wider block">
                CPU Total
              </span>
              <span className="text-sm sm:text-base font-bold text-primary font-mono">
                {group.totalCpu.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/70 border border-border/60 shadow-sm">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-secondary tracking-wider block">
                RAM Total
              </span>
              <span className="text-sm sm:text-base font-bold text-primary font-mono">
                {formatRAM(group.totalMemory)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/70 border border-border/60 shadow-sm">
            <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-secondary tracking-wider block">
                Serviços
              </span>
              <span className="text-sm sm:text-base font-bold text-primary font-mono">
                {group.runningCount} / {group.totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Containers List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
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
                  className="group relative bg-card hover:bg-accent/40 border border-border hover:border-orbit-500/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border shrink-0 shadow-inner group-hover:border-orbit-500/30 transition-colors">
                        <img 
                          src={`/api/docker/icons/${encodeURIComponent(c.image || c.name)}`}
                          alt={c.name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-primary truncate group-hover:text-orbit-400 transition-colors" title={c.name}>
                            {c.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono truncate block max-w-[200px]" title={c.image}>
                          {c.image.split(':')[0].split('/').pop()}:{c.image.split(':')[1] || 'latest'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-sans ${
                        isRunning 
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                          : isPaused 
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                        {c.state}
                      </span>
                    </div>
                  </div>

                  {/* Resource Usage & Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-secondary font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-purple-400 font-semibold">
                        {(c.cpu_percent || 0).toFixed(1)}% CPU
                      </span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">
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
                          className="p-1.5 rounded-lg text-orbit-400 hover:text-orbit-300 hover:bg-orbit-500/10 transition-colors flex items-center gap-1 text-[11px] font-sans font-medium mr-1"
                          title={`Abrir Web UI (${webLink})`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir</span>
                        </button>
                      )}

                      {isRunning ? (
                        <>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'restart')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-secondary hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            title="Reiniciar container"
                          >
                            {isSubActionLoading('restart') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <RotateCw className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'pause')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-secondary hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Pausar container"
                          >
                            {isSubActionLoading('pause') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleContainerAction(e, c.id, 'stop')}
                            disabled={Boolean(actionLoading)}
                            className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Parar container"
                          >
                            {isSubActionLoading('stop') ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => handleContainerAction(e, c.id, 'start')}
                          disabled={Boolean(actionLoading)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
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
                        className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors ml-1"
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
        <div className="p-4 sm:px-6 bg-background/50 border-t border-border/80 flex items-center justify-between text-xs text-secondary">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orbit-400" />
            <span>Todos os sub-containers compartilham a rede e o ciclo de vida da stack.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-zinc-800 text-primary font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
