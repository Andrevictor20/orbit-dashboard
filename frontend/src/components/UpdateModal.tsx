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
  ShieldCheck,
  Bug,
  Zap,
  Shield,
  FileCode2,
  Wrench,
  Terminal,
  AlertTriangle
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
  const isPt = (i18n.language || 'pt').toLowerCase().startsWith('pt');

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
              // Switch to health check polling
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
        // Backend might be restarting
        if (taskState.status === 'recreating' || taskState.progress >= 80) {
          clearInterval(pollInterval);
          startHealthPolling();
        }
      }
    };

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
              setTaskState(prev => ({
                ...prev,
                status: 'done',
                progress: 100,
                current_step: isPt ? 'Orbit atualizado com sucesso!' : 'Orbit updated successfully!',
                logs: [...prev.logs, isPt ? '🎉 [SUCCESS] Novo container ativo e respondendo na porta 5172! Recarregando...' : '🎉 [SUCCESS] New container active and healthy! Reloading...']
              }));
              toast.success(isPt ? 'Orbit atualizado e ativo!' : 'Orbit updated and active!');
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          }
        } catch {
          // Expected while restarting
        }

        if (attempts > 45) {
          clearInterval(healthInterval);
          if (isSubscribed) {
            setTaskState(prev => ({
              ...prev,
              status: 'error',
              error: isPt ? 'Tempo limite de reconexão atingido. Atualize a página manualmente.' : 'Reconnection timeout. Please refresh manually.'
            }));
            setUpdating(false);
          }
        }
      }, 1500);
    };

    pollInterval = setInterval(pollStatus, 800);

    return () => {
      isSubscribed = false;
      if (pollInterval) clearInterval(pollInterval);
      if (healthInterval) clearInterval(healthInterval);
    };
  }, [updating, isPt]);

  // Smart localization dictionary for technical changelog titles and bullets
  const translateText = useMemo(() => {
    return (rawText: string): string => {
      if (!isPt) return rawText;
      let text = rawText.trim();

      const exactMap: Record<string, string> = {
        'Harden backend graceful shutdown and system update status endpoint':
          'Blindagem do desligamento seguro do backend e endpoint de status de atualização',
        'Add Unix SIGTERM/SIGINT signal listener in main.rs to avoid premature exit code 0':
          'Adicionado interceptador de sinais Unix SIGTERM/SIGINT no main.rs para evitar encerramento prematuro (código 0)',
        'Implement poison-safe lock guards across system.rs':
          'Implementação de travas seguras contra envenenamento de threads em todo o system.rs',
        'Add dedicated status and check endpoint unit tests in system_update_tests.rs':
          'Adicionados testes unitários dedicados de status e verificação no system_update_tests.rs',
        'Enhance FileManager test async assertion resiliency for CI':
          'Aprimorada a resiliência de asserções assíncronas no teste do Gerenciador de Arquivos para o CI',
        'Slim down runtime Docker image by removing ffmpeg and cleaning cache':
          'Redução drástica do tamanho da imagem Docker removendo ffmpeg e limpando cache',
        'Bump version to v1.9.5 and fix self-recreation container loop':
          'Atualização para a versão v1.9.5 e correção definitiva da reinicialização transparente do contêiner',
        'Fix self-update container recreation using Docker labels and local image helper':
          'Correção da reinicialização do contêiner com detecção via labels do Docker e runner local',
        'Bump version to v1.9.4 and improve changelog localization':
          'Atualização para a versão v1.9.4 e tradução integral do changelog',
        'Implement live update log streaming and smooth reconnection':
          'Implementado streaming de logs em tempo real e reconexão transparente no modal de atualização',
        'Fix container restarting loop and backend execution permissions':
          'Correção do loop de reinicialização do contêiner e permissões de execução do backend',
        'Add explicit chmod +x for orbit-backend, docker and compose binaries in Dockerfile':
          'Adicionada permissão explícita de execução (chmod +x) para orbit-backend, docker e compose no Dockerfile',
        'Make Docker socket connection in lib.rs robust with socket_defaults first and graceful fallback':
          'Conexão com o socket Docker mais resiliente com fallback seguro sem gerar panic',
        'Add detailed fatal error logging in main.rs for TCP binding and runtime errors':
          'Logs detalhados de diagnóstico para inicialização do servidor e binding da porta TCP',
        'Trigger CD on push to main and fix root docker config test in install.sh':
          'Disparo imediato do build no push para main e correção no teste de configuração do Docker',
        'Optimize App Store memory footprint and reclaim glibc heap via malloc_trim':
          'Otimização radical de memória RAM da App Store com devolução de heap ao kernel via malloc_trim',
        'Optimize Dockerfile multi-arch build using native cross-compilation':
          'Otimização do build multi-arquitetura com cross-compilação nativa (tempo reduzido de 30min para 1.5min)',
        'Optimize frontend and backend RAM, CPU and bundle performance':
          'Otimização integral de memória RAM, CPU e redução do tamanho do bundle no frontend e backend',
        'Add categorized badges and full i18n translation to UpdateModal changelog':
          'Indicadores categorizados [Correção], [Nova Funcionalidade], [Performance] e tradução completa no modal',
        'Add universal 1-command installer and clean frontend lint warnings':
          'Adicionado script instalador universal em 1 comando estilo CasaOS e limpeza de código',
        'Remove .agents and AGENTS.md from git tracking and re-add to .gitignore':
          'Desvinculação dos arquivos de agentes do Git e atualização das regras do gitignore',
        'Synchronize agent suite, 4-tier continuous memory and history archive':
          'Sincronização da memória de 4 tiers e histórico consolidado do projeto'
      };

      if (exactMap[text]) {
        return exactMap[text];
      }

      // Comprehensive phrase & regex replacement rules for dynamic git commits
      text = text
        .replace(/^Add\s+/i, 'Adicionado: ')
        .replace(/^Added\s+/i, 'Adicionado: ')
        .replace(/^Fix\s+/i, 'Correção: ')
        .replace(/^Fixed\s+/i, 'Corrigido: ')
        .replace(/^Update\s+/i, 'Atualizado: ')
        .replace(/^Updated\s+/i, 'Atualizado: ')
        .replace(/^Remove\s+/i, 'Removido: ')
        .replace(/^Removed\s+/i, 'Removido: ')
        .replace(/^Implement\s+/i, 'Implementado: ')
        .replace(/^Implemented\s+/i, 'Implementado: ')
        .replace(/^Configure\s+/i, 'Configurado: ')
        .replace(/^Configured\s+/i, 'Configurado: ')
        .replace(/^Optimize\s+/i, 'Otimizado: ')
        .replace(/^Optimized\s+/i, 'Otimizado: ')
        .replace(/^Enhance\s+/i, 'Aprimorado: ')
        .replace(/^Enhanced\s+/i, 'Aprimorado: ')
        .replace(/^Harden\s+/i, 'Blindagem de: ')
        .replace(/^Bump\s+/i, 'Atualização de: ')
        .replace(/graceful shutdown/gi, 'desligamento seguro')
        .replace(/status endpoint/gi, 'endpoint de status')
        .replace(/check endpoint/gi, 'endpoint de verificação')
        .replace(/unit tests/gi, 'testes unitários')
        .replace(/signal listener/gi, 'ouvinte de sinais')
        .replace(/in main\.rs/gi, 'no arquivo main.rs')
        .replace(/in system\.rs/gi, 'no arquivo system.rs')
        .replace(/in Dockerfile/gi, 'no Dockerfile')
        .replace(/in install\.sh/gi, 'no script install.sh')
        .replace(/in system_update_tests\.rs/gi, 'no arquivo de testes do sistema')
        .replace(/to avoid premature exit code 0/gi, 'para evitar encerramento prematuro (código 0)')
        .replace(/to avoid premature exit/gi, 'para evitar encerramento prematuro')
        .replace(/poison-safe lock guards/gi, 'travas de memória seguras contra travamentos de thread')
        .replace(/across/gi, 'em todo o')
        .replace(/by removing (.+)/gi, 'removendo $1')
        .replace(/and cleaning cache/gi, 'e limpando cache')
        .replace(/runtime Docker image/gi, 'imagem Docker de execução')
        .replace(/for immediate publishing/gi, 'para publicação imediata')
        .replace(/to prevent CLI warning/gi, 'para evitar avisos no terminal')
        .replace(/using native cross-compilation/gi, 'usando cross-compilação nativa');

      return text;
    };
  }, [isPt]);

  // Structured changelog entries with visual badges
  const parsedChangelog = useMemo<ParsedChangelogEntry[]>(() => {
    const raw = updateInfo?.release_notes || '';
    if (!raw.trim()) return [];

    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('Últimas alterações') && !l.startsWith('Latest repository changes'));

    if (lines.length === 0) return [];

    const entries: ParsedChangelogEntry[] = [];
    let currentEntry: ParsedChangelogEntry | null = null;

    for (const line of lines) {
      const isBullet = line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ');
      const cleanLine = isBullet ? line.substring(2).trim() : line;

      if (!isBullet || !currentEntry) {
        const lower = cleanLine.toLowerCase();
        let category: ParsedChangelogEntry['category'] = 'update';
        let badgeLabel = t('update_modal.badge_update', 'Atualização');
        let badgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        let icon = Sparkles;

        if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('corrig') || lower.includes('patch')) {
          category = 'fix';
          badgeLabel = t('update_modal.badge_fix', 'Correção');
          badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
          icon = Bug;
        } else if (lower.includes('harden') || lower.includes('sec') || lower.includes('guard') || lower.includes('auth') || lower.includes('jwt') || lower.includes('seguran')) {
          category = 'sec';
          badgeLabel = t('update_modal.badge_sec', 'Segurança');
          badgeClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
          icon = Shield;
        } else if (lower.includes('slim') || lower.includes('perf') || lower.includes('optimiz') || lower.includes('speed') || lower.includes('ram') || lower.includes('cpu')) {
          category = 'perf';
          badgeLabel = t('update_modal.badge_perf', 'Performance');
          badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
          icon = Zap;
        } else if (lower.includes('feat') || lower.includes('add') || lower.includes('new') || lower.includes('nov') || lower.includes('recurso') || lower.includes('bump')) {
          category = 'feat';
          badgeLabel = t('update_modal.badge_feat', 'Nova Funcionalidade');
          badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
          icon = Sparkles;
        } else if (lower.includes('refactor') || lower.includes('clean') || lower.includes('lint') || lower.includes('melhor') || lower.includes('enhance')) {
          category = 'refactor';
          badgeLabel = t('update_modal.badge_refactor', 'Melhoria');
          badgeClass = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
          icon = Wrench;
        } else if (lower.includes('doc') || lower.includes('readme') || lower.includes('manual')) {
          category = 'docs';
          badgeLabel = t('update_modal.badge_docs', 'Documentação');
          badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
          icon = FileCode2;
        }

        currentEntry = {
          category,
          badgeLabel,
          badgeClass,
          icon,
          title: translateText(cleanLine),
          bullets: []
        };
        entries.push(currentEntry);
      } else {
        currentEntry.bullets.push(translateText(cleanLine));
      }
    }

    return entries;
  }, [updateInfo?.release_notes, t, translateText]);

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    const confirmText = isPt
      ? 'Deseja iniciar a atualização do Orbit agora? O progresso e os logs detalhados serão exibidos em tempo real.'
      : 'Do you want to update Orbit now? Live progress and detailed logs will be streamed in real-time.';

    if (!window.confirm(confirmText)) {
      return;
    }

    setUpdating(true);
    setTaskState({
      status: 'pulling',
      progress: 10,
      current_step: isPt ? 'Iniciando verificação e download...' : 'Starting verification and download...',
      logs: [
        isPt ? '🚀 [INFO] Conectando ao backend e iniciando tarefa de atualização...' : '🚀 [INFO] Connecting to backend and starting update task...'
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
                {updating ? (isPt ? 'Atualização em Tempo Real' : 'Live Update Progress') : t('update_modal.title', 'Atualização do Orbit')}
                {!updating && updateInfo?.has_update && (
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
                  ? (taskState.current_step || (isPt ? 'Processando...' : 'Processing...'))
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {!updating ? (
            <>
              {/* Architecture / Platform info */}
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

              {/* Versions Comparison Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border/80 flex flex-col justify-between">
                  <span className="text-xs text-secondary font-medium">{t('update_modal.installed_version', 'Versão Instalada')}</span>
                  <span className="text-lg font-bold text-white mt-1 tabular-nums">
                    v{updateInfo?.current_version || '1.0.0'}
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
                    v{updateInfo?.latest_version || updateInfo?.current_version || '1.0.0'}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-secondary mt-1">
                    <GitBranch className="w-3.5 h-3.5 text-orbit-400" />
                    <span className="truncate">ghcr.io :latest</span>
                  </div>
                </div>
              </div>

              {/* What changed / Changelog section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-orbit-400" />
                    {t('update_modal.what_changed', 'O que há de novo / O que foi corrigido')}
                  </h3>
                  <button 
                    onClick={onRefreshInfo}
                    className="text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1"
                    title={t('update_modal.refresh', 'Verificar')}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('update_modal.refresh', 'Verificar')}</span>
                  </button>
                </div>

                {parsedChangelog.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {parsedChangelog.map((entry, idx) => {
                      const Icon = entry.icon;
                      return (
                        <div 
                          key={idx} 
                          className="p-3 rounded-xl bg-card/70 border border-border/80 hover:border-border transition-all space-y-1.5"
                        >
                          <div className="flex items-start gap-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border shrink-0 mt-0.5 ${entry.badgeClass}`}>
                              <Icon className="w-3 h-3" />
                              <span>[{entry.badgeLabel}]</span>
                            </span>
                            <p className="text-xs font-medium text-primary leading-relaxed">
                              {entry.title}
                            </p>
                          </div>

                          {entry.bullets.length > 0 && (
                            <ul className="space-y-1 pl-6 pt-0.5">
                              {entry.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="text-[11px] text-secondary list-disc leading-relaxed">
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
                  <div className="p-4 rounded-xl bg-card/60 border border-border/80 text-xs text-secondary text-center">
                    {t('update_modal.no_notes', 'Nenhuma nota de versão disponível no momento.')}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Live Update Terminal View */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Progress Bar & Header */}
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
                    <span>{isPt ? 'Tentativa de reconexão:' : 'Reconnection attempt:'}</span>
                    <span className="font-mono text-orbit-300">{reconnectAttempts} / 45</span>
                  </div>
                )}
              </div>

              {/* Terminal Logs Output */}
              <div className="rounded-xl bg-black/90 border border-slate-800/80 p-3.5 font-mono text-[11px] leading-relaxed shadow-inner overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    <span>ORBIT UPDATE LOG STREAM</span>
                  </span>
                  <span>{taskState.logs.length} linhas</span>
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

              {/* Error Box if failed */}
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
            <button
              type="button"
              onClick={handleStartUpdate}
              className="px-4 py-2 text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 rounded-xl transition-all shadow-md shadow-orbit-900/30 flex items-center gap-2 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{updateInfo?.has_update ? t('update_modal.update_now', 'Atualizar Orbit Agora') : t('update_modal.reinstall_force', 'Reinstalar / Forçar Atualização')}</span>
            </button>
          ) : taskState.status === 'error' ? (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isPt ? 'Tentar Novamente' : 'Retry'}</span>
            </button>
          ) : (
            <div className="text-xs text-secondary flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orbit-400" />
              <span>{taskState.status === 'recreating' ? (isPt ? 'Reconectando...' : 'Reconnecting...') : (isPt ? 'Baixando...' : 'Downloading...')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
