import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  DownloadCloud,
  Terminal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Layers,
  ArrowUpCircle,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import type { ContainerLike } from '../../utils/containerGroups';
import { useBatchUpdate } from '../../contexts/BatchUpdateContext';

export interface BatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  containers: ContainerLike[];
  updatesMap: Record<string, { has_update?: boolean; image?: string }>;
  onUpdateComplete?: () => Promise<void> | void;
  initialSelectedId?: string;
}

export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  isOpen,
  onClose,
  containers,
  updatesMap,
  onUpdateComplete,
  initialSelectedId,
}) => {
  const { t } = useTranslation();
  const batch = useBatchUpdate();

  const [showLogs, setShowLogs] = useState(true);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const [copiedLogs, setCopiedLogs] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Helper to identify Orbit's own container
  const isOrbitSelf = (c: ContainerLike): boolean => {
    const cleanName = c.name.replace(/^\//, '');
    return cleanName === 'orbit' || cleanName === 'orbit-dashboard' || Boolean(c.image?.includes('orbit-dashboard'));
  };

  // Containers that need updates
  const outdatedContainers = useMemo(() => {
    return containers.filter(c => updatesMap[c.id]?.has_update);
  }, [containers, updatesMap]);

  const displayedContainers = outdatedContainers;

  // Updatable containers excluding Orbit itself
  const updatableContainers = useMemo(() => {
    return displayedContainers.filter(c => !isOrbitSelf(c));
  }, [displayedContainers]);

  // Sync initial selection when modal opens if not already updating
  useEffect(() => {
    if (isOpen && !batch.isUpdating && !batch.isCompleted) {
      setExpandedErrors({});

      if (initialSelectedId && outdatedContainers.find(c => c.id === initialSelectedId && !isOrbitSelf(c))) {
        batch.setSelectedIds([initialSelectedId]);
      } else {
        batch.setSelectedIds(updatableContainers.map(c => c.id));
      }
    }
  }, [isOpen, initialSelectedId, outdatedContainers.length, batch.isUpdating, batch.isCompleted]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [batch.logs, showLogs]);

  if (!isOpen) return null;

  const handleSelectAll = () => {
    if (batch.selectedIds.length === updatableContainers.length) {
      batch.deselectAllContainers();
    } else {
      batch.selectAllContainers(updatableContainers.map(c => c.id));
    }
  };

  const toggleSelectContainer = (id: string) => {
    const target = containers.find(c => c.id === id);
    if (target && isOrbitSelf(target)) return;
    batch.toggleSelectContainer(id);
  };

  const toggleErrorDetails = (id: string) => {
    setExpandedErrors(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(batch.logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleStartUpdate = async () => {
    const targets = updatableContainers.filter(c => batch.selectedIds.includes(c.id));
    if (targets.length === 0) return;
    await batch.startBatchUpdate(targets);
    if (onUpdateComplete) {
      await onUpdateComplete();
    }
  };

  const handleRetryFailed = async () => {
    await batch.retryFailed(containers);
    if (onUpdateComplete) {
      await onUpdateComplete();
    }
  };

  const handleClose = () => {
    batch.closeModal();
    onClose();
  };

  const handleMinimize = () => {
    batch.minimizeModal();
    onClose();
  };

  const {
    isUpdating,
    isCompleted,
    taskStatuses,
    logs,
    selectedIds,
    successCount,
    failedCount,
    completedTasks,
    totalTasks,
    progressPercent,
  } = batch;

  return typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={!isUpdating ? handleClose : undefined}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-primary my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-update-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orbit-500/15 text-orbit-500">
              <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 id="batch-update-title" className="text-base sm:text-lg font-semibold tracking-tight text-primary flex items-center gap-2">
                {t('batch_update_modal.title')}
                {updatableContainers.length > 0 && !isUpdating && !isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                    {updatableContainers.length} pendente(s)
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                {t('batch_update_modal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={isUpdating ? handleMinimize : handleClose}
            className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
            aria-label={t('batch_update_modal.close')}
            title={isUpdating ? "Continuar em segundo plano" : "Fechar"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!isUpdating && !isCompleted ? (
            /* Selection Phase */
            <div className="space-y-4">
              {/* Filter Tabs & Selection summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-accent/30">
                <span className="text-xs text-secondary font-medium">
                  {updatableContainers.length} container(s) pronto(s) para atualização
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-orbit-600 dark:text-orbit-400 hover:text-orbit-500 font-medium px-2 py-1 rounded hover:bg-orbit-500/10 transition-colors"
                  >
                    {selectedIds.length === updatableContainers.length
                      ? t('batch_update_modal.deselect_all')
                      : t('batch_update_modal.select_all')}
                  </button>
                  <span className="text-xs text-secondary font-mono">
                    {t('batch_update_modal.selected_count', {
                      selected: selectedIds.length,
                      total: updatableContainers.length,
                    })}
                  </span>
                </div>
              </div>

              {/* Container Cards List */}
              {displayedContainers.length === 0 ? (
                <div className="py-12 text-center text-secondary">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-medium">{t('batch_update_modal.no_outdated_containers')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {displayedContainers.map(c => {
                    const isOrbit = isOrbitSelf(c);
                    const isSelected = selectedIds.includes(c.id);
                    const hasUpdate = updatesMap[c.id]?.has_update;
                    const cleanName = c.name.replace(/^\//, '');
                    const stackName = c.labels?.['com.docker.compose.project'];

                    return (
                      <div
                        key={c.id}
                        onClick={() => !isOrbit && toggleSelectContainer(c.id)}
                        className={`group relative flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isOrbit
                            ? 'bg-card/60 border-border/70 opacity-80 cursor-default'
                            : isSelected
                            ? 'bg-orbit-500/10 border-orbit-500/40 cursor-pointer'
                            : 'bg-card border-border hover:bg-accent hover:border-border cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isOrbit}
                            onChange={() => {}} // Handled by parent container div onClick
                            className="w-4 h-4 rounded border-border bg-background text-orbit-600 focus:ring-orbit-500 disabled:opacity-40 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-primary truncate">{cleanName}</span>
                              {hasUpdate && !isOrbit && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  {t('containers.update_available')}
                                </span>
                              )}
                              {isOrbit && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Atualize pelo menu do Orbit
                                </span>
                              )}
                              {stackName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-accent text-secondary border border-border">
                                  <Layers className="w-2.5 h-2.5" />
                                  {stackName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-secondary font-mono truncate mt-0.5">{c.image}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              c.state === 'running'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-accent text-secondary'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.state === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-secondary'
                              }`}
                            />
                            {c.state === 'running'
                              ? t('batch_update_modal.running')
                              : t('batch_update_modal.stopped')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Execution & Live Progress Phase */
            <div className="space-y-5">
              {/* Progress Bar & Status Header */}
              <div className="p-4 rounded-xl bg-accent/60 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {isUpdating ? (
                      <RefreshCw className="w-5 h-5 text-orbit-500 animate-spin" />
                    ) : failedCount > 0 ? (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                    <span className="text-sm font-semibold text-primary">
                      {isUpdating
                        ? t('batch_update_modal.updating_title')
                        : t('batch_update_modal.summary_title')}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-secondary">
                    {completedTasks} / {totalTasks} ({progressPercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border/50">
                  <div
                    className="h-full bg-orbit-500 transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium pt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {successCount} {t('batch_update_modal.status_success')}
                  </span>
                  {failedCount > 0 && (
                    <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {failedCount} {t('batch_update_modal.status_error')}
                    </span>
                  )}
                  {isUpdating && (
                    <span className="text-orbit-600 dark:text-orbit-400 flex items-center gap-1.5">
                      <DownloadCloud className="w-3.5 h-3.5 animate-pulse" />
                      {totalTasks - completedTasks} {t('batch_update_modal.status_pending')}
                    </span>
                  )}
                </div>
              </div>

              {/* Task list with live indicators */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {Object.values(taskStatuses).map(task => {
                  const isExpanded = expandedErrors[task.id];

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        task.state === 'error'
                          ? 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30'
                          : task.state === 'success'
                          ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30'
                          : task.state === 'pulling' || task.state === 'recreating'
                          ? 'bg-orbit-500/10 border-orbit-500/40 ring-1 ring-orbit-500/20'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          {task.state === 'pending' && <Clock className="w-4 h-4 text-secondary shrink-0" />}
                          {task.state === 'pulling' && <DownloadCloud className="w-4 h-4 text-orbit-500 animate-bounce shrink-0" />}
                          {task.state === 'recreating' && <RefreshCw className="w-4 h-4 text-orbit-500 animate-spin shrink-0" />}
                          {task.state === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                          {task.state === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}

                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-primary truncate block">{task.name}</span>
                            <span className="text-xs text-secondary font-mono truncate block">{task.image}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              task.state === 'success'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : task.state === 'error'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                : 'bg-orbit-500/15 text-orbit-700 dark:text-orbit-400'
                            }`}
                          >
                            {t(`batch_update_modal.status_${task.state}`)}
                          </span>

                          {task.state === 'error' && (
                            <button
                              onClick={() => toggleErrorDetails(task.id)}
                              className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                              title={t('batch_update_modal.view_error_details')}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Error details breakdown with high contrast for both light & dark themes */}
                      {task.state === 'error' && isExpanded && (
                        <div className="mt-3 p-3 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-mono space-y-1.5">
                          <div className="font-semibold text-rose-700 dark:text-rose-300">{task.error}</div>
                          {task.details && task.details !== task.error && (
                            <div className="text-rose-900/90 dark:text-rose-200/90 whitespace-pre-wrap break-all leading-relaxed">
                              {task.details}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* High-Contrast Sleek Console Log Pane (Pristine readability in both white and dark themes) */}
              <div className="rounded-xl border border-zinc-800 dark:border-border bg-zinc-950 dark:bg-black/90 text-zinc-100 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/95 border-b border-zinc-800 text-zinc-300">
                  <div className="flex items-center space-x-2 text-xs font-medium">
                    <Terminal className="w-3.5 h-3.5 text-orbit-400" />
                    <span>{t('batch_update_modal.operation_logs')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyLogs}
                      className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition-colors"
                      title="Copiar logs"
                    >
                      {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
                    >
                      {showLogs ? t('batch_update_modal.hide_logs') : t('batch_update_modal.show_logs')}
                      {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {showLogs && (
                  <div className="p-3.5 max-h-44 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950 text-zinc-200 selection:bg-orbit-500 selection:text-white">
                    {logs.map((log, index) => {
                      const isError = log.includes('ERRO') || log.includes('ERROR');
                      const isSuccess = log.includes('sucesso') || log.includes('success');
                      const isStep = log.includes('Iniciando') || log.includes('download') || log.includes('recriando');

                      return (
                        <div
                          key={index}
                          className={`leading-relaxed whitespace-pre-wrap break-all ${
                            isError
                              ? 'text-rose-400 font-semibold'
                              : isSuccess
                              ? 'text-emerald-400 font-semibold'
                              : isStep
                              ? 'text-sky-300'
                              : 'text-zinc-300'
                          }`}
                        >
                          {log}
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-border bg-card/90 backdrop-blur-md sticky bottom-0 z-10 shrink-0">
          {!isUpdating && !isCompleted ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors"
              >
                {t('batch_update_modal.cancel')}
              </button>

              <button
                onClick={handleStartUpdate}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orbit-600 hover:bg-orbit-500 rounded-xl transition-all shadow-lg shadow-orbit-600/20 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                <ArrowUpCircle className="w-4 h-4" />
                {t('batch_update_modal.start_update', { count: selectedIds.length })}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                {failedCount > 0 && !isUpdating && (
                  <button
                    onClick={handleRetryFailed}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('batch_update_modal.retry_failed')} ({failedCount})
                  </button>
                )}
                {isUpdating && (
                  <button
                    onClick={handleMinimize}
                    className="px-4 py-2 text-sm font-medium text-orbit-600 dark:text-orbit-400 hover:bg-orbit-500/10 rounded-xl transition-colors border border-orbit-500/20"
                  >
                    Continuar em Segundo Plano
                  </button>
                )}
              </div>

              <button
                onClick={handleClose}
                disabled={isUpdating}
                className="px-5 py-2.5 text-sm font-semibold text-primary bg-accent hover:bg-accent/80 rounded-xl transition-colors disabled:opacity-40"
              >
                {t('batch_update_modal.close')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
