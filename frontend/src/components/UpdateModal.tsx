import { useState, useMemo } from 'react';
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
  Wrench
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

export function UpdateModal({ isOpen, onClose, updateInfo, onRefreshInfo }: UpdateModalProps) {
  const { t, i18n } = useTranslation();
  const isPt = (i18n.language || 'pt').toLowerCase().startsWith('pt');

  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Smart localization dictionary for technical changelog titles and bullets
  const translateText = useMemo(() => {
    return (rawText: string): string => {
      if (!isPt) return rawText;
      let text = rawText.trim();

      const exactMap: Record<string, string> = {
        'Fix container restarting loop and backend execution permissions':
          'Correção do loop de reinicialização do contêiner e permissões de execução do backend',
        'Add explicit chmod +x for orbit-backend, docker and compose binaries in Dockerfile':
          'Adicionada permissão explícita de execução (chmod +x) para orbit-backend, docker e compose no Dockerfile',
        'Make Docker socket connection in lib.rs robust with socket_defaults first and graceful fallback':
          'Conexão com o socket Docker mais resiliente com fallback seguro sem gerar panic',
        'Add detailed fatal error logging in main.rs for TCP binding and runtime errors':
          'Logs detalhados de diagnóstico para inicialização do servidor e binding da porta TCP',
        'Add detailed fatal error logging in main.rs for TCP binding':
          'Logs detalhados de diagnóstico para inicialização do servidor e binding da porta TCP',
        'Trigger CD on push to main and fix root docker config test in install.sh':
          'Disparo imediato do build no push para main e correção no teste de configuração do Docker',
        'Replace workflow_run trigger with push: [main] in cd.yml for immediate publishing':
          'Publicação imediata no GitHub Packages sem aguardar testes demorados',
        'Use sudo test -d in install.sh to properly clean /root/.docker/config.json directory':
          'Remoção automática e preventiva de pastas corrompidas em /root/.docker/config.json',
        'Initialize empty JSON object in /root/.docker/config.json to prevent CLI warning':
          'Inicialização de arquivo JSON válido para eliminar avisos no terminal',
        'Optimize Dockerfile multi-arch build using native cross-compilation':
          'Otimização do build multi-arquitetura com cross-compilação nativa (tempo reduzido de 30min para 1.5min)',
        'Optimize frontend and backend RAM, CPU and bundle performance':
          'Otimização integral de memória RAM, CPU e redução do tamanho do bundle no frontend e backend',
        'Implement Singleton Shared Stats Broadcaster in ws.rs (O(1) CPU/RAM scaling across WebSocket connections)':
          'Transmissor singleton de métricas (escala O(1) de CPU/RAM em WebSockets sem chamadas duplicadas ao Docker)',
        'Add adaptive sleep (8s idle / 3s active) to conserve host resources':
          'Modo de repouso inteligente (8s ocioso / 3s ativo) para economizar recursos no Raspberry Pi',
        'Implement route-level code splitting with React.lazy and Suspense in App.tsx':
          'Divisão de código por rota com React.lazy e Suspense para carregamento sob demanda',
        'Configure Rollup manualChunks in vite.config.ts (75% initial bundle size reduction from 1.31MB to 318KB)':
          'Divisão de bibliotecas pesadas no Vite (redução de 75% no carregamento inicial de 1.31MB para 318KB)',
        'Add universal 1-command installer and clean frontend lint warnings':
          'Adicionado script instalador universal em 1 comando estilo CasaOS e limpeza de código',
        'Remove .agents and AGENTS.md from git tracking and re-add to .gitignore':
          'Desvinculação dos arquivos de agentes do Git e atualização das regras do gitignore',
        'Synchronize agent suite, 4-tier continuous memory and history archive':
          'Sincronização da memória de 4 tiers e histórico consolidado do projeto',
        'Optimize Docker image size and build pipeline':
          'Otimização do tamanho da imagem Docker e do pipeline de compilação',
        'Fix volume and build cache disk consumption':
          'Correção do consumo de armazenamento em volumes e cache do BuildKit',
        'Add on-demand multi-arch system update, changelog modal, and notification':
          'Sistema de atualização multi-arquitetura sob demanda com modal de changelog e notificações',
        'Fix unbounded log accumulation and disk exhaustion on Raspberry Pi':
          'Correção do acúmulo ilimitado de logs e esgotamento de disco no Raspberry Pi'
      };

      if (exactMap[text]) {
        return exactMap[text];
      }

      // Regex pattern translations
      text = text
        .replace(/^Add explicit chmod \+x for (.+)/i, 'Permissão explícita chmod +x para $1')
        .replace(/^Add (.+)/i, 'Adicionado: $1')
        .replace(/^Fix (.+)/i, 'Correção: $1')
        .replace(/^Update (.+)/i, 'Atualizado: $1')
        .replace(/^Remove (.+)/i, 'Removido: $1')
        .replace(/^Implement (.+)/i, 'Implementado: $1')
        .replace(/^Configure (.+)/i, 'Configurado: $1')
        .replace(/^Optimize (.+)/i, 'Otimizado: $1')
        .replace(/^Enhance (.+)/i, 'Aprimorado: $1')
        .replace(/for immediate publishing/i, 'para publicação imediata')
        .replace(/in install\.sh/i, 'no script install.sh')
        .replace(/in Dockerfile/i, 'no Dockerfile')
        .replace(/in main\.rs/i, 'no arquivo main.rs')
        .replace(/in lib\.rs/i, 'no arquivo lib.rs')
        .replace(/to prevent CLI warning/i, 'para evitar avisos no terminal')
        .replace(/using native cross-compilation/i, 'usando cross-compilação nativa');

      return text;
    };
  }, [isPt]);

  // Structured changelog entries with visual badges
  const parsedChangelog = useMemo<ParsedChangelogEntry[]>(() => {
    const raw = updateInfo?.release_notes || '';
    if (!raw.trim()) return [];

    // Filter out generic header lines
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
        // Detect category
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
        } else if (lower.includes('feat') || lower.includes('add') || lower.includes('new') || lower.includes('nov') || lower.includes('recurso')) {
          category = 'feat';
          badgeLabel = t('update_modal.badge_feat', 'Nova Funcionalidade');
          badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
          icon = Sparkles;
        } else if (lower.includes('perf') || lower.includes('optimiz') || lower.includes('speed') || lower.includes('ram') || lower.includes('cpu')) {
          category = 'perf';
          badgeLabel = t('update_modal.badge_perf', 'Performance');
          badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
          icon = Zap;
        } else if (lower.includes('sec') || lower.includes('auth') || lower.includes('token') || lower.includes('jwt') || lower.includes('seguran')) {
          category = 'sec';
          badgeLabel = t('update_modal.badge_sec', 'Segurança');
          badgeClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
          icon = Shield;
        } else if (lower.includes('refactor') || lower.includes('clean') || lower.includes('lint') || lower.includes('melhor')) {
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

  const handleUpdate = async () => {
    const confirmText = isPt
      ? 'Deseja iniciar a atualização do Orbit agora? O serviço será reiniciado com a versão mais recente.'
      : 'Do you want to update Orbit now? The service will restart with the latest version.';

    if (!window.confirm(confirmText)) {
      return;
    }

    setUpdating(true);
    setStatusMessage(t('update_modal.downloading_image', 'Baixando imagem multi-arch do GitHub Container Registry (GHCR)...'));

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      setStatusMessage(t('update_modal.restarting_orbit', 'Imagem baixada! Reiniciando container do Orbit... Aguarde reconexão.'));
      toast.success(isPt ? 'Atualização disparada com sucesso!' : 'Update started successfully!');

      let retries = 0;
      const checkInterval = setInterval(async () => {
        retries++;
        try {
          const health = await fetch('/health');
          if (health.ok) {
            clearInterval(checkInterval);
            setStatusMessage(t('update_modal.update_success', 'Orbit atualizado com sucesso! Recarregando...'));
            toast.success(isPt ? 'Orbit atualizado e ativo!' : 'Orbit updated and active!');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        } catch {
          // Expected while restarting
        }

        if (retries > 30) {
          clearInterval(checkInterval);
          setUpdating(false);
          setStatusMessage(t('update_modal.restarting_manual', 'O Orbit está reiniciando. Atualize a página manualmente caso não recarregue.'));
        }
      }, 2000);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating Orbit');
      setUpdating(false);
      setStatusMessage(null);
    }
  };

  const formatPlatformName = (platform: string, arch: string) => {
    if (platform.includes('arm64') || arch === 'aarch64') return 'ARM64 (Raspberry Pi / ARM)';
    if (platform.includes('arm')) return 'ARMv7 (Raspberry Pi 32-bit)';
    if (platform.includes('amd64') || arch === 'x86_64') return 'x86_64 / AMD64 (PC & Server)';
    return `${platform} (${arch})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-gradient-to-r from-orbit-950/40 via-card to-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orbit-500/10 border border-orbit-500/20 text-orbit-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                {t('update_modal.title', 'Atualização do Orbit')}
                {updateInfo?.has_update && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {t('update_modal.available', 'Disponível')}
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                {t('update_modal.subtitle', 'Gerenciamento e implantação sob demanda')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={updating}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label={t('update_modal.close', 'Fechar modal')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
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
                disabled={updating}
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

          {/* Updating status indicator */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-orbit-500/10 border border-orbit-500/30 flex items-center gap-2.5 text-xs text-orbit-300 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-accent/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="px-4 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors disabled:opacity-50"
          >
            {t('update_modal.close', 'Fechar')}
          </button>

          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            className="px-4 py-2 text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 rounded-xl transition-all shadow-md shadow-orbit-900/30 flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {updating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t('update_modal.updating', 'Atualizando...')}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{updateInfo?.has_update ? t('update_modal.update_now', 'Atualizar Orbit Agora') : t('update_modal.reinstall_force', 'Reinstalar / Forçar Atualização')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
