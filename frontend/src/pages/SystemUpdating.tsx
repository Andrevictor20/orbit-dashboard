import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Terminal, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { SaturnLogo } from '../components/ui/SaturnLogo';

export interface SystemUpdateTaskState {
  status: 'idle' | 'pulling' | 'recreating' | 'done' | 'error';
  progress: number;
  current_step: string;
  logs: string[];
  error?: string | null;
}

export function SystemUpdating() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetVersion = searchParams.get('version') || localStorage.getItem('saturn_target_version') || '';

  const [taskState, setTaskState] = useState<SystemUpdateTaskState>({
    status: 'pulling',
    progress: 10,
    current_step: t('system.starting_download', 'Iniciando verificação e download da nova imagem...'),
    logs: [
      '[Saturn Update Agent] Inicializando atualização transparente do contêiner...',
      targetVersion ? `[Target] ghcr.io/andrevmp/saturn:v${targetVersion.replace(/^v/, '')}` : '[Target] ghcr.io/andrevmp/saturn:latest'
    ],
    error: null,
  });

  const [showLogs, setShowLogs] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSuccessConfirmed, setIsSuccessConfirmed] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal on new logs
  useEffect(() => {
    if (showLogs && typeof terminalEndRef.current?.scrollIntoView === 'function') {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskState.logs, showLogs]);

  // Main polling & health check lifecycle
  useEffect(() => {
    let isSubscribed = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let healthInterval: ReturnType<typeof setInterval> | null = null;
    let isCheckingHealth = false;
    let attempts = 0;

    const startHealthCheckLoop = () => {
      if (healthInterval) return;

      const pingHealth = async () => {
        if (isCheckingHealth || !isSubscribed) return;
        isCheckingHealth = true;
        attempts++;
        setReconnectAttempts(attempts);

        try {
          // 1. Tenta /api/health
          let res = await fetch('/api/health', { cache: 'no-store' });
          let isHtml = res.headers.get('content-type')?.includes('text/html');

          // Fallback para /health caso /api/health retorne HTML ou 404
          if (!res.ok || isHtml) {
            res = await fetch('/health', { cache: 'no-store' });
            isHtml = res.headers.get('content-type')?.includes('text/html');
          }

          if (res.ok && !isHtml) {
            const healthData = await res.json().catch(() => null);
            if (healthData && (healthData.status === 'ok' || healthData.version)) {
              const onlineVersion = healthData.version || targetVersion || '';

              if (healthInterval) clearInterval(healthInterval);
              healthInterval = null;

              setTaskState(prev => ({
                ...prev,
                status: 'done',
                progress: 100,
                current_step: t('system.update_complete_reloading', 'Atualização concluída com sucesso! Redirecionando para login...'),
                logs: [
                  ...prev.logs,
                  `✅ [SUCESSO] Novo contêiner verificado e operacional (Saturn ${onlineVersion ? `v${onlineVersion}` : ''}).`,
                  `🔒 [SESSÃO] Redirecionando com segurança para a tela de login...`
                ]
              }));

              setIsSuccessConfirmed(true);

              // Limpa flags residuais de atualização
              localStorage.removeItem('saturn_updating');
              localStorage.removeItem('saturn_target_version');
              localStorage.removeItem('saturn_token'); // Força login limpo com novo token
              if (onlineVersion) {
                localStorage.setItem('saturn_last_updated_version', onlineVersion);
              }

              // Delay intencional de 1.8s para visualização da confirmação verde de 100%
              setTimeout(() => {
                if (isSubscribed) {
                  navigate(`/login?updated=true&version=${encodeURIComponent(onlineVersion)}`, { replace: true });
                }
              }, 1800);
              return;
            }
          }
        } catch {
          // Contêiner ainda desligado ou reiniciando via helper script
        } finally {
          isCheckingHealth = false;
        }

        if (attempts >= 60) {
          if (healthInterval) clearInterval(healthInterval);
          healthInterval = null;
          setTaskState(prev => ({
            ...prev,
            status: 'error',
            error: t('system.timeout_reconnecting', 'Tempo limite ao reconectar. Verifique os logs do Docker ou tente recarregar a página.')
          }));
        }
      };

      healthInterval = setInterval(pingHealth, 1000);
      pingHealth();
    };

    const pollTaskStatus = async () => {
      try {
        const token = localStorage.getItem('saturn_token');
        const res = await fetch('/api/system/update/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store'
        });

        if (res.status === 404) {
          // Backend reiniciou antes do polling
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
          startHealthCheckLoop();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (!isSubscribed) return;

          setTaskState(prev => ({
            ...prev,
            status: data.status,
            progress: Math.max(prev.progress, data.progress),
            current_step: data.current_step || prev.current_step,
            logs: data.logs && data.logs.length > 0 ? data.logs : prev.logs,
            error: data.error
          }));

          if (data.status === 'recreating') {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
            startHealthCheckLoop();
          } else if (data.status === 'done') {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
            startHealthCheckLoop();
          } else if (data.status === 'error') {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch {
        // Queda esperada de conexão quando o contêiner antigo é desligado
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        setTaskState(prev => ({
          ...prev,
          status: 'recreating',
          progress: Math.max(prev.progress, 90),
          current_step: t('system.restarting_container', 'Reiniciando contêiner do sistema...'),
          logs: [
            ...prev.logs,
            '🔄 [DOCKER] O contêiner anterior foi encerrado. O novo contêiner Saturn está sendo inicializado...',
            '📡 [REDE] Sondando disponibilidade da porta 5172...'
          ]
        }));
        startHealthCheckLoop();
      }
    };

    pollInterval = setInterval(pollTaskStatus, 1000);
    pollTaskStatus();

    return () => {
      isSubscribed = false;
      if (pollInterval) clearInterval(pollInterval);
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [navigate, targetVersion, t]);

  return (
    <div className="min-h-screen bg-bg text-primary flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background Ambience / Cosmic Rings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] bg-saturn-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6 animate-slide-up">
        {/* Logo & Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-3.5 rounded-3xl bg-card/80 border border-border/80 shadow-2xl backdrop-blur-xl relative">
              <SaturnLogo
                size={52}
                className={isSuccessConfirmed ? 'text-emerald-500 transition-colors duration-500' : 'animate-pulse text-saturn-500'}
              />
              {isSuccessConfirmed && (
                <div className="absolute -top-1 -right-1 p-1 rounded-full bg-emerald-500 text-white shadow-lg animate-scale-in">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center justify-center gap-2">
              {isSuccessConfirmed ? t('system.update_ready_title', 'Saturn Atualizado!') : t('system.updating_title', 'Atualizando o Saturn')}
              {targetVersion && (
                <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-saturn-500/15 text-saturn-500 border border-saturn-500/30">
                  v{targetVersion.replace(/^v/, '')}
                </span>
              )}
            </h1>
            <p className="text-xs text-secondary mt-1">
              {isSuccessConfirmed
                ? t('system.update_ready_subtitle', 'Novo contêiner operacional. Preparando tela de login...')
                : t('system.updating_subtitle', 'Aplicando nova imagem e inicializando serviços do contêiner')}
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-card/90 backdrop-blur-xl py-6 px-5 sm:px-7 shadow-2xl rounded-2xl border border-border/80 space-y-5">
          {/* Progress Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-primary flex items-center gap-2">
                {isSuccessConfirmed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : taskState.status === 'recreating' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Download className="w-4 h-4 text-saturn-500 animate-bounce" />
                )}
                <span className="line-clamp-1">{taskState.current_step}</span>
              </span>
              <span className={`font-mono text-xs tabular-nums font-bold ${isSuccessConfirmed ? 'text-emerald-500' : 'text-saturn-500'}`}>
                {taskState.progress}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden border border-border/60">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isSuccessConfirmed
                    ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-saturn-500 shadow-[0_0_10px_rgba(var(--saturn-500-rgb),0.3)]'
                }`}
                style={{ width: `${Math.max(taskState.progress, 6)}%` }}
              />
            </div>

            {/* Reconnection Status indicator */}
            {taskState.status === 'recreating' && !isSuccessConfirmed && (
              <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
                <span>{t('system.reconnection_attempt', 'Tentativa de reconexão:')}</span>
                <span className="font-mono text-amber-500 font-bold">
                  {reconnectAttempts}/60
                </span>
              </div>
            )}
          </div>

          {/* Expandable Terminal Logs */}
          <div className="pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => setShowLogs(prev => !prev)}
              className="w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-medium text-secondary hover:text-primary hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-saturn-400" />
                <span>{t('system.view_realtime_logs', 'Logs do contêiner em tempo real')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500 font-mono text-[10px]">
                  {taskState.logs.length} linhas
                </span>
                {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showLogs && (
              <div className="mt-2 rounded-xl bg-neutral-950 border border-border/80 overflow-hidden font-mono text-xs shadow-inner animate-in fade-in duration-200">
                <div className="px-3 py-1.5 bg-neutral-900 border-b border-border/60 flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Docker Service / Container Stream</span>
                  <span className="text-emerald-400 font-mono">LIVE</span>
                </div>
                <div className="p-3 max-h-56 overflow-y-auto space-y-1 scrollbar-thin text-[11px] text-zinc-300 select-text">
                  {taskState.logs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed font-mono whitespace-pre-wrap break-all">
                      {log}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {taskState.error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2.5 font-medium animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="leading-tight">{taskState.error}</span>
            </div>
          )}
        </div>

        {/* Subtle Footer Note */}
        <p className="text-[11px] text-center text-secondary/70">
          {t('system.update_wait_notice', 'Por favor, não reinicie o host nem feche a aba durante a atualização do Docker.')}
        </p>
      </div>
    </div>
  );
}
