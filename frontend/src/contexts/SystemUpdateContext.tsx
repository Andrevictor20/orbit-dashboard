import { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth';

export type SystemUpdateStatus = 'idle' | 'pulling' | 'recreating' | 'done' | 'error';

export interface SystemUpdateTaskState {
  status: SystemUpdateStatus;
  progress: number;
  currentStep: string;
  logs: string[];
  error?: string | null;
  targetVersion: string;
}

interface SystemUpdateContextType {
  isUpdating: boolean;
  status: SystemUpdateStatus;
  progress: number;
  currentStep: string;
  logs: string[];
  error: string | null;
  targetVersion: string;
  isModalOpen: boolean;
  isMinimized: boolean;
  reconnectAttempts: number;
  startUpdate: (targetVersion?: string) => Promise<void>;
  minimize: () => void;
  maximize: () => void;
  openModal: () => void;
  closeModal: () => void;
  dismissSuccess: () => void;
}

const SystemUpdateContext = createContext<SystemUpdateContextType | undefined>(undefined);

const SATURN_UPDATE_STORAGE_KEY = 'saturn_background_update_active';
const SATURN_TARGET_VERSION_KEY = 'saturn_target_version';

export function SystemUpdateProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<SystemUpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetVersion, setTargetVersion] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const activePollingRef = useRef(false);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    setIsModalOpen(false);
  }, []);

  const maximize = useCallback(() => {
    setIsMinimized(false);
    setIsModalOpen(true);
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (isUpdating && status !== 'done' && status !== 'error') {
      setIsMinimized(true);
    }
    setIsModalOpen(false);
  }, [isUpdating, status]);

  const dismissSuccess = useCallback(() => {
    setIsUpdating(false);
    setStatus('idle');
    setProgress(0);
    setLogs([]);
    setError(null);
    setIsMinimized(false);
    localStorage.removeItem(SATURN_UPDATE_STORAGE_KEY);
    localStorage.removeItem(SATURN_TARGET_VERSION_KEY);
  }, []);

  // Health check loop when recreating container
  const startHealthCheckLoop = useCallback((expectedTargetVer: string) => {
    let attempts = 0;
    let isChecking = false;

    const interval = setInterval(async () => {
      if (isChecking) return;
      isChecking = true;
      attempts++;
      setReconnectAttempts(attempts);

      try {
        let res = await fetch('/api/health', { cache: 'no-store' });
        let isHtml = res.headers.get('content-type')?.includes('text/html');

        if (!res.ok || isHtml) {
          res = await fetch('/health', { cache: 'no-store' });
          isHtml = res.headers.get('content-type')?.includes('text/html');
        }

        if (res.ok && !isHtml) {
          const healthData = await res.json().catch(() => null);
          if (healthData && (healthData.status === 'ok' || healthData.version)) {
            const onlineVer = (healthData.version || '').replace(/^v/, '');
            const targetClean = (expectedTargetVer || '').replace(/^v/, '');

            // Se o contêiner antigo ainda responder com versão anterior, aguarda o novo
            if (targetClean && onlineVer && onlineVer !== targetClean && attempts < 40) {
              setLogs(prev => [
                ...prev,
                `⏳ Contêiner anterior (v${onlineVer}) ainda ativo. Aguardando reinicialização com v${targetClean}...`
              ]);
              isChecking = false;
              return;
            }

            clearInterval(interval);
            setStatus('done');
            setProgress(100);
            setIsUpdating(false);
            setCurrentStep(t('system.update_complete_reloading', 'Atualização concluída com sucesso!'));
            setLogs(prev => [
              ...prev,
              `✅ [CONFIRMADO] Novo contêiner online e operacional (Saturn ${onlineVer ? `v${onlineVer}` : ''}).`
            ]);

            localStorage.removeItem(SATURN_UPDATE_STORAGE_KEY);
            localStorage.removeItem(SATURN_TARGET_VERSION_KEY);
            if (onlineVer) {
              localStorage.setItem('saturn_last_updated_version', onlineVer);
            }

            toast.success(
              t('system.update_finished_toast', {
                version: onlineVer || expectedTargetVer,
                defaultValue: `Saturn atualizado para v${onlineVer || expectedTargetVer} com sucesso!`
              }),
              { duration: 8000 }
            );
            return;
          }
        }
      } catch {
        // Container antigo sendo desligado, comportamento esperado
      } finally {
        isChecking = false;
      }

      if (attempts >= 60) {
        clearInterval(interval);
        setStatus('error');
        setIsUpdating(false);
        setError(t('system.timeout_reconnecting', 'Tempo limite ao reconectar. Verifique os logs do Docker ou recarregue a página.'));
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [t]);

  // Main task runner
  const startUpdate = useCallback(async (targetVer?: string) => {
    const version = targetVer || '';
    setTargetVersion(version);
    setIsUpdating(true);
    setStatus('pulling');
    setProgress(10);
    setCurrentStep(t('system.starting_download', 'Iniciando download da imagem mais recente...'));
    setLogs([
      `[Saturn Update Agent] Inicializando atualização transparente do contêiner...`,
      version ? `[Target] ghcr.io/andrevictor20/saturn:v${version.replace(/^v/, '')}` : `[Target] ghcr.io/andrevictor20/saturn:latest`
    ]);
    setError(null);
    setIsModalOpen(true);
    setIsMinimized(false);
    setReconnectAttempts(0);

    localStorage.setItem(SATURN_UPDATE_STORAGE_KEY, 'true');
    if (version) {
      localStorage.setItem(SATURN_TARGET_VERSION_KEY, version);
    }

    try {
      const token = getAuthToken();
      const queryParam = version ? `?version=${encodeURIComponent(version)}` : '';
      const res = await fetch(`/api/system/update${queryParam}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || t('system.failed_start_update', 'Falha ao acionar processo de atualização'));
      }
    } catch (err: any) {
      setStatus('error');
      setIsUpdating(false);
      setError(err.message || 'Erro ao iniciar atualização');
      toast.error(err.message || 'Erro ao iniciar atualização');
      return;
    }

    // Start polling task status
    activePollingRef.current = true;
    const pollInterval = setInterval(async () => {
      if (!activePollingRef.current) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const token = getAuthToken();
        const res = await fetch('/api/system/update/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store'
        });

        if (res.status === 404) {
          // Backend reiniciou antes do polling
          clearInterval(pollInterval);
          activePollingRef.current = false;
          setStatus('recreating');
          setProgress(92);
          startHealthCheckLoop(version);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.status) setStatus(data.status);
          if (typeof data.progress === 'number') {
            setProgress(prev => Math.max(prev, data.progress));
          }
          if (data.current_step) setCurrentStep(data.current_step);
          if (data.logs && data.logs.length > 0) setLogs(data.logs);
          if (data.error) setError(data.error);

          if (data.status === 'recreating') {
            clearInterval(pollInterval);
            activePollingRef.current = false;
            startHealthCheckLoop(version);
          } else if (data.status === 'done') {
            clearInterval(pollInterval);
            activePollingRef.current = false;
            startHealthCheckLoop(version);
          } else if (data.status === 'error') {
            clearInterval(pollInterval);
            activePollingRef.current = false;
            setIsUpdating(false);
          }
        }
      } catch {
        // Conexão caiu: contêiner antigo foi encerrado
        clearInterval(pollInterval);
        activePollingRef.current = false;
        setStatus('recreating');
        setProgress(prev => Math.max(prev, 90));
        setCurrentStep(t('system.restarting_container', 'Reiniciando contêiner do sistema...'));
        setLogs(prev => [
          ...prev,
          '🔄 Contêiner anterior encerrado com sucesso. Aplicando nova imagem...',
          '📡 Sondando disponibilidade da porta 5172...'
        ]);
        startHealthCheckLoop(version);
      }
    }, 1200);
  }, [t, startHealthCheckLoop]);

  return (
    <SystemUpdateContext.Provider
      value={{
        isUpdating,
        status,
        progress,
        currentStep,
        logs,
        error,
        targetVersion,
        isModalOpen,
        isMinimized,
        reconnectAttempts,
        startUpdate,
        minimize,
        maximize,
        openModal,
        closeModal,
        dismissSuccess
      }}
    >
      {children}
    </SystemUpdateContext.Provider>
  );
}

const defaultSystemUpdateContext: SystemUpdateContextType = {
  isUpdating: false,
  status: 'idle',
  progress: 0,
  currentStep: '',
  logs: [],
  error: null,
  targetVersion: '',
  isModalOpen: false,
  isMinimized: false,
  reconnectAttempts: 0,
  startUpdate: async () => {},
  minimize: () => {},
  maximize: () => {},
  openModal: () => {},
  closeModal: () => {},
  dismissSuccess: () => {},
};

export function useSystemUpdate() {
  const context = useContext(SystemUpdateContext);
  return context || defaultSystemUpdateContext;
}
