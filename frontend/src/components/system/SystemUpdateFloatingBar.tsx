import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronUp, X, RotateCcw, Sparkles } from 'lucide-react';
import { useSystemUpdate } from '../../contexts/SystemUpdateContext';

export const SystemUpdateFloatingBar: React.FC = () => {
  const { t } = useTranslation();
  const {
    isUpdating,
    status,
    progress,
    currentStep,
    targetVersion,
    isModalOpen,
    maximize,
    dismissSuccess,
  } = useSystemUpdate();

  // Exibe apenas se a atualização estiver ativa, recriando ou concluída, e o modal estiver fechado
  if (isModalOpen) return null;
  if (!isUpdating && status !== 'recreating' && status !== 'done' && status !== 'error') return null;

  return (
    <aside
      aria-label="Progresso da atualização do sistema em segundo plano"
      className="fixed bottom-5 left-5 z-50 flex items-center gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl bg-card/90 dark:bg-card/95 border border-border/80 shadow-2xl backdrop-blur-xl animate-slide-up text-primary max-w-sm sm:max-w-md w-auto"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-xl shrink-0 ${
            status === 'done'
              ? 'bg-emerald-500/15 text-emerald-500'
              : status === 'error'
              ? 'bg-rose-500/15 text-rose-500'
              : 'bg-saturn-500/15 text-saturn-500'
          }`}
        >
          {status === 'done' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : status === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4 animate-spin" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary truncate flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-saturn-400" />
              {status === 'done'
                ? t('system.update_ready_title', 'Saturn Atualizado!')
                : status === 'recreating'
                ? t('system.restarting_container_short', 'Reiniciando Saturn...')
                : t('system.updating_in_background', 'Atualizando Saturn')}
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-accent text-slate-700 dark:text-zinc-300 border border-border/50 shrink-0">
              {progress}%
            </span>
          </div>

          <p className="text-[11px] text-secondary truncate max-w-[190px] sm:max-w-[240px] mt-0.5">
            {status === 'done'
              ? t('system.reload_prompt_short', 'Clique em recarregar para aplicar as novidades')
              : currentStep || (targetVersion ? `v${targetVersion.replace(/^v/, '')}` : '')}
          </p>

          <div className="w-full bg-muted rounded-full h-1 mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                status === 'done' ? 'bg-emerald-500' : 'bg-saturn-500'
              }`}
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
        {status === 'done' ? (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('system.reload', 'Recarregar')}</span>
          </button>
        ) : (
          <button
            onClick={maximize}
            className="p-1.5 text-secondary hover:text-primary rounded-xl hover:bg-accent transition-colors"
            title="Acompanhar logs"
            aria-label="Expandir modal de atualização"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={dismissSuccess}
          className="p-1.5 text-secondary hover:text-primary rounded-xl hover:bg-accent transition-colors"
          title="Dispensar"
          aria-label="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
