import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  Cpu, 
  GitBranch, 
  Clock, 
  Bug, 
  Zap, 
  Shield, 
  FileCode2, 
  Wrench, 
  Terminal, 
  AlertTriangle, 
  History, 
  List, 
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

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

interface ParsedChangelogEntry {
  category: 'feat' | 'fix' | 'perf' | 'sec' | 'refactor' | 'docs' | 'update';
  badgeLabel: string;
  badgeClass: string;
  icon: any;
  title: string;
  bullets: string[];
}

interface UpdateTaskState {
  status: 'idle' | 'pulling' | 'recreating' | 'done' | 'error';
  progress: number;
  current_step: string;
  logs: string[];
  error?: string | null;
}

export function UpdateModal({ isOpen, onClose, updateInfo, onRefreshInfo }: UpdateModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'pt').toLowerCase();
  const isPt = currentLang.startsWith('pt');

  const [activeTab, setActiveTab] = useState<'whatsnew' | 'history'>(updateInfo?.has_update ? 'whatsnew' : 'history');
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

  useEffect(() => {
    if (updateInfo) {
      setActiveTab(updateInfo.has_update ? 'whatsnew' : 'history');
    }
  }, [updateInfo?.has_update]);

  // Auto-scroll terminal on new logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [taskState.logs]);

  // Polling loop when updating
  useEffect(() => {
    if (!updating) return;

    let isSubscribed = true;
    let pollInterval: any = null;
    let healthInterval: any = null;

    const startHealthPolling = () => {
      let attempts = 0;
      healthInterval = setInterval(async () => {
        attempts++;
        if (isSubscribed) setReconnectAttempts(attempts);

        try {
          const health = await fetch('/health');
          if (health.ok) {
            clearInterval(healthInterval);
            if (isSubscribed) {
              const targetVersion = updateInfo?.latest_version || updateInfo?.current_version || '1.9.7';
              localStorage.setItem('orbit_last_updated_version', targetVersion);
              localStorage.removeItem('orbit_token');

              setTaskState(prev => ({
                ...prev,
                status: 'done',
                progress: 100,
                current_step: t('update_modal.update_success', 'Orbit atualizado com sucesso! Redirecionando para o login...'),
                logs: [
                  ...prev.logs, 
                  '🎉 [SUCCESS] Novo container ativo e respondendo na porta 5172!',
                  '🚀 [REDIRECT] Redirecionando para a tela de login...'
                ]
              }));

              toast.success(t('update_modal.update_success', 'Orbit atualizado com sucesso! Redirecionando para o login...'));
              
              setTimeout(() => {
                window.location.href = `/login?updated=true&version=${encodeURIComponent(targetVersion)}`;
              }, 1200);
            }
          }
        } catch {
          // Expected while container restarts
        }

        if (attempts > 45) {
          clearInterval(healthInterval);
          if (isSubscribed) {
            setTaskState(prev => ({
              ...prev,
              status: 'error',
              error: t('update_modal.restarting_manual', 'Tempo limite atingido. Atualize a página manualmente.')
            }));
            setUpdating(false);
          }
        }
      }, 1500);
    };

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('orbit_token');
        const res = await fetch('/api/system/update/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.ok) {
          const data: UpdateTaskState = await res.json();
          if (isSubscribed) {
            setTaskState(data);

            if (data.status === 'recreating') {
              clearInterval(pollInterval);
              startHealthPolling();
            } else if (data.status === 'error') {
              clearInterval(pollInterval);
              setUpdating(false);
              toast.error(data.error || 'Erro durante a atualização.');
            }
          }
        }
      } catch {
        if (taskState.status === 'recreating' || taskState.progress >= 80) {
          clearInterval(pollInterval);
          startHealthPolling();
        }
      }
    };

    pollInterval = setInterval(pollStatus, 800);

    return () => {
      isSubscribed = false;
      if (pollInterval) clearInterval(pollInterval);
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [updating, updateInfo, t]);

  // Contextual Rich Changelog Engine
  const parsedChangelog = useMemo<ParsedChangelogEntry[]>(() => {
    const raw = updateInfo?.release_notes || '';
    if (!raw.trim()) return [];

    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('Últimas alterações') && !l.startsWith('Latest repository changes') && !l.startsWith('## What\'s Changed'));

    if (lines.length === 0) return [];

    // Contextual explanation database with translations
    const explainContext = (text: string): { title: string; bullets: string[]; category: 'feat' | 'fix' | 'perf' | 'sec' | 'refactor' | 'docs' | 'update' } => {
      const lower = text.toLowerCase();

      if (lower.includes('docker run') || lower.includes('docker compose') || lower.includes('port conflict') || lower.includes('conflict_confirm')) {
        if (isPt) {
          return {
            category: 'feat',
            title: 'Instalação com 1-Clique: Docker Run e Compose',
            bullets: [
              'Cole qualquer comando `docker run` ou arquivo `docker-compose.yml` para instalar o contêiner automaticamente.',
              'Detecção inteligente de portas ocupadas com modal interativo para remapeamento rápido.'
            ]
          };
        } else if (currentLang.startsWith('es')) {
          return {
            category: 'feat',
            title: 'Instalación en 1 Clic: Docker Run y Compose',
            bullets: [
              'Pegue comandos `docker run` o compose para instalar contenedores automáticamente.',
              'Detección inteligente de conflictos de puertos con reasignación en tiempo real.'
            ]
          };
        } else {
          return {
            category: 'feat',
            title: '1-Click App Installer: Docker Run & Compose',
            bullets: [
              'Paste any `docker run` command or `docker-compose.yml` file to automate deployment.',
              'Automatic host port conflict detection with interactive resolution modal.'
            ]
          };
        }
      }

      if (lower.includes('htop') || lower.includes('cpu') || lower.includes('telemetria') || lower.includes('tailscale') || lower.includes('process monitor')) {
        if (isPt) {
          return {
            category: 'perf',
            title: 'Telemetria e Monitoramento Preciso de CPU (Estilo htop)',
            bullets: [
              'Cálculo instantâneo de uso de CPU com amostragem delta proporcional aos núcleos do processador.',
              'Eliminação de picos falsos de 100% em processos em background (ex: Tailscale, Docker daemon).'
            ]
          };
        } else if (currentLang.startsWith('es')) {
          return {
            category: 'perf',
            title: 'Telemetría y Monitor de CPU Preciso (Estilo htop)',
            bullets: [
              'Cálculo instantáneo de CPU mediante muestreo delta proporcional a los núcleos.',
              'Eliminación de falsos picos del 100% en servicios en segundo plano (Tailscale, etc).'
            ]
          };
        } else {
          return {
            category: 'perf',
            title: 'Accurate CPU & Process Telemetry (htop style)',
            bullets: [
              'Instant delta CPU calculation proportional to system core count.',
              'Eliminated false 100% CPU readings on continuous background processes.'
            ]
          };
        }
      }

      if (lower.includes('traduz') || lower.includes('lingua') || lower.includes('i18n') || lower.includes('locale') || lower.includes('language')) {
        if (isPt) {
          return {
            category: 'feat',
            title: 'Internacionalização Completa em 11 Idiomas',
            bullets: [
              'Suporte nativo a Português, Inglês, Espanhol, Francês, Alemão, Italiano, Japonês, Chinês, Russo e Coreano.',
              'Tradução integral de todas as telas, modais, alertas e mensagens do sistema.'
            ]
          };
        } else if (currentLang.startsWith('es')) {
          return {
            category: 'feat',
            title: 'Internacionalización Completa en 11 Idiomas',
            bullets: [
              'Soporte nativo para 11 idiomas con selector dinámico en el encabezado.',
              'Traducción total de interfaces, modales y mensajes del sistema.'
            ]
          };
        } else {
          return {
            category: 'feat',
            title: 'Full Internationalization Across 11 Languages',
            bullets: [
              'Native support for English, Portuguese, Spanish, French, German, Italian, Japanese, Chinese, Russian, and Korean.',
              '100% UI coverage across all dashboard modules, modals, and notifications.'
            ]
          };
        }
      }

      if (lower.includes('terminal') || lower.includes('ssh') || lower.includes('host-gateway') || lower.includes('pty')) {
        if (isPt) {
          return {
            category: 'fix',
            title: 'Terminal Web e Acesso SSH Resiliente',
            bullets: [
              'Descoberta automática do gateway Docker host (`host.docker.internal`).',
              'Sincronização dinâmica de buffer PTY e suporte integrado a copiar/colar.'
            ]
          };
        } else {
          return {
            category: 'fix',
            title: 'Web Terminal & Resilient SSH Connection',
            bullets: [
              'Automatic Docker host gateway discovery (`host.docker.internal`).',
              'Smooth PTY buffer synchronization and clipboard paste support.'
            ]
          };
        }
      }

      if (lower.includes('update') || lower.includes('atualiz') || lower.includes('restart loop') || lower.includes('graceful shutdown')) {
        if (isPt) {
          return {
            category: 'fix',
            title: 'Auto-Atualizador Seguro com Redirecionamento ao Login',
            bullets: [
              'Helper desacoplado via socket Docker com verificação de integridade no endpoint `/health`.',
              'Encerramento seguro de sessão e redirecionamento automático para a tela de login após atualizar.'
            ]
          };
        } else {
          return {
            category: 'fix',
            title: 'Robust Self-Updater & Post-Update Login Redirect',
            bullets: [
              'Detached transient updater container with proactive health check polling.',
              'Clean session invalidation and automatic redirection to login page upon success.'
            ]
          };
        }
      }

      // Default fallback formatting
      let cleanTitle = text.replace(/^[-*•]\s*/, '').trim();
      let category: ParsedChangelogEntry['category'] = 'update';

      if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('corrig')) {
        category = 'fix';
      } else if (lower.includes('sec') || lower.includes('guard') || lower.includes('auth')) {
        category = 'sec';
      } else if (lower.includes('perf') || lower.includes('optimiz') || lower.includes('speed')) {
        category = 'perf';
      } else if (lower.includes('feat') || lower.includes('add') || lower.includes('new') || lower.includes('nov')) {
        category = 'feat';
      } else if (lower.includes('refactor') || lower.includes('clean') || lower.includes('lint')) {
        category = 'refactor';
      } else if (lower.includes('doc') || lower.includes('readme')) {
        category = 'docs';
      }

      cleanTitle = cleanTitle.replace(/^(feat|fix|perf|refactor|docs|chore|ci)(\(.*?\))?:\s*/i, '');

      return {
        category,
        title: cleanTitle,
        bullets: []
      };
    };

    const getBadgeInfo = (cat: ParsedChangelogEntry['category']) => {
      switch (cat) {
        case 'fix':
          return { label: t('update_modal.badge_fix', 'Correção'), class: 'bg-rose-500/15 text-rose-400 border-rose-500/30', icon: Bug };
        case 'sec':
          return { label: t('update_modal.badge_sec', 'Segurança'), class: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Shield };
        case 'perf':
          return { label: t('update_modal.badge_perf', 'Performance'), class: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', icon: Zap };
        case 'feat':
          return { label: t('update_modal.badge_feat', 'Novidade'), class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: Sparkles };
        case 'refactor':
          return { label: t('update_modal.badge_refactor', 'Melhoria'), class: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: Wrench };
        case 'docs':
          return { label: t('update_modal.badge_docs', 'Docs'), class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: FileCode2 };
        default:
          return { label: t('update_modal.badge_update', 'Atualização'), class: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Sparkles };
      }
    };

    const entries: ParsedChangelogEntry[] = [];
    for (const line of lines) {
      const exp = explainContext(line);
      const badge = getBadgeInfo(exp.category);
      
      // Avoid duplicate title cards
      if (!entries.some(e => e.title.toLowerCase() === exp.title.toLowerCase())) {
        entries.push({
          category: exp.category,
          badgeLabel: badge.label,
          badgeClass: badge.class,
          icon: badge.icon,
          title: exp.title,
          bullets: exp.bullets
        });
      }
    }

    return entries;
  }, [updateInfo?.release_notes, isPt, currentLang, t]);

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    const confirmText = t(
      'update_modal.confirm_update_msg', 
      'Deseja iniciar a atualização do Orbit agora? O progresso e os logs detalhados serão exibidos em tempo real. Ao concluir, você será redirecionado para a tela de login.'
    );

    if (!window.confirm(confirmText)) {
      return;
    }

    setUpdating(true);
    setTaskState({
      status: 'pulling',
      progress: 10,
      current_step: isPt ? 'Iniciando verificação e download...' : 'Starting verification and download...',
      logs: [
        '🚀 [INFO] Conectando ao backend e iniciando tarefa de atualização...',
        '📥 [PULL] Baixando imagem do GitHub Container Registry (ghcr.io/andrevictor20/orbit-dashboard:latest)...'
      ],
      error: null,
    });

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      toast.success(isPt ? 'Download da imagem iniciado!' : 'Image download started!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error starting update');
      setUpdating(false);
    }
  };

  const formatPlatformName = (platform: string, arch: string) => {
    if (platform.includes('arm64') || arch === 'aarch64') return 'ARM64 (Raspberry Pi / ARM)';
    if (platform.includes('arm')) return 'ARMv7 (Raspberry Pi 32-bit)';
    if (platform.includes('amd64') || arch === 'x86_64') return 'x86_64 / AMD64 (PC & Server)';
    return `${platform} (${arch})`;
  };

  const getLogLineClass = (line: string) => {
    if (line.includes('[SUCCESS]') || line.includes('✅') || line.includes('🎉')) return 'text-emerald-400 font-semibold';
    if (line.includes('[WARN]') || line.includes('⚠️')) return 'text-amber-400';
    if (line.includes('[ERROR]') || line.includes('❌')) return 'text-rose-400 font-semibold';
    if (line.includes('[PULL]') || line.includes('📥')) return 'text-cyan-300';
    if (line.includes('[RESTART]') || line.includes('🔄') || line.includes('⚙️')) return 'text-yellow-300';
    if (line.includes('[CONFIG]') || line.includes('📁')) return 'text-indigo-300';
    return 'text-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-gradient-to-r from-orbit-950/40 via-card to-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orbit-500/10 border border-orbit-500/20 text-orbit-400">
              {updating ? <Terminal className="w-5 h-5 animate-pulse text-cyan-400" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                {updating ? t('update_modal.update_in_progress', 'Atualização em Tempo Real') : t('update_modal.title', 'Atualização do Orbit')}
                {!updating && updateInfo?.ci_status === 'building' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/35 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                    <span>{t('update_modal.ci_building_badge', 'Compilando Imagem (CI/CD)')}</span>
                  </span>
                )}
                {!updating && updateInfo?.ci_status === 'failed' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/35 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                    <span>{t('update_modal.build_failed', 'Falha no Build')}</span>
                  </span>
                )}
                {!updating && updateInfo?.has_update && updateInfo?.ci_status !== 'building' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {t('update_modal.available', 'Disponível')}
                  </span>
                )}
                {updating && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                    {taskState.status === 'recreating' ? (isPt ? 'Reiniciando' : 'Restarting') : (isPt ? 'Ao Vivo' : 'Live')}
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                {updating 
                  ? (taskState.current_step || (isPt ? 'Processando atualização...' : 'Processing update...'))
                  : updateInfo?.ci_status === 'building'
                  ? (isPt ? 'Novo commit em compilação no GitHub Actions' : 'New commit is building on GitHub Actions')
                  : t('update_modal.subtitle', 'Gerenciamento e implantação sob demanda')
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={updating && taskState.status !== 'error'}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
            aria-label={t('update_modal.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background/50">
          {!updating ? (
            <>
              {/* Top Details */}
              <div className="p-5 pb-0 space-y-4">
                {/* CI/CD Building Alert Banner */}
                {updateInfo?.ci_status === 'building' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-200">
                    <div className="flex items-start gap-2.5">
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white">
                          {isPt ? 'Build Multi-Arch em Andamento no GitHub Actions' : 'Multi-Arch Build in Progress'}
                        </p>
                        <p className="text-[11.5px] text-amber-200/80 mt-0.5">
                          {t('update_modal.ci_building_tooltip', 'A nova versão está sendo compilada no GitHub Actions. Aguarde a finalização do build para atualizar com segurança.')}
                        </p>
                      </div>
                    </div>
                    {updateInfo.ci_workflow_url && (
                      <a
                        href={updateInfo.ci_workflow_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <span>{t('update_modal.view_build_ci', 'Ver CI/CD')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-accent/40 border border-border/60 text-xs">
                  <div className="flex items-center gap-1.5 text-primary font-medium">
                    <Cpu className="w-4 h-4 text-orbit-400" />
                    <span>{t('update_modal.architecture', 'Arquitetura')}:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 font-semibold text-secondary">
                      {updateInfo ? formatPlatformName(updateInfo.platform, updateInfo.arch) : 'Detectando...'}
                    </span>
                  </div>

                  {updateInfo?.published_at && (
                    <div className="flex items-center gap-1 text-secondary ml-auto">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(updateInfo.published_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border/80 flex flex-col justify-between">
                    <span className="text-xs text-secondary font-medium">{t('update_modal.installed_version', 'Versão Instalada')}</span>
                    <span className="text-lg font-bold text-white mt-1 tabular-nums">
                      v{updateInfo?.current_version || '1.9.7'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('update_modal.active_installation', 'Instalação Ativa')}</span>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    updateInfo?.has_update 
                      ? 'bg-orbit-500/10 border-orbit-500/30' 
                      : 'bg-card border-border/80'
                  }`}>
                    <span className="text-xs text-secondary font-medium">{t('update_modal.latest_github', 'Mais Recente no GitHub')}</span>
                    <span className={`text-lg font-bold mt-1 tabular-nums ${
                      updateInfo?.has_update ? 'text-orbit-300' : 'text-white'
                    }`}>
                      v{updateInfo?.latest_version || updateInfo?.current_version || '1.9.7'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-secondary mt-1">
                      <GitBranch className="w-3.5 h-3.5 text-orbit-400" />
                      <span className="truncate">ghcr.io :latest</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/50 px-5 pt-5 gap-6">
                <button
                  onClick={() => setActiveTab('whatsnew')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative ${activeTab === 'whatsnew' ? 'text-orbit-400' : 'text-secondary hover:text-primary'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  {t('update_modal.tab_whats_new', 'O que há de novo / corrigido')}
                  {activeTab === 'whatsnew' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-orbit-500 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative ${activeTab === 'history' ? 'text-orbit-400' : 'text-secondary hover:text-primary'}`}
                >
                  <History className="w-3.5 h-3.5" />
                  {t('update_modal.tab_history', 'Histórico de atualizações')}
                  {activeTab === 'history' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-orbit-500 rounded-t-full" />
                  )}
                </button>
                
                <button 
                  onClick={onRefreshInfo}
                  className="ml-auto text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md mb-2 active:scale-95"
                  title={t('update_modal.refresh', 'Verificar')}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('update_modal.refresh', 'Verificar')}</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-5 overflow-y-auto flex-1">
                {activeTab === 'whatsnew' && (
                  <div className="animate-in fade-in duration-200 h-full">
                    {updateInfo?.has_update && parsedChangelog.length > 0 ? (
                      <div className="space-y-3 pr-1">
                        {parsedChangelog.map((entry, idx) => {
                          const Icon = entry.icon;
                          return (
                            <div 
                              key={idx} 
                              className="p-3.5 rounded-xl bg-card/70 border border-border/80 hover:border-border transition-all space-y-2"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border shrink-0 mt-0.5 ${entry.badgeClass}`}>
                                  <Icon className="w-3 h-3" />
                                  <span>[{entry.badgeLabel}]</span>
                                </span>
                                <p className="text-[13px] font-semibold text-primary leading-snug">
                                  {entry.title}
                                </p>
                              </div>

                              {entry.bullets.length > 0 && (
                                <ul className="space-y-1.5 pl-7 pt-1 border-l-2 border-border/50 ml-3">
                                  {entry.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx} className="text-[11.5px] text-secondary leading-relaxed">
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8 rounded-xl bg-card/30 border border-border/40 border-dashed text-secondary text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-1" />
                        <p className="text-sm font-semibold text-primary">{t('update_modal.system_up_to_date', 'Sistema Atualizado')}</p>
                        <p className="text-xs">{t('update_modal.system_up_to_date_msg', 'Você já possui a versão mais recente instalada. Nenhuma atualização pendente.')}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="animate-in fade-in duration-200 h-full">
                    {parsedChangelog.length > 0 ? (
                      <div className="space-y-3 pr-1">
                        {parsedChangelog.map((entry, idx) => {
                          const Icon = entry.icon;
                          return (
                            <div 
                              key={idx} 
                              className="p-3.5 rounded-xl bg-card/70 border border-border/80 hover:border-border transition-all space-y-2 opacity-85 hover:opacity-100"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border shrink-0 mt-0.5 ${entry.badgeClass}`}>
                                  <Icon className="w-3 h-3" />
                                  <span>[{entry.badgeLabel}]</span>
                                </span>
                                <p className="text-[13px] font-semibold text-primary leading-snug">
                                  {entry.title}
                                </p>
                              </div>

                              {entry.bullets.length > 0 && (
                                <ul className="space-y-1.5 pl-7 pt-1 border-l-2 border-border/50 ml-3">
                                  {entry.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx} className="text-[11.5px] text-secondary leading-relaxed">
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8 rounded-xl bg-card/30 border border-border/40 border-dashed text-secondary text-center space-y-3">
                        <GitBranch className="w-8 h-8 text-orbit-500/50 mb-1" />
                        <p className="text-xs max-w-[250px]">{t('update_modal.no_notes', 'Nenhuma nota de versão disponível no momento.')}</p>
                        <a href="https://github.com/Andrevictor20/orbit-dashboard/commits/main" target="_blank" rel="noreferrer" className="text-xs font-semibold text-orbit-400 hover:text-orbit-300 hover:underline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-500/10 transition-colors">
                          <History className="w-3.5 h-3.5" />
                          {t('update_modal.view_full_history', 'Ver Histórico Completo')}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-2 p-3.5 rounded-xl bg-accent/40 border border-border/60">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-white flex items-center gap-2">
                      {taskState.status === 'recreating' ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <Download className="w-4 h-4 text-cyan-400 animate-bounce" />
                      )}
                      {taskState.current_step || (isPt ? 'Executando atualização...' : 'Executing update...')}
                    </span>
                    <span className="text-orbit-400 font-mono text-xs tabular-nums">
                      {taskState.progress}%
                    </span>
                  </div>

                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-border/50">
                    <div 
                      className="bg-gradient-to-r from-orbit-600 via-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(taskState.progress, 5)}%` }}
                    />
                  </div>

                  {taskState.status === 'recreating' && (
                    <div className="flex items-center justify-between text-[11px] text-secondary pt-1">
                      <span>{t('update_modal.reconnecting_attempt', 'Tentativa de reconexão')}:</span>
                      <span className="font-mono text-orbit-300">{reconnectAttempts} / 45</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-black/90 border border-slate-800/80 p-3.5 font-mono text-[11px] leading-relaxed shadow-inner overflow-hidden">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      <span>ORBIT UPDATE LOG STREAM</span>
                    </span>
                    <span>{taskState.logs.length} {isPt ? 'linhas' : 'lines'}</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 select-text scrollbar-thin">
                    {taskState.logs.map((log, idx) => (
                      <div key={idx} className={getLogLineClass(log)}>
                        {log}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

                {taskState.error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <span className="font-bold">{isPt ? 'Falha na Atualização: ' : 'Update Failed: '}</span>
                      <span>{taskState.error}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-accent/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={updating && taskState.status !== 'error'}
            className="px-4 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors disabled:opacity-30"
          >
            {t('update_modal.close', 'Fechar')}
          </button>

          {!updating ? (
            updateInfo?.ci_status === 'building' ? (
              <div className="flex items-center gap-2">
                {updateInfo.ci_workflow_url && (
                  <a
                    href={updateInfo.ci_workflow_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <span>{t('update_modal.view_build_ci', 'Ver CI/CD')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  disabled
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500/20 text-amber-300/60 border border-amber-500/30 cursor-not-allowed flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('update_modal.ci_building_badge', 'Compilando Imagem (CI/CD)')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartUpdate}
                disabled={!updateInfo}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95 ${
                  updateInfo?.has_update
                    ? 'bg-orbit-500 hover:bg-orbit-400 text-white shadow-orbit-500/20'
                    : 'bg-accent text-secondary hover:text-primary hover:bg-accent/80'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {updateInfo?.has_update 
                    ? t('update_modal.update_now', 'Atualizar Orbit Agora')
                    : t('update_modal.reinstall_force', 'Reinstalar / Forçar Atualização')
                  }
                </span>
              </button>
            )
          ) : (
            <span className="text-xs text-secondary italic">
              {taskState.status === 'recreating' 
                ? (isPt ? 'Aguardando reinício do contêiner...' : 'Waiting for container restart...')
                : (isPt ? 'Atualização em andamento...' : 'Update in progress...')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
