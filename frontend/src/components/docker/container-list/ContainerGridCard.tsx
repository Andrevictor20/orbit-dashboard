import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Square, RotateCw, Pause, PlayCircle, ExternalLink, Settings2, Globe, DownloadCloud 
} from 'lucide-react';
import { formatRAM, formatBytes } from '../../../utils/format';
import { getIconForImage } from '../../../utils/icons';
import { resolveWebUrl } from '../../../utils/url';
import { getContainerWebLink, getSortedDeduplicatedPorts, getContainerDiskUsage } from '../../../utils/containerGroups';
import { ContainerIcon } from '../../ui/ContainerIcon';
import type { Container } from './types';

export interface ContainerGridCardProps {
  container: Container;
  customLinks: Record<string, string>;
  updatesMap: Record<string, { has_update: boolean }>;
  actionLoading: string | null;
  onAction: (e: React.MouseEvent, id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => void;
  onUpdateContainer: (e: React.MouseEvent, id: string) => void;
  onSetCustomLink: (e: React.MouseEvent, id: string) => void;
}

export function ContainerGridCard({
  container: c,
  customLinks,
  updatesMap,
  actionLoading,
  onAction,
  onUpdateContainer,
  onSetCustomLink,
}: ContainerGridCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/containers/${c.id}`)}
      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3.5 relative group hover:border-orbit-600 transition-all cursor-pointer shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 bg-card rounded-xl flex items-center justify-center border border-border/80 shadow-sm shrink-0 group-hover:border-orbit-500/30 transition-colors p-1.5">
            <ContainerIcon
              src={getIconForImage(c.image, c.name)}
              name={c.name}
              image={c.image}
              size={32}
              className="w-full h-full"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-primary text-sm truncate" title={c.name}>{c.name}</span>
            <span className="text-[11px] text-secondary font-medium truncate" title={c.image}>
              {c.labels?.['com.docker.compose.service'] || c.labels?.['io.casaos.app.name'] || c.image.split(':')[0].split('/').pop()}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${c.state?.toLowerCase() === 'running' ? 'bg-emerald-500 animate-pulse' : c.state?.toLowerCase() === 'paused' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-xs text-secondary capitalize">{c.state}</span>
            </div>
          </div>
        </div>

        {(updatesMap[c.id]?.has_update || updatesMap[c.id?.substring(0, 12)]?.has_update) && (
          <button
            onClick={(e) => onUpdateContainer(e, c.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/40 text-[11px] font-semibold hover:bg-violet-500/30 transition-all shadow-sm shrink-0"
            title="Nova versão da imagem disponível para seu dispositivo. Clique para atualizar e reiniciar."
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>{t('batch_update_modal.badge_update', { defaultValue: 'Atualizar' })}</span>
          </button>
        )}
      </div>

      {/* Resource Metrics */}
      <div className="grid grid-cols-3 gap-2 bg-background/80 p-2.5 rounded-lg border border-border/50">
        <div className="flex flex-col">
          <span className="text-[10px] text-orbit-600 dark:text-orbit-400 uppercase font-semibold tracking-wider">CPU</span>
          <span className="text-xs text-primary font-mono font-bold">{c.cpu_percent?.toFixed(1) || '0.0'}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-orbit-600 dark:text-orbit-400 uppercase font-semibold tracking-wider">RAM</span>
          <span className="text-xs text-primary font-mono font-bold">{formatRAM(c.memory_used)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-orbit-600 dark:text-orbit-400 uppercase font-semibold tracking-wider">Disco</span>
          <span className="text-xs text-primary font-mono font-bold">{formatBytes(getContainerDiskUsage(c))}</span>
        </div>
      </div>

      {/* Network / Ports / Custom Link Status */}
      <div className="flex items-center justify-between text-xs text-secondary gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          {(() => {
            const sortedPorts = getSortedDeduplicatedPorts(c.ports, c.image, c.name, c.labels);
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

        {(() => {
          const webLink = getContainerWebLink(c, customLinks);
          if (webLink) {
            return (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(webLink, '_blank');
                  }}
                  className="glass-button px-2.5 py-1 text-xs rounded-lg text-orbit-600 dark:text-orbit-400 hover:text-orbit-500 flex items-center gap-1 transition-colors border border-orbit-500/30 font-semibold"
                  title={`Abrir ${c.name} (${webLink})`}
                >
                  <Globe className="w-3 h-3 text-orbit-600 dark:text-orbit-400" />
                  <span className="truncate max-w-[80px]">{t('containers.open_app')}</span>
                </button>
                <button
                  onClick={(e) => onSetCustomLink(e, c.id)}
                  className="glass-button p-1 text-xs rounded-lg text-secondary hover:text-primary transition-colors border border-border/50"
                  title={customLinks[c.id] ? `Custom Link: ${customLinks[c.id]}` : 'Configurar Link'}
                >
                  <Settings2 className="w-3 h-3" />
                </button>
              </div>
            );
          }
          return (
            <button
              onClick={(e) => onSetCustomLink(e, c.id)}
              className="glass-button p-1.5 text-xs rounded-lg text-secondary hover:text-primary flex items-center justify-center border border-border/50 shrink-0"
              title="Configurar Link"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          );
        })()}
      </div>

      {/* Action Controls Bar */}
      <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50 gap-1.5">
        {c.state?.toLowerCase() === 'running' ? (
          <>
            <button 
              onClick={(e) => onAction(e, c.id, 'stop')} 
              disabled={actionLoading === c.id} 
              className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 flex-1 flex items-center justify-center gap-1 transition-colors" 
              title="Parar container"
            >
              <Square className="w-3.5 h-3.5 shrink-0" />
              <span>Parar</span>
            </button>
            <button 
              onClick={(e) => onAction(e, c.id, 'pause')} 
              disabled={actionLoading === c.id} 
              className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 flex-1 flex items-center justify-center gap-1 transition-colors" 
              title="Pausar container"
            >
              <Pause className="w-3.5 h-3.5 shrink-0" />
              <span>Pausar</span>
            </button>
            <button 
              onClick={(e) => onAction(e, c.id, 'restart')} 
              disabled={actionLoading === c.id} 
              className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 flex-1 flex items-center justify-center gap-1 transition-colors" 
              title="Reiniciar container"
            >
              <RotateCw className={`w-3.5 h-3.5 shrink-0 ${actionLoading === c.id ? 'animate-spin' : ''}`} />
              <span>Reiniciar</span>
            </button>
          </>
        ) : c.state?.toLowerCase() === 'paused' ? (
          <>
            <button 
              onClick={(e) => onAction(e, c.id, 'unpause')} 
              disabled={actionLoading === c.id} 
              className="glass-button px-2.5 py-1.5 text-xs rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 flex-1 flex items-center justify-center gap-1.5 font-semibold transition-colors"
              title="Retomar execução do container"
            >
              <PlayCircle className={`w-3.5 h-3.5 ${actionLoading === c.id ? 'animate-pulse' : ''}`} />
              <span>Retomar</span>
            </button>
            <button 
              onClick={(e) => onAction(e, c.id, 'stop')} 
              disabled={actionLoading === c.id} 
              className="glass-button px-2.5 py-1.5 text-xs rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 flex-1 flex items-center justify-center gap-1.5 transition-colors"
              title="Parar container"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Parar</span>
            </button>
          </>
        ) : (
          <button 
            onClick={(e) => onAction(e, c.id, 'start')} 
            disabled={actionLoading === c.id} 
            className="glass-button px-3 py-1.5 text-xs rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 w-full flex items-center justify-center gap-1.5 font-semibold transition-colors"
            title="Iniciar container"
          >
            <Play className={`w-3.5 h-3.5 ${actionLoading === c.id ? 'animate-pulse' : ''}`} />
            <span>Iniciar Container</span>
          </button>
        )}
      </div>
    </div>
  );
}
