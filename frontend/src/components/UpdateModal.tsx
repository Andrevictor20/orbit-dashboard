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
  List
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

  const translateText = useMemo(() => {
    return (rawText: string): string => {
      if (!isPt) return rawText;
      let text = rawText.trim();

      const exactMap: Record<string, string> = {
        'Fix Cargo mtime cache bug: touch all .rs files': 'Correção: Bug de cache de tempo (mtime) do Cargo resolvido via touch',
        'Fix CI/CD cache bug: force backend recompile on every push': 'Correção: Bug de cache do CI/CD forçando recompilação do backend',
        'Fix silent restart loop: restore safe graceful shutdown': 'Correção: Loop de reinício silencioso resolvido com desligamento seguro',
        'Fix premature ExitCode 0 container restart loop': 'Correção: Loop de reinício prematuro (código 0) do contêiner resolvido'
      };

      if (exactMap[text]) return exactMap[text];

      text = text
        .replace(/^Add\s+/i, 'Adicionado: ')
        .replace(/^Fix\s+/i, 'Correção: ')
        .replace(/^Update\s+/i, 'Atualizado: ')
        .replace(/^Remove\s+/i, 'Removido: ')
        .replace(/^Implement\s+/i, 'Implementado: ')
        .replace(/^Optimize\s+/i, 'Otimizado: ')
        .replace(/^Bump\s+/i, 'Atualização de versão para: ')
        .replace(/cache bug/gi, 'bug de cache')
        .replace(/restart loop/gi, 'loop de reinicialização')
        .replace(/graceful shutdown/gi, 'desligamento seguro')
        .replace(/unit tests/gi, 'testes unitários');

      return text;
    };
  }, [isPt]);

  const parsedChangelog = useMemo<ParsedChangelogEntry[]>(() => {
    const raw = updateInfo?.release_notes || '';
    if (!raw.trim()) return [];

    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('Últimas alterações') && !l.startsWith('Latest repository changes') && !l.startsWith('## What\'s Changed'));

    if (lines.length === 0) return [];

    const entries: ParsedChangelogEntry[] = [];
    let currentEntry: ParsedChangelogEntry | null = null;

    for (const line of lines) {
      const isBullet = line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ');
      const cleanLine = isBullet ? line.substring(2).trim() : line;
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
      } else if (lower.includes('sec') || lower.includes('guard') || lower.includes('auth')) {
        category = 'sec';
        badgeLabel = t('update_modal.badge_sec', 'Segurança');
        badgeClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
        icon = Shield;
      } else if (lower.includes('perf') || lower.includes('optimiz') || lower.includes('speed')) {
        category = 'perf';
        badgeLabel = t('update_modal.badge_perf', 'Performance');
        badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
        icon = Zap;
      } else if (lower.includes('feat') || lower.includes('add') || lower.includes('new') || lower.includes('nov') || lower.includes('bump')) {
        category = 'feat';
        badgeLabel = t('update_modal.badge_feat', 'Novidade');
        badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        icon = Sparkles;
      } else if (lower.includes('refactor') || lower.includes('clean') || lower.includes('lint')) {
        category = 'refactor';
        badgeLabel = t('update_modal.badge_refactor', 'Melhoria');
        badgeClass = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
        icon = Wrench;
      } else if (lower.includes('doc') || lower.includes('readme')) {
        category = 'docs';
        badgeLabel = t('update_modal.badge_docs', 'Docs');
        badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        icon = FileCode2;
      }

      if (!currentEntry || (isBullet && entries.length > 0)) {
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
        <div className="flex-1 overflow-hidden flex flex-col bg-background/50">
          {!updating ? (
            <>
              {/* Top Always Visible Details */}
              <div className="p-5 pb-0 space-y-4">
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
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/50 px-5 pt-5 gap-6">
                <button
                  onClick={() => setActiveTab('whatsnew')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative ${activeTab === 'whatsnew' ? 'text-orbit-400' : 'text-secondary hover:text-primary'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  {isPt ? 'O que há de novo / corrigido' : 'What\'s new'}
                  {activeTab === 'whatsnew' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-orbit-500 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative ${activeTab === 'history' ? 'text-orbit-400' : 'text-secondary hover:text-primary'}`}
                >
                  <History className="w-3.5 h-3.5" />
                  {isPt ? 'Histórico das últimas atualizações' : 'Update History'}
                  {activeTab === 'history' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-orbit-500 rounded-t-full" />
                  )}
                </button>
                
                <button 
                  onClick={onRefreshInfo}
                  className="ml-auto text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md mb-2"
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
                        <p className="text-sm font-semibold text-primary">{isPt ? 'Sistema Atualizado' : 'System is Up to Date'}</p>
                        <p className="text-xs">{isPt ? 'Você já possui a versão mais recente instalada. Nenhuma atualização pendente.' : 'You already have the latest version installed. No updates pending.'}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="animate-in fade-in duration-200 h-full">
                    {!updateInfo?.has_update && parsedChangelog.length > 0 ? (
                      <div className="space-y-3 pr-1">
                        {parsedChangelog.map((entry, idx) => {
                          const Icon = entry.icon;
                          return (
                            <div 
                              key={idx} 
                              className="p-3.5 rounded-xl bg-card/70 border border-border/80 hover:border-border transition-all space-y-2 opacity-80 hover:opacity-100"
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
                        <p className="text-xs max-w-[250px]">{isPt ? 'O histórico de versões anteriores está disponível no repositório.' : 'Previous version history is available on the repository.'}</p>
                        <a href="https://github.com/Andrevictor20/orbit-dashboard/commits/main" target="_blank" rel="noreferrer" className="text-xs font-semibold text-orbit-400 hover:text-orbit-300 hover:underline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-500/10 transition-colors">
                          <History className="w-3.5 h-3.5" />
                          {isPt ? 'Ver Histórico Completo' : 'View Full History'}
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
                      <span>{isPt ? 'Tentativa de reconexão:' : 'Reconnection attempt:'}</span>
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
