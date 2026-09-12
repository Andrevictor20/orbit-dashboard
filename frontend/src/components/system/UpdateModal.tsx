import { useState, useMemo, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { OrbitLogo } from '../ui/OrbitLogo';
import { isNewerVersion } from '../../utils/version';
import { parseReleaseNotes } from './releaseNotesParser';
import { UpdateProgressView, type UpdateTaskState } from './UpdateProgressView';
import { UpdateReleaseNotesView } from './UpdateReleaseNotesView';

export interface SystemUpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  platform: string;
  arch: string;
  release_name: string;
  release_notes: string;
  published_at?: string | null;
  ci_status?: 'building' | 'ready' | 'failed' | null;
  ci_workflow_url?: string | null;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: SystemUpdateInfo | null;
  onRefreshInfo: () => void;
}

export function UpdateModal({ isOpen, onClose, updateInfo, onRefreshInfo }: UpdateModalProps) {
  const [updating, setUpdating] = useState(false);
  const [taskState, setTaskState] = useState<UpdateTaskState>({
    status: 'idle',
    progress: 0,
    current_step: '',
    logs: [],
    error: null,
  });
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const hasNewVersion = Boolean(
    updateInfo?.has_update &&
    updateInfo?.latest_version &&
    updateInfo?.current_version &&
    isNewerVersion(updateInfo.latest_version, updateInfo.current_version)
  );

  // Auto-scroll terminal on new logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [taskState.logs]);

  // Auto-poll update info when image is still being built in GitHub Actions
  useEffect(() => {
    if (!isOpen || updating || updateInfo?.ci_status !== 'building') return;

    const interval = setInterval(() => {
      onRefreshInfo();
    }, 7000);

    return () => clearInterval(interval);
  }, [isOpen, updating, updateInfo?.ci_status, onRefreshInfo]);

  // Polling loop when updating
  useEffect(() => {
    if (!updating) return;

    let isSubscribed = true;
    let pollInterval: any = null;
    let healthInterval: any = null;

    const pollTaskStatus = async () => {
      try {
        const token = localStorage.getItem('orbit_token');
        const res = await fetch('/api/system/update/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.status === 404) {
          // Task might not have started or backend restarted already
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (!isSubscribed) return;

          setTaskState(prev => ({
            ...prev,
            status: data.status,
            progress: data.progress,
            current_step: data.current_step,
            logs: data.logs || prev.logs,
            error: data.error
          }));

          // When task enters 'recreating', container is restarting -> poll backend health
          if (data.status === 'recreating') {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
            startHealthCheckLoop();
          } else if (data.status === 'done') {
            if (pollInterval) clearInterval(pollInterval);
            toast.success('Orbit atualizado com sucesso!');
            setTimeout(() => {
              window.location.reload();
            }, 1800);
          } else if (data.status === 'error') {
            if (pollInterval) clearInterval(pollInterval);
            toast.error(data.error || 'Falha ao atualizar o sistema.');
          }
        }
      } catch {
        // Backend could be down while container recreates
      }
    };

    const startHealthCheckLoop = () => {
      let attempts = 0;
      healthInterval = setInterval(async () => {
        attempts++;
        if (!isSubscribed) return;
        setReconnectAttempts(attempts);

        try {
          const res = await fetch('/api/health', { cache: 'no-store' });
          if (res.ok) {
            const healthData = await res.json().catch(() => null);
            if (healthData?.version) {
              clearInterval(healthInterval);
              setTaskState(prev => ({
                ...prev,
                status: 'done',
                progress: 100,
                current_step: 'Atualização concluída com sucesso! Recarregando painel...',
                logs: [...prev.logs, `✔ Painel reconectado na nova versão ${healthData.version}.`]
              }));
              toast.success(`Orbit v${healthData.version} online!`);
              setTimeout(() => {
                window.location.reload();
              }, 1200);
            }
          }
        } catch {
          // Keep polling until online
        }

        if (attempts >= 45) {
          clearInterval(healthInterval);
          setTaskState(prev => ({
            ...prev,
            status: 'error',
            error: 'Tempo limite ao reconectar. Verifique os logs do Docker ou recarregue a página.'
          }));
        }
      }, 2000);
    };

    pollInterval = setInterval(pollTaskStatus, 1000);
    pollTaskStatus();

    return () => {
      isSubscribed = false;
      if (pollInterval) clearInterval(pollInterval);
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [updating, updateInfo]);

  // Clean Markdown & Bullet Parser for Release Notes
  const parsedSections = useMemo(
    () => parseReleaseNotes(updateInfo?.release_notes || ''),
    [updateInfo?.release_notes]
  );

  const handleStartUpdate = async () => {
    if (updateInfo?.ci_status === 'building') {
      toast.error('A imagem ainda está sendo compilada no GitHub Actions. Aguarde.');
      return;
    }

    if (!window.confirm(`Deseja iniciar a atualização do Orbit para v${updateInfo?.latest_version}? O painel reiniciará em instantes.`)) {
      return;
    }

    setUpdating(true);
    setTaskState({
      status: 'pulling',
      progress: 5,
      current_step: 'Iniciando download da imagem mais recente...',
      logs: ['[Orbit Update Agent] Inicializando atualização...', `[Target] ghcr.io:latest (v${updateInfo?.latest_version})`],
      error: null,
    });

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao acionar processo de atualização');
      }

      const data = await res.json();
      setTaskState(prev => ({
        ...prev,
        logs: [...prev.logs, `[Task ID: ${data.task_id}] Processo iniciado com sucesso.`]
      }));
    } catch (e: any) {
      setTaskState(prev => ({
        ...prev,
        status: 'error',
        error: e.message
      }));
      toast.error(e.message || 'Erro ao iniciar atualização.');
    }
  };

  const formatPlatformName = (platform: string, arch: string) => {
    if (platform.includes('arm64') || arch === 'aarch64') return 'ARM64 (Raspberry Pi / ARM)';
    if (platform.includes('arm')) return 'ARMv7 (Raspberry Pi 32-bit)';
    if (platform.includes('amd64') || arch === 'x86_64') return 'x86_64 / AMD64 (PC & Server)';
    return `${platform} (${arch})`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card/90 backdrop-blur-3xl saturate-[190%] border border-border/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-250 transition-all">
        
        {/* Top Header Card */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <OrbitLogo size={36} className="rounded-xl shadow-md shadow-orbit-500/10" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-primary leading-tight">
                  {updating ? 'Atualizando Orbit' : 'Atualização do Sistema'}
                </h2>
                {!updating && updateInfo?.ci_status === 'building' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>Compilando Imagem</span>
                  </span>
                )}
                {!updating && hasNewVersion && updateInfo?.ci_status !== 'building' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Nova Versão Disponível
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {updating 
                  ? (taskState.current_step || 'Processando download e reinicialização segura...')
                  : 'Gerenciamento de versão e resumo das melhorias'
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={updating && taskState.status !== 'error'}
            className="p-1.5 text-slate-700 dark:text-secondary hover:text-primary rounded-xl hover:bg-accent transition-colors disabled:opacity-30"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background/40">
          {!updating ? (
            <UpdateReleaseNotesView
              updateInfo={updateInfo}
              hasNewVersion={hasNewVersion}
              onRefreshInfo={onRefreshInfo}
              formatPlatformName={formatPlatformName}
              parsedSections={parsedSections}
            />
          ) : (
            <UpdateProgressView
              taskState={taskState}
              reconnectAttempts={reconnectAttempts}
              terminalEndRef={terminalEndRef}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-5 border-t border-border/80 bg-card flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={updating && taskState.status !== 'error'}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-secondary hover:text-primary hover:bg-accent transition-colors disabled:opacity-30"
          >
            Fechar
          </button>

          {!updating && (
            updateInfo?.ci_status === 'building' ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-not-allowed opacity-80"
                title="A imagem Docker multi-arch está sendo gerada no GitHub. O botão será liberado automaticamente."
              >
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>Compilando Imagem no GitHub...</span>
              </button>
            ) : !hasNewVersion ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border/80 text-slate-700 dark:text-secondary text-xs font-semibold cursor-default opacity-80"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Sistema na Versão Mais Recente</span>
              </button>
            ) : (
              <button
                onClick={handleStartUpdate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-orbit-500/25 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Atualizar para v{updateInfo?.latest_version}</span>
              </button>
            )
          )}
        </div>

      </div>
    </div>
  );
}

export default UpdateModal;
