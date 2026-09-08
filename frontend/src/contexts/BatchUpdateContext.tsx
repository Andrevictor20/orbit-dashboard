import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { ContainerLike } from '../utils/containerGroups';
import {
  type ContainerUpdateState,
  type ContainerTaskStatus,
  sanitizeErrorMessage,
  isTunnelOrProxy,
  pollContainerUpdate,
} from '../utils/batchUpdateRunner';

export type { ContainerUpdateState, ContainerTaskStatus };

export interface BatchUpdateContextType {
  isUpdating: boolean;
  isCompleted: boolean;
  isModalOpen: boolean;
  taskStatuses: Record<string, ContainerTaskStatus>;
  logs: string[];
  selectedIds: string[];
  activeContainerName: string | null;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  openModal: (initialId?: string) => void;
  closeModal: () => void;
  minimizeModal: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectContainer: (id: string) => void;
  selectAllContainers: (ids: string[]) => void;
  deselectAllContainers: () => void;
  startBatchUpdate: (targetContainers: ContainerLike[]) => Promise<void>;
  retryFailed: (containers: ContainerLike[]) => Promise<void>;
  cancelAll: () => void;
  cancelContainer: (id: string) => void;
  clear: () => void;
}

const BatchUpdateContext = createContext<BatchUpdateContextType | undefined>(undefined);

const BATCH_STORAGE_KEY = 'orbit_batch_update_session';

interface PersistedBatchSession {
  orderedTargets: ContainerLike[];
  startIndex: number;
  taskStatuses: Record<string, ContainerTaskStatus>;
  logs: string[];
  activeContainerName: string | null;
  timestamp: number;
}

const saveBatchSession = (session: PersistedBatchSession) => {
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(session));
  } catch {}
};

const clearBatchSession = () => {
  try {
    localStorage.removeItem(BATCH_STORAGE_KEY);
  } catch {}
};

