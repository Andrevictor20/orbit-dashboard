import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  Cpu, 
  GitBranch, 
  Clock, 
  Zap, 
  Wrench, 
  Terminal, 
  AlertTriangle, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OrbitLogo } from '../ui/OrbitLogo';

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

interface ReleaseSection {
  title: string;
  badgeLabel: string;
  badgeClass: string;
  icon: any;
  items: Array<{ title: string; desc: string }>;
}

interface UpdateTaskState {
  status: 'idle' | 'pulling' | 'recreating' | 'done' | 'error';
  progress: number;
  current_step: string;
  logs: string[];
  error?: string | null;
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
              const targetVersion = updateInfo?.latest_version || updateInfo?.current_version || '1.9.9';
              localStorage.setItem('orbit_last_updated_version', targetVersion);
              localStorage.removeItem('orbit_token');

              setTaskState(prev => ({
                ...prev,
                status: 'done',
                progress: 100,
                current_step: 'Orbit atualizado com sucesso! Redirecionando para o login...',
                logs: [
                  ...prev.logs, 
                  '🎉 [SUCCESS] Novo container ativo e respondendo na porta 5172!',
                  '🚀 [REDIRECT] Redirecionando para a tela de login...'
                ]
              }));

              toast.success('Orbit atualizado com sucesso! Redirecionando para o login...');
              
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
              error: 'Tempo limite atingido. Atualize a página manualmente.'
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
  }, [updating, updateInfo]);

  // Clean Markdown & Bullet Parser for Release Notes
  const parsedSections = useMemo<ReleaseSection[]>(() => {
    const raw = updateInfo?.release_notes || '';
    if (!raw.trim()) return [];

    const sections: ReleaseSection[] = [];
    const lines = raw.split('\n');

    let currentSection: ReleaseSection = {
      title: 'Melhorias da Versão',
      badgeLabel: 'NOVIDADE',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Sparkles,
      items: [],
    };

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('# ')) continue;

      if (line.startsWith('### ') || line.startsWith('## ')) {
        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }

        const heading = line.replace(/^#+\s*/, '').trim();
        const lower = heading.toLowerCase();

        if (lower.includes('desempenho') || lower.includes('performance') || lower.includes('fluidez')) {
          currentSection = {
            title: heading.replace(/^[^\w\s]+/, '').trim() || 'Desempenho & Fluidez',
            badgeLabel: 'DESEMPENHO',
            badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            icon: Zap,
            items: [],
          };
        } else if (lower.includes('correç') || lower.includes('fix') || lower.includes('bug')) {
          currentSection = {
            title: heading.replace(/^[^\w\s]+/, '').trim() || 'Correções & Estabilidade',
            badgeLabel: 'CORREÇÃO',
            badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
            icon: Wrench,
            items: [],
          };
        } else {
          currentSection = {
            title: heading.replace(/^[^\w\s]+/, '').trim() || 'Novidades',
            badgeLabel: 'NOVIDADE',
            badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            icon: Sparkles,
            items: [],
          };
        }
        continue;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.replace(/^[-*]\s+/, '').trim();
        // Check for **Title:** Desc or **Title** - Desc
        const boldMatch = text.match(/^\*\*(.*?)\*\*[:\s-]*(.*)$/);
        if (boldMatch) {
          currentSection.items.push({
            title: boldMatch[1].trim(),
            desc: boldMatch[2].trim(),
          });
        } else {
          currentSection.items.push({
            title: '',
            desc: text,
          });
        }
      }
    }

    if (currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }, [updateInfo?.release_notes]);

  const handleStartUpdate = async () => {
    if (updateInfo?.ci_status === 'building') {
      toast.error('A imagem ainda está sendo compilada no GitHub Actions. Aguarde.');
      return;
    }

    try {
      setUpdating(true);
      setTaskState({
        status: 'pulling',
        progress: 10,
        current_step: 'Iniciando download da nova imagem do Orbit...',
        logs: [
          '🚀 [START] Processo de atualização iniciado pelo usuário.',
          '📦 [TARGET] Baixando imagem mais recente: ghcr.io/andrevictor20/orbit-dashboard:latest'
        ],
        error: null,
      });

      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao acionar atualização.');
      }
    } catch (e: any) {
      setUpdating(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all">
        
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
                {!updating && updateInfo?.has_update && updateInfo?.ci_status !== 'building' && (
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
            className="p-1.5 text-secondary hover:text-primary rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-30"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background/40">
          {!updating ? (
            <>
              {/* Telemetry Strip & Versions Grid */}
              <div className="p-5 pb-3 space-y-3">
                {/* CI/CD Building Alert Banner */}
                {updateInfo?.ci_status === 'building' && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-200">
                    <div className="flex items-start gap-2.5">
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-primary">
                          Compilação em Andamento no GitHub
                        </p>
                        <p className="text-[11.5px] text-secondary mt-0.5">
                          A nova imagem do Orbit está sendo gerada. Assim que terminar, você poderá atualizar com 1-clique.
                        </p>
                      </div>
                    </div>
                    {updateInfo.ci_workflow_url && (
                      <a
                        href={updateInfo.ci_workflow_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <span>Ver CI/CD</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Architecture & Date */}
                <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-card border border-border/70 text-xs">
                  <div className="flex items-center gap-1.5 text-secondary">
                    <Cpu className="w-3.5 h-3.5 text-orbit-400" />
                    <span>Arquitetura:</span>
                    <strong className="text-primary font-mono">
                      {updateInfo ? formatPlatformName(updateInfo.platform, updateInfo.arch) : 'Detectando...'}
                    </strong>
                  </div>

                  {updateInfo?.published_at && (
                    <div className="flex items-center gap-1 text-secondary font-mono text-[11px]">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(updateInfo.published_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {/* 2-Column Version Deck */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex flex-col justify-between shadow-sm">
                    <span className="text-xs text-secondary font-medium">Versão Instalada</span>
                    <span className="text-xl font-bold text-primary font-mono mt-1">
                      v{updateInfo?.current_version || '1.9.9'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Instalação Ativa</span>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl border flex flex-col justify-between shadow-sm ${
                    updateInfo?.has_update 
                      ? 'bg-orbit-500/10 border-orbit-500/40' 
                      : 'bg-card border-border/80'
                  }`}>
                    <span className="text-xs text-secondary font-medium">Mais Recente</span>
                    <span className={`text-xl font-bold font-mono mt-1 ${
                      updateInfo?.has_update ? 'text-orbit-400' : 'text-primary'
                    }`}>
                      v{updateInfo?.latest_version || updateInfo?.current_version || '1.9.9'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-secondary mt-1 font-mono">
                      <GitBranch className="w-3.5 h-3.5 text-orbit-400" />
                      <span>ghcr.io:latest</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Refresh */}
              <div className="px-5 pt-2 pb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles className="w-3.5 h-3.5 text-orbit-400" />
                  <span>O que mudou nesta versão</span>
                </div>

                <button 
                  onClick={onRefreshInfo}
                  className="text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1 bg-card hover:bg-neutral-800 px-2.5 py-1 rounded-lg border border-border/70 active:scale-95 shadow-sm"
                  title="Verificar atualizações"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Verificar</span>
                </button>
              </div>

              {/* Release Notes List */}
              <div className="p-5 pt-2 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
                {parsedSections.length > 0 ? (
                  parsedSections.map((section, sIdx) => {
                    const SectionIcon = section.icon;
                    return (
                      <div 
                        key={sIdx}
                        className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-lg border ${section.badgeClass}`}>
                            <SectionIcon className="w-3 h-3" />
                            <span>{section.badgeLabel}</span>
                          </span>
                          <h3 className="text-xs font-bold text-primary">
                            {section.title}
                          </h3>
                        </div>

                        <ul className="space-y-1.5 pl-2">
                          {section.items.map((item, iIdx) => (
                            <li key={iIdx} className="text-xs text-secondary leading-relaxed flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-orbit-400 shrink-0 mt-1.5" />
                              <div>
                                {item.title && (
                                  <strong className="text-primary mr-1">
                                    {item.title}:
                                  </strong>
                                )}
                                <span>{item.desc}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card border border-border/60 text-secondary text-center space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mb-1" />
                    <p className="text-sm font-semibold text-primary">Orbit 100% Atualizado</p>
                    <p className="text-xs text-secondary">
                      Você está rodando a versão mais recente com todas as melhorias e correções aplicadas.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Live Progress Screen */
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-2.5 p-4 rounded-2xl bg-card border border-border/80">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-primary flex items-center gap-2">
                      {taskState.status === 'recreating' ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <Download className="w-4 h-4 text-orbit-400 animate-bounce" />
                      )}
                      {taskState.current_step || 'Executando atualização...'}
                    </span>
                    <span className="text-orbit-400 font-mono text-xs tabular-nums font-bold">
                      {taskState.progress}%
                    </span>
                  </div>

                  <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-border/50">
                    <div 
                      className="bg-orbit-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(taskState.progress, 5)}%` }}
                    />
                  </div>

                  {taskState.status === 'recreating' && (
                    <div className="flex items-center justify-between text-[11px] text-secondary pt-1">
                      <span>Tentativa de reconexão:</span>
                      <span className="font-mono text-amber-400 font-bold">{reconnectAttempts}/45</span>
                    </div>
                  )}
                </div>

                {/* Console Log Terminal */}
                <div className="rounded-2xl bg-neutral-950 border border-border/80 overflow-hidden font-mono text-xs shadow-inner">
                  <div className="px-3.5 py-2 bg-neutral-900 border-b border-border/60 flex items-center justify-between text-[11px] text-secondary">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-orbit-400" />
                      <span className="font-medium text-zinc-300">Terminal de Atualização</span>
                    </div>
                    <span className="text-zinc-500 font-mono text-[10px]">Docker Engine</span>
                  </div>
                  <div className="p-3.5 max-h-48 overflow-y-auto space-y-1 scrollbar-thin text-[11px]">
                    {taskState.logs.map((line, idx) => (
                      <div key={idx} className="text-zinc-300">
                        {line}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

                {taskState.error && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{taskState.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-5 border-t border-border/80 bg-card flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={updating && taskState.status !== 'error'}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary hover:bg-neutral-800 transition-colors disabled:opacity-30"
          >
            Fechar
          </button>

          {!updating && (
            <button
              onClick={handleStartUpdate}
              disabled={updateInfo?.ci_status === 'building'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-orbit-500/25 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Atualizar Orbit Agora</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default UpdateModal;
