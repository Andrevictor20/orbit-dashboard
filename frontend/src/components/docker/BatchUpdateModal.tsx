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
  Check
} from 'lucide-react';
import type { ContainerLike } from '../../utils/containerGroups';

export type ContainerUpdateState = 'pending' | 'pulling' | 'recreating' | 'success' | 'error';

export interface ContainerTaskStatus {
  id: string;
  name: string;
  image: string;
  state: ContainerUpdateState;
  error?: string;
  details?: string;
}

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, ContainerTaskStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const [copiedLogs, setCopiedLogs] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // We only care about containers that actually need updates
  const outdatedContainers = useMemo(() => {
    return containers.filter(c => updatesMap[c.id]?.has_update);
  }, [containers, updatesMap]);

  const displayedContainers = outdatedContainers;

  // Sync initial selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsUpdating(false);
      setIsCompleted(false);
      setTaskStatuses({});
      setLogs([]);
      setExpandedErrors({});

      if (initialSelectedId && outdatedContainers.find(c => c.id === initialSelectedId)) {
        setSelectedIds([initialSelectedId]);
      } else {
        setSelectedIds(outdatedContainers.map(c => c.id));
      }
    }
  }, [isOpen, initialSelectedId, outdatedContainers.length]); // Added .length to prevent infinite reset loops

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  if (!isOpen) return null;

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === displayedContainers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedContainers.map(c => c.id));
    }
  };

  const toggleSelectContainer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleErrorDetails = (id: string) => {
    setExpandedErrors(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const runBatchUpdate = async (targetContainers: ContainerLike[]) => {
    setIsUpdating(true);
    setIsCompleted(false);
    setShowLogs(true);

    const initialTasks: Record<string, ContainerTaskStatus> = {};
    targetContainers.forEach(c => {
      initialTasks[c.id] = {
        id: c.id,
        name: c.name,
        image: c.image,
        state: 'pending',
      };
    });
    setTaskStatuses(initialTasks);
    addLog(`Iniciando atualização de ${targetContainers.length} container(s)...`);

    const token = localStorage.getItem('orbit_token');

    for (let i = 0; i < targetContainers.length; i++) {
      const c = targetContainers[i];
      const cleanName = c.name.replace(/^\//, '');

      // Step 1: Pulling
      setTaskStatuses(prev => ({
        ...prev,
        [c.id]: { ...prev[c.id], state: 'pulling' },
      }));
      addLog(t('batch_update_modal.step_pull_start', { name: cleanName, image: c.image }));

      try {
        const response = await fetch(`/api/docker/containers/${c.id}/update`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        // Step 2: Recreating
        setTaskStatuses(prev => ({
          ...prev,
          [c.id]: { ...prev[c.id], state: 'recreating' },
        }));
        addLog(t('batch_update_modal.step_recreate_start', { name: cleanName }));

        const data = await response.json().catch(() => null);

        if (response.ok && data?.status !== 'error') {
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: { ...prev[c.id], state: 'success' },
          }));
          addLog(t('batch_update_modal.step_recreate_done', { name: cleanName }));
        } else {
          const errorMessage = data?.message || data?.details || t('batch_update_modal.status_error');
          const errorDetails = data?.details || JSON.stringify(data);
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: {
              ...prev[c.id],
              state: 'error',
              error: errorMessage,
              details: errorDetails,
            },
          }));
          addLog(t('batch_update_modal.step_error', { name: cleanName, error: errorMessage }));
        }
      } catch (err: any) {
        const errorText = err?.message || 'Erro de conexão ou timeout na requisição';
        setTaskStatuses(prev => ({
          ...prev,
          [c.id]: {
            ...prev[c.id],
            state: 'error',
            error: errorText,
            details: String(err),
          },
        }));
        addLog(t('batch_update_modal.step_error', { name: cleanName, error: errorText }));
      }
    }

    setIsUpdating(false);
    setIsCompleted(true);
    addLog(`Operação concluída.`);

    if (onUpdateComplete) {
      await onUpdateComplete();
    }
  };

  const handleStartUpdate = () => {
    const target = containers.filter(c => selectedIds.includes(c.id));
    if (target.length === 0) return;
    runBatchUpdate(target);
  };

  const handleRetryFailed = () => {
    const failedIds = Object.values(taskStatuses)
      .filter(t => t.state === 'error')
      .map(t => t.id);
    const target = containers.filter(c => failedIds.includes(c.id));
    if (target.length === 0) return;
    runBatchUpdate(target);
  };

  const successCount = Object.values(taskStatuses).filter(t => t.state === 'success').length;
  const failedCount = Object.values(taskStatuses).filter(t => t.state === 'error').length;
  const totalTasks = Object.keys(taskStatuses).length;
  const completedTasks = successCount + failedCount;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={!isUpdating ? onClose : undefined}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-primary my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-update-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-500">
              <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 id="batch-update-title" className="text-lg font-semibold tracking-tight text-primary flex items-center gap-2">
                {t('batch_update_modal.title')}
                {displayedContainers.length > 0 && !isUpdating && !isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                    {displayedContainers.length} pendente(s)
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                {t('batch_update_modal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
            aria-label={t('batch_update_modal.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isUpdating && !isCompleted ? (
            /* Selection Phase */
            <div className="space-y-4">
              {/* Filter Tabs & Selection summary */}
              <div className="flex flex-wrap items-center justify-end gap-3 p-2 rounded-xl border border-border bg-accent/30">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-orbit-500 hover:text-orbit-400 font-medium px-2 py-1 rounded hover:bg-orbit-500/10 transition-colors"
                  >
                    {selectedIds.length === displayedContainers.length
                      ? t('batch_update_modal.deselect_all')
                      : t('batch_update_modal.select_all')}
                  </button>
                  <span className="text-xs text-secondary font-mono">
                    {t('batch_update_modal.selected_count', {
                      selected: selectedIds.length,
                      total: displayedContainers.length,
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
                    const isSelected = selectedIds.includes(c.id);
                    const hasUpdate = updatesMap[c.id]?.has_update;
                    const cleanName = c.name.replace(/^\//, '');
                    const stackName = c.labels?.['com.docker.compose.project'];

                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleSelectContainer(c.id)}
                        className={`group relative flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orbit-500/10 border-orbit-500/40'
                            : 'bg-card border-border hover:bg-accent hover:border-border'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent container div onClick
                            className="w-4 h-4 rounded border-border bg-background text-orbit-600 focus:ring-orbit-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-primary truncate">{cleanName}</span>
                              {hasUpdate && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500">
                                  {t('containers.update_available')}
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
                                ? 'bg-emerald-500/10 text-emerald-500'
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
              <div className="p-4 rounded-xl bg-accent border border-border space-y-3">
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
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orbit-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-4 text-xs font-medium pt-1">
                  <span className="text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {successCount} {t('batch_update_modal.status_success')}
                  </span>
                  {failedCount > 0 && (
                    <span className="text-rose-500 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {failedCount} {t('batch_update_modal.status_error')}
                    </span>
                  )}
                  {isUpdating && (
                    <span className="text-orbit-500 flex items-center gap-1.5">
                      <DownloadCloud className="w-3.5 h-3.5 animate-pulse" />
                      {totalTasks - completedTasks} {t('batch_update_modal.status_pending')}
                    </span>
                  )}
                </div>
              </div>

              {/* Task list with live indicators */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {Object.values(taskStatuses).map(task => {
                  const isExpanded = expandedErrors[task.id];

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        task.state === 'error'
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : task.state === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : task.state === 'pulling' || task.state === 'recreating'
                          ? 'bg-orbit-500/10 border-orbit-500/40 ring-1 ring-orbit-500/20'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          {task.state === 'pending' && <Clock className="w-4 h-4 text-secondary" />}
                          {task.state === 'pulling' && <DownloadCloud className="w-4 h-4 text-orbit-500 animate-bounce" />}
                          {task.state === 'recreating' && <RefreshCw className="w-4 h-4 text-orbit-500 animate-spin" />}
                          {task.state === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {task.state === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}

                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-primary truncate block">{task.name}</span>
                            <span className="text-xs text-secondary font-mono truncate block">{task.image}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              task.state === 'success'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : task.state === 'error'
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-orbit-500/10 text-orbit-500'
                            }`}
                          >
                            {t(`batch_update_modal.status_${task.state}`)}
                          </span>

                          {task.state === 'error' && (
                            <button
                              onClick={() => toggleErrorDetails(task.id)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/20 transition-colors"
                              title={t('batch_update_modal.view_error_details')}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Error details breakdown */}
                      {task.state === 'error' && isExpanded && (
                        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-mono text-rose-400 space-y-1">
                          <div className="font-semibold">{task.error}</div>
                          {task.details && task.details !== task.error && (
                            <div className="text-rose-400/80 whitespace-pre-wrap">{task.details}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Collapsible Console Log Pane */}
              <div className="rounded-xl border border-border bg-black/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-accent/50 border-b border-border">
                  <div className="flex items-center space-x-2 text-xs font-medium text-secondary">
                    <Terminal className="w-3.5 h-3.5 text-orbit-500" />
                    <span>{t('batch_update_modal.operation_logs')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyLogs}
                      className="p-1 text-secondary hover:text-primary rounded hover:bg-accent transition-colors"
                      title="Copiar logs"
                    >
                      {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="text-xs text-secondary hover:text-primary flex items-center gap-1"
                    >
                      {showLogs ? t('batch_update_modal.hide_logs') : t('batch_update_modal.show_logs')}
                      {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {showLogs && (
                  <div className="p-3 max-h-40 overflow-y-auto font-mono text-xs text-secondary space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`${
                          log.includes('ERRO') || log.includes('ERROR')
                            ? 'text-rose-500'
                            : log.includes('sucesso') || log.includes('success')
                            ? 'text-emerald-500'
                            : 'text-secondary'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/90 sticky bottom-0 z-10">
          {!isUpdating && !isCompleted ? (
            <>
              <button
                onClick={onClose}
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('batch_update_modal.retry_failed')} ({failedCount})
                  </button>
                )}
                {isUpdating && (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors"
                  >
                    Continuar em Segundo Plano
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
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
