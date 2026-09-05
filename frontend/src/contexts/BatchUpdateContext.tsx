import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { ContainerLike } from '../utils/containerGroups';

export type ContainerUpdateState = 'pending' | 'pulling' | 'recreating' | 'success' | 'error';

export interface ContainerTaskStatus {
  id: string;
  name: string;
  image: string;
  state: ContainerUpdateState;
  error?: string;
  details?: string;
}

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
  openModal: (initialId?: string) => void;
  closeModal: () => void;
  minimizeModal: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectContainer: (id: string) => void;
  selectAllContainers: (ids: string[]) => void;
  deselectAllContainers: () => void;
  startBatchUpdate: (targetContainers: ContainerLike[]) => Promise<void>;
  retryFailed: (containers: ContainerLike[]) => Promise<void>;
  clear: () => void;
}

const BatchUpdateContext = createContext<BatchUpdateContextType | undefined>(undefined);

export const BatchUpdateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, ContainerTaskStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [activeContainerName, setActiveContainerName] = useState<string | null>(null);

  const updatingRef = useRef(false);

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

  const clear = useCallback(() => {
    if (updatingRef.current) return;
    setIsUpdating(false);
    setIsCompleted(false);
    setTaskStatuses({});
    setLogs([]);
    setActiveContainerName(null);
  }, []);

  const sanitizeErrorMessage = (rawText: string, status: number): string => {
    if (!rawText) {
      return status === 504 
        ? 'Tempo limite de conexão esgotado (Gateway Timeout)' 
        : `Erro ao atualizar container (HTTP ${status})`;
    }

    if (rawText.includes('<!DOCTYPE html') || rawText.includes('<html')) {
      if (status === 524 || rawText.includes('524: A timeout occurred') || rawText.includes('Error 524')) {
        return 'Tempo limite esgotado no proxy/Cloudflare (Error 524). A operação continuará em segundo plano.';
      }
      if (status === 502 || rawText.includes('502 Bad Gateway') || rawText.includes('Bad gateway')) {
        return 'Falha temporária de comunicação com o gateway/tunnel (HTTP 502).';
      }
      if (status === 504 || rawText.includes('504 Gateway Time-out') || rawText.includes('Gateway Timeout')) {
        return 'Tempo limite de conexão esgotado pelo proxy (Gateway Timeout 504).';
      }
      if (status === 403 || rawText.includes('Access denied') || rawText.includes('Attention Required!')) {
        return 'Acesso bloqueado por regras de firewall ou proxy (HTTP 403).';
      }
      const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        return `Erro no proxy/rede: ${titleMatch[1].trim()}`;
      }
      return `Erro HTTP ${status} retornado pelo proxy ou rede.`;
    }

    return rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
  };

  const isTunnelOrProxy = (c: ContainerLike) => {
    const name = (c.name || '').toLowerCase();
    const img = (c.image || '').toLowerCase();
    return (
      name.includes('cloudflared') ||
      name.includes('tunnel') ||
      name.includes('traefik') ||
      name.includes('nginx-proxy') ||
      name.includes('caddy') ||
      img.includes('cloudflared') ||
      img.includes('traefik') ||
      img.includes('nginx-proxy')
    );
  };

  const runUpdateLoop = async (targetContainers: ContainerLike[]) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    setIsCompleted(false);

    // Prioritize standard applications first and leave networking tunnels/proxies for the end
    // to guarantee unbroken connectivity while updating other services.
    const normalContainers = targetContainers.filter(c => !isTunnelOrProxy(c));
    const proxyContainers = targetContainers.filter(c => isTunnelOrProxy(c));
    const orderedTargets = [...normalContainers, ...proxyContainers];

    const initialTasks: Record<string, ContainerTaskStatus> = {};
    orderedTargets.forEach(c => {
      initialTasks[c.id] = {
        id: c.id,
        name: c.name.replace(/^\//, ''),
        image: c.image,
        state: 'pending',
      };
    });
    setTaskStatuses(initialTasks);
    addLog(`Iniciando atualização de ${orderedTargets.length} container(s)...`);

    const token = localStorage.getItem('orbit_token');
    let localSuccess = 0;
    let localFailed = 0;

    for (let i = 0; i < orderedTargets.length; i++) {
      const c = orderedTargets[i];
      const cleanName = c.name.replace(/^\//, '');
      setActiveContainerName(cleanName);

      // Step 1: Mark pulling state
      setTaskStatuses(prev => ({
        ...prev,
        [c.id]: { ...prev[c.id], state: 'pulling' },
      }));
      addLog(`[${cleanName}] Iniciando download da imagem '${c.image}'...`);

      try {
        const response = await fetch(`/api/docker/containers/${c.id}/update`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
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
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: {
              ...prev[c.id],
              state: 'error',
              error: errorMessage,
              details: errorDetails,
            },
          }));
          addLog(`[${cleanName}] ERRO: ${errorMessage}`);
          continue;
        }

        // If backend executed synchronously and finished immediately
        if (data?.status === 'success') {
          localSuccess++;
          setTaskStatuses(prev => ({
            ...prev,
            [c.id]: { ...prev[c.id], state: 'success' },
          }));
          addLog(`[${cleanName}] Parando e recriando container...`);
          addLog(`[${cleanName}] Container atualizado e reiniciado com sucesso!`);
          continue;
        }

        // Asynchronous background task polling
        let lastStep = '';
        let completed = false;
        let consecutiveNetworkErrors = 0;
        const maxNetworkRetries = 15; // 15 * 2s = 30s buffer for tunnel reconnects

        while (!completed) {
          await new Promise(res => setTimeout(res, 2000));

          try {
            const statusRes = await fetch(`/api/docker/containers/${c.id}/update-status`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!statusRes.ok) {
              consecutiveNetworkErrors++;
              if (consecutiveNetworkErrors === 2) {
                addLog(`[${cleanName}] Aguardando resposta do container/rede...`);
              }
              if (consecutiveNetworkErrors > maxNetworkRetries) {
                throw new Error(`Servidor inacessível após ${maxNetworkRetries} tentativas (HTTP ${statusRes.status})`);
              }
              continue;
            }

            consecutiveNetworkErrors = 0;
            const task = await statusRes.json().catch(() => null);

            if (!task) continue;

            if (task.step && task.step !== lastStep) {
              lastStep = task.step;
              addLog(`[${cleanName}] ${task.step}`);
            }

            if (task.status === 'recreating') {
              setTaskStatuses(prev => ({
                ...prev,
                [c.id]: { ...prev[c.id], state: 'pulling' },
              }));
            } else if (task.status === 'success') {
              completed = true;
              localSuccess++;
              setTaskStatuses(prev => ({
                ...prev,
                [c.id]: { ...prev[c.id], state: 'success' },
              }));
            } else if (task.status === 'error') {
              completed = true;
              localFailed++;
              const err = task.error || 'Falha na atualização do container';
              setTaskStatuses(prev => ({
                ...prev,
                [c.id]: {
                  ...prev[c.id],
                  state: 'error',
                  error: err,
                  details: task.details,
                },
              }));
              addLog(`[${cleanName}] ERRO: ${err}`);
            }
          } catch (pollErr: any) {
            consecutiveNetworkErrors++;
            if (consecutiveNetworkErrors === 2) {
              addLog(`[${cleanName}] Conexão oscilando. Aguardando reconexão do proxy...`);
            }
            if (consecutiveNetworkErrors > maxNetworkRetries) {
              completed = true;
              localFailed++;
              const errMsg = pollErr?.message || 'Falha de comunicação persistente com o servidor';
              setTaskStatuses(prev => ({
                ...prev,
                [c.id]: {
                  ...prev[c.id],
                  state: 'error',
                  error: errMsg,
                  details: String(pollErr),
                },
              }));
              addLog(`[${cleanName}] ERRO: ${errMsg}`);
            }
          }
        }
      } catch (err: any) {
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

    updatingRef.current = false;
    setIsUpdating(false);
    setIsCompleted(true);
    setActiveContainerName(null);
    addLog(`Operação concluída. ${localSuccess} atualizado(s), ${localFailed} falha(s).`);

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
  const totalTasks = Object.keys(taskStatuses).length;
  const completedTasks = successCount + failedCount;
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
        openModal,
        closeModal,
        minimizeModal,
        setSelectedIds,
        toggleSelectContainer,
        selectAllContainers,
        deselectAllContainers,
        startBatchUpdate,
        retryFailed,
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
  openModal: () => {},
  closeModal: () => {},
  minimizeModal: () => {},
  setSelectedIds: () => {},
  toggleSelectContainer: () => {},
  selectAllContainers: () => {},
  deselectAllContainers: () => {},
  startBatchUpdate: async () => {},
  retryFailed: async () => {},
  clear: () => {},
};

export const useBatchUpdate = () => {
  const context = useContext(BatchUpdateContext);
  return context || defaultBatchUpdateContext;
};
