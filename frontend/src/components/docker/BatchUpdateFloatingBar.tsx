import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronUp, X } from 'lucide-react';
import { useBatchUpdate } from '../../contexts/BatchUpdateContext';

export const BatchUpdateFloatingBar: React.FC = () => {
  const {
    isUpdating,
    isCompleted,
    isModalOpen,
    activeContainerName,
    completedTasks,
    totalTasks,
    progressPercent,
    failedCount,
    openModal,
    clear,
  } = useBatchUpdate();

  // Only show when update is running or completed while modal is closed
  if (isModalOpen) return null;
  if (!isUpdating && !isCompleted) return null;

  return (
    <aside
      aria-label="Progresso da atualização em lote"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl bg-card/90 dark:bg-card/95 border border-border/80 shadow-2xl backdrop-blur-xl animate-slide-up text-primary max-w-sm sm:max-w-md w-auto"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-xl shrink-0 ${
            isUpdating
              ? 'bg-orbit-500/15 text-orbit-500'
              : failedCount > 0
              ? 'bg-rose-500/15 text-rose-500'
              : 'bg-emerald-500/15 text-emerald-500'
          }`}
        >
          {isUpdating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : failedCount > 0 ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary truncate">
              {isUpdating
                ? 'Atualizando em Segundo Plano'
                : failedCount > 0
                ? 'Atualização com Falhas'
                : 'Atualização Concluída'}
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-accent text-secondary shrink-0">
              {completedTasks}/{totalTasks} ({progressPercent}%)
            </span>
          </div>

          <p className="text-[11px] text-secondary truncate mt-0.5">
            {isUpdating && activeContainerName
              ? `Processando: ${activeContainerName}`
              : isCompleted
              ? `${completedTasks - failedCount} com sucesso, ${failedCount} erro(s)`
              : 'Aguardando fila...'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pl-1">
        <button
          onClick={() => openModal()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-orbit-600 hover:bg-orbit-500 text-white transition-all shadow-sm active:scale-95"
          title="Ver detalhes da atualização"
        >
          <span>Progresso</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {isCompleted && (
          <button
            onClick={clear}
            className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
            title="Dispensar aviso"
            aria-label="Dispensar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