export const BatchUpdateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, ContainerTaskStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [activeContainerName, setActiveContainerName] = useState<string | null>(null);

  const updatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(new Set());

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const openModal = useCallback((initialId?: string) => {
    if (initialId) {
      setSelectedIds([initialId]);
    }
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const minimizeModal = useCallback(() => {
    setIsModalOpen(false);
    toast('Atualização de containers continuando em segundo plano', {
      icon: '🔄',
      duration: 3500,
    });
  }, []);

  const toggleSelectContainer = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const selectAllContainers = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const deselectAllContainers = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const cancelAll = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearBatchSession();
    const token = localStorage.getItem('orbit_token');
    try {
      await fetch('/api/docker/containers/update/cancel-all', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    addLog('Cancelamento solicitado pelo usuário. Parando todos os processos...');
  }, [addLog]);

  const cancelContainer = useCallback(async (id: string) => {
    cancelledIdsRef.current.add(id);
    const token = localStorage.getItem('orbit_token');
    try {
      await fetch(`/api/docker/containers/${id}/update/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    setTaskStatuses(prev => {
      const task = prev[id];
      if (task && task.state !== 'success' && task.state !== 'error') {
        addLog(`[${task.name}] Cancelado pelo usuário.`);
        return {
          ...prev,
          [id]: { ...task, state: 'cancelled', error: 'Cancelado pelo usuário' },
        };
      }
      return prev;
    });
  }, [addLog]);

  const clear = useCallback(() => {
    if (updatingRef.current) return;
    clearBatchSession();
    setIsUpdating(false);
    setIsCompleted(false);
    setTaskStatuses({});
    setLogs([]);
    setActiveContainerName(null);
    cancelledIdsRef.current.clear();
  }, []);

  const runUpdateLoop = async (
    targetContainers: ContainerLike[],
    startIndex = 0,
    savedStatuses?: Record<string, ContainerTaskStatus>,
    savedLogs?: string[]
  ) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    setIsCompleted(false);
    cancelledIdsRef.current.clear();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Prioritize standard applications first and leave networking tunnels/proxies for the end
    // to guarantee unbroken connectivity while updating other services.
    const normalContainers = targetContainers.filter(c => !isTunnelOrProxy(c));
    const proxyContainers = targetContainers.filter(c => isTunnelOrProxy(c));
    const orderedTargets = [...normalContainers, ...proxyContainers];

    const currentStatuses: Record<string, ContainerTaskStatus> = savedStatuses ? { ...savedStatuses } : {};
    if (!savedStatuses) {
      orderedTargets.forEach(c => {
        currentStatuses[c.id] = {
          id: c.id,
          name: c.name.replace(/^\//, ''),
          image: c.image,
          state: 'pending',
        };
      });
      setTaskStatuses(currentStatuses);
      addLog(`Iniciando atualização de ${orderedTargets.length} container(s)...`);
    } else {
      setTaskStatuses(currentStatuses);
      if (savedLogs && savedLogs.length > 0) {
        setLogs(savedLogs);
      }
      addLog(`Retomando lote de atualização a partir do container ${startIndex + 1}/${orderedTargets.length}...`);
    }

    const token = localStorage.getItem('orbit_token');
    let localSuccess = Object.values(currentStatuses).filter(t => t.state === 'success').length;
    let localFailed = Object.values(currentStatuses).filter(t => t.state === 'error').length;

    for (let i = startIndex; i < orderedTargets.length; i++) {
      // Check if entire batch was cancelled
      if (controller.signal.aborted) {
        // Mark remaining containers as cancelled
        for (let j = i; j < orderedTargets.length; j++) {
          const remaining = orderedTargets[j];
          const remainingName = remaining.name.replace(/^\//, '');
          setTaskStatuses(prev => {
            const next = {
              ...prev,
              [remaining.id]: { ...prev[remaining.id], state: 'cancelled' as const, error: 'Cancelado pelo usuário' },
            };
            return next;
          });
          addLog(`[${remainingName}] Cancelado pelo usuário.`);
        }
        clearBatchSession();
        break;
      }

      const c = orderedTargets[i];
      const cleanName = c.name.replace(/^\//, '');

      // Check if this specific container was individually cancelled
      if (cancelledIdsRef.current.has(c.id)) {
        continue;
      }

      // Check if container was already successfully updated in a previous run before reload
      if (currentStatuses[c.id]?.state === 'success') {
        continue;
      }

      setActiveContainerName(cleanName);

      // Persiste o progresso no localStorage para recuperação imediata em caso de F5
      saveBatchSession({
        orderedTargets,
        startIndex: i,
        taskStatuses: currentStatuses,
        logs: [],
        activeContainerName: cleanName,
        timestamp: Date.now(),
      });

      // Step 1: Mark pulling state
      currentStatuses[c.id] = { ...currentStatuses[c.id], state: 'pulling' };
      setTaskStatuses(prev => ({ ...prev, [c.id]: { ...prev[c.id], state: 'pulling' } }));
      addLog(`[${cleanName}] Iniciando download da imagem '${c.image}'...`);

      try {
        // Verifica se o backend já tem uma task ativa para esse container antes de forçar novo POST
        let skipTrigger = false;
        try {
          const checkActiveRes = await fetch(`/api/docker/containers/${c.id}/update-status`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          });
          if (checkActiveRes.ok) {
            const activeData = await checkActiveRes.json().catch(() => null);
            if (activeData?.status === 'pulling' || activeData?.status === 'recreating') {
              skipTrigger = true;
              addLog(`[${cleanName}] Sincronizado com processo já em execução no servidor...`);
            } else if (activeData?.status === 'success') {
              localSuccess++;
              currentStatuses[c.id] = { ...currentStatuses[c.id], state: 'success' };
              setTaskStatuses(prev => ({ ...prev, [c.id]: { ...prev[c.id], state: 'success' } }));
              addLog(`[${cleanName}] Container já atualizado e reiniciado com sucesso!`);
              continue;
            }
          }
        } catch {}

        if (!skipTrigger) {
          const response = await fetch(`/api/docker/containers/${c.id}/update?force=true`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          const rawText = await response.text().catch(() => '');
          let data: any = null;
          try {
            data = JSON.parse(rawText);
          } catch {
            data = null;
          }

          if (!response.ok || data?.status === 'error') {
            localFailed++;
            const errorMessage = data?.message || sanitizeErrorMessage(rawText, response.status);
            const errorDetails = data?.details || rawText || JSON.stringify(data);
            currentStatuses[c.id] = {
              ...currentStatuses[c.id],
              state: 'error',
              error: errorMessage,
              details: errorDetails,
            };
            setTaskStatuses(prev => ({
              ...prev,
              [c.id]: currentStatuses[c.id],
            }));
            addLog(`[${cleanName}] ERRO: ${errorMessage}`);
            continue;
          }

          // If backend executed synchronously and finished immediately
          if (data?.status === 'success') {
            localSuccess++;
            currentStatuses[c.id] = { ...currentStatuses[c.id], state: 'success' };
            setTaskStatuses(prev => ({
              ...prev,
              [c.id]: { ...prev[c.id], state: 'success' },
            }));
            addLog(`[${cleanName}] Parando e recriando container...`);
            addLog(`[${cleanName}] Container atualizado e reiniciado com sucesso!`);
            continue;
          }
        }

        // Asynchronous background task polling via Activity-Based Watchdog
        const pollResult = await pollContainerUpdate({
          containerId: c.id,
          cleanName,
          token,
          signal: controller.signal,
          isCancelled: () => cancelledIdsRef.current.has(c.id),
          onStatusChange: (status) => {
            setTaskStatuses(prev => ({
              ...prev,
              [c.id]: { ...prev[c.id], state: status },
            }));
          },
          addLog,
        });

        if (pollResult.wasCancelled) {
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: { ...prev[c.id], state: 'cancelled', error: 'Cancelado pelo usuário' },
          }));
          addLog(`[${cleanName}] Cancelado pelo usuário.`);
          continue;
        }

        if (pollResult.success) {
          localSuccess++;
          currentStatuses[c.id] = { ...currentStatuses[c.id], state: 'success' };
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: { ...prev[c.id], state: 'success' },
          }));
          addLog(`[${cleanName}] Container atualizado e reiniciado com sucesso!`);
        } else {
          localFailed++;
          const err = pollResult.error || 'Falha na atualização do container';
          currentStatuses[c.id] = {
            ...currentStatuses[c.id],
            state: 'error',
            error: err,
            details: pollResult.details,
          };
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: currentStatuses[c.id],
          }));
          addLog(`[${cleanName}] ERRO: ${err}`);
        }
      } catch (err: any) {
        // If aborted via AbortController, handle as cancellation not error
        if (controller.signal.aborted) {
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: { ...prev[c.id], state: 'cancelled', error: 'Cancelado pelo usuário' },
          }));
          addLog(`[${cleanName}] Cancelado pelo usuário.`);
        } else {
          localFailed++;
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
          addLog(`[${cleanName}] ERRO: ${errorText}`);
        }
      }
    }

    updatingRef.current = false;
    abortControllerRef.current = null;
    setIsUpdating(false);
    setIsCompleted(true);
    setActiveContainerName(null);
    clearBatchSession();

    const wasCancelled = controller.signal.aborted;
    if (wasCancelled) {
      addLog(`Operação cancelada pelo usuário. ${localSuccess} atualizado(s), ${localFailed} falha(s).`);
    } else {
      addLog(`Operação concluída. ${localSuccess} atualizado(s), ${localFailed} falha(s).`);
    }

    // Dispatch global refresh event so container lists re-fetch images automatically
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orbit:containers-updated'));
    }

    // Global toast notification upon batch completion
    if (localFailed === 0 && localSuccess > 0) {
      toast.success(`Atualização de ${localSuccess} container(s) concluída com sucesso!`, {
        duration: 5000,
      });
    } else if (localFailed > 0) {
      toast.error(`Atualização em lote finalizada: ${localSuccess} com sucesso, ${localFailed} com falha.`, {
        duration: 6000,
      });
    }
  };

  // Auto-Resume após F5: restaura sessão salva no localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BATCH_STORAGE_KEY);
      if (!raw) return;
      const session: PersistedBatchSession = JSON.parse(raw);
      if (
        !session ||
        !Array.isArray(session.orderedTargets) ||
        session.orderedTargets.length === 0 ||
        Date.now() - session.timestamp > 3600000 // 1h expiry
      ) {
        clearBatchSession();
        return;
      }

      toast('Recuperando atualização de containers em lote em andamento...', {
        icon: '🔄',
        duration: 4000,
      });

      runUpdateLoop(session.orderedTargets, session.startIndex, session.taskStatuses, session.logs);
    } catch {}
  }, []);

  const startBatchUpdate = async (targetContainers: ContainerLike[]) => {
    if (targetContainers.length === 0) return;
    await runUpdateLoop(targetContainers);
  };

  const retryFailed = async (containers: ContainerLike[]) => {
    const failedIds = Object.values(taskStatuses)
      .filter(t => t.state === 'error')
      .map(t => t.id);
    const targets = containers.filter(c => failedIds.includes(c.id));
    if (targets.length === 0) return;
    await runUpdateLoop(targets);
  };

  const successCount = Object.values(taskStatuses).filter(t => t.state === 'success').length;
  const failedCount = Object.values(taskStatuses).filter(t => t.state === 'error').length;
  const cancelledCount = Object.values(taskStatuses).filter(t => t.state === 'cancelled').length;
  const totalTasks = Object.keys(taskStatuses).length;
  const completedTasks = successCount + failedCount + cancelledCount;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <BatchUpdateContext.Provider
      value={{
        isUpdating,
        isCompleted,
        isModalOpen,
        taskStatuses,
        logs,
        selectedIds,
        activeContainerName,
        progressPercent,
        completedTasks,
        totalTasks,
        successCount,
        failedCount,
        cancelledCount,
        openModal,
        closeModal,
        minimizeModal,
        setSelectedIds,
        toggleSelectContainer,
        selectAllContainers,
        deselectAllContainers,
        startBatchUpdate,
        retryFailed,
        cancelAll,
        cancelContainer,
        clear,
      }}
    >
      {children}
    </BatchUpdateContext.Provider>
  );
};

const defaultBatchUpdateContext: BatchUpdateContextType = {
  isUpdating: false,
  isCompleted: false,
  isModalOpen: false,
  taskStatuses: {},
  logs: [],
  selectedIds: [],
  activeContainerName: null,
  progressPercent: 0,
  completedTasks: 0,
  totalTasks: 0,
  successCount: 0,
  failedCount: 0,
  cancelledCount: 0,
  openModal: () => {},
  closeModal: () => {},
  minimizeModal: () => {},
  setSelectedIds: () => {},
  toggleSelectContainer: () => {},
  selectAllContainers: () => {},
  deselectAllContainers: () => {},
  startBatchUpdate: async () => {},
  retryFailed: async () => {},
  cancelAll: () => {},
  cancelContainer: () => {},
  clear: () => {},
};

export const useBatchUpdate = () => {
  const context = useContext(BatchUpdateContext);
  return context || defaultBatchUpdateContext;
};
