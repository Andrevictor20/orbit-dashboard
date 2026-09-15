import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, Square, RotateCw, Pause, PlayCircle, Trash2, ExternalLink, DownloadCloud } from 'lucide-react';
import { ContainerIcon } from '../../ui/ContainerIcon';
import { getIconForImage } from '../../../utils/icons';
import type { ContainerData } from './ContainerOverviewTab';

interface ContainerDetailHeaderProps {
  container: ContainerData;
  appPort: string | null;
  hasUpdate: boolean;
  updating: boolean;
  actionLoading: boolean;
  onBack: () => void;
  onAction: (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => void;
  onUpdate: () => void;
  onDeleteClick: () => void;
}

export function ContainerDetailHeader({
  container,
  appPort,
  hasUpdate,
  updating,
  actionLoading,
  onBack,
  onAction,
  onUpdate,
  onDeleteClick,
}: ContainerDetailHeaderProps) {
  const { t } = useTranslation();
  const state = container.state.toLowerCase();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-2 bg-card border border-border rounded-md text-secondary hover:text-primary hover:bg-accent transition-colors shrink-0"
          aria-label={t('containers.back_to_containers', 'Voltar para containers')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center border border-border/80 shadow-sm shrink-0 p-1">
          <ContainerIcon
            src={getIconForImage(container.image, container.name)}
            name={container.name}
            image={container.image}
            size={28}
            className="w-full h-full"
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 truncate">
            <span className="truncate">{container.name}</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border shrink-0 ${
              state === 'running'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : state === 'paused'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
              {container.state.toUpperCase()}
            </span>
          </h2>
          <p className="text-secondary font-mono text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
            {container.image} • {container.id.substring(0, 12)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
        {appPort && (
          <a
            href={`http://${window.location.hostname}:${appPort}`}
            target="_blank"
            rel="noreferrer"
            title={t('containers.open_app_title', 'Abrir Aplicação')}
            className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-orbit-700 hover:text-white hover:border-orbit-600 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all"
          >
            <ExternalLink className="w-4 h-4" /> {t('containers.open_app', 'Abrir')}
          </a>
        )}

        {state === 'running' ? (
          <>
            <button onClick={() => onAction('stop')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
              <Square className="w-4 h-4" /> {t('common.stop', 'Parar')}
            </button>
            <button onClick={() => onAction('pause')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
              <Pause className="w-4 h-4" /> {t('common.pause', 'Pausar')}
            </button>
            <button onClick={() => onAction('restart')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
              <RotateCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} /> {t('common.restart', 'Reiniciar')}
            </button>
          </>
        ) : state === 'paused' ? (
          <>
            <button onClick={() => onAction('unpause')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
              <PlayCircle className="w-4 h-4" /> {t('common.resume', 'Retomar')}
            </button>
            <button onClick={() => onAction('stop')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
              <Square className="w-4 h-4" /> {t('common.stop', 'Parar')}
            </button>
          </>
        ) : (
          <button onClick={() => onAction('start')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg shadow-emerald-900/20">
            <Play className="w-4 h-4" /> {t('common.start', 'Iniciar')}
          </button>
        )}

        <button
          onClick={onUpdate}
          disabled={updating || actionLoading}
          className={`px-3 sm:px-4 py-2 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg relative ${
            hasUpdate
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 ring-2 ring-violet-400/50 shadow-violet-900/30'
              : 'bg-orbit-600 hover:bg-orbit-500 shadow-orbit-900/20'
          }`}
          title={hasUpdate ? t('containers.new_version_available_tip', 'Nova versão disponível! Clique para atualizar.') : t('containers.fetch_new_image_tip', 'Buscar nova imagem e reiniciar')}
        >
          <DownloadCloud className={`w-4 h-4 ${updating ? 'animate-bounce' : ''}`} />
          <span>{updating ? t('common.updating', 'Atualizando...') : t('common.update', 'Atualizar')}</span>
          {hasUpdate && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
          )}
        </button>

        <div className="w-px h-6 sm:h-8 bg-white/10 mx-1" />
        <button
          onClick={onDeleteClick}
          disabled={actionLoading}
          title={t('containers.delete_container', 'Excluir Container')}
          className="p-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary transition-all"
          aria-label={t('containers.delete_container', 'Excluir container')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
