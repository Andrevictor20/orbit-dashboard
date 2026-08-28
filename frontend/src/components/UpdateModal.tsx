import { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  Cpu, 
  GitBranch, 
  Clock, 
  ShieldCheck
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

export function UpdateModal({ isOpen, onClose, updateInfo, onRefreshInfo }: UpdateModalProps) {
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdate = async () => {
    if (!window.confirm('Deseja iniciar a atualização do Orbit agora? O serviço será reiniciado com a versão mais recente.')) {
      return;
    }

    setUpdating(true);
    setStatusMessage('Baixando imagem multi-arch do GitHub Container Registry (GHCR)...');

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error(`Falha ao iniciar atualização: ${res.status}`);
      }

      setStatusMessage('Imagem baixada! Reiniciando container do Orbit... Aguarde reconexão.');
      toast.success('Atualização disparada com sucesso!');

      // Poll health until reconnect
      let retries = 0;
      const checkInterval = setInterval(async () => {
        retries++;
        try {
          const health = await fetch('/health');
          if (health.ok) {
            clearInterval(checkInterval);
            setStatusMessage('Orbit atualizado com sucesso! Recarregando...');
            toast.success('Orbit atualizado e ativo!');
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
          setStatusMessage('O Orbit está reiniciando. Atualize a página manualmente caso não recarregue.');
        }
      }, 2000);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar Orbit');
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
                Atualização do Orbit
                {updateInfo?.has_update && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Disponível
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                Gerenciamento e implantação sob demanda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={updating}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label="Fechar modal"
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
              <span>Arquitetura:</span>
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
              <span className="text-xs text-secondary font-medium">Versão Instalada</span>
              <span className="text-lg font-bold text-white mt-1 tabular-nums">
                v{updateInfo?.current_version || '1.0.0'}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Instalação Ativa</span>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              updateInfo?.has_update 
                ? 'bg-orbit-500/10 border-orbit-500/30' 
                : 'bg-card border-border/80'
            }`}>
              <span className="text-xs text-secondary font-medium">Mais Recente no GitHub</span>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orbit-400" />
                O que há de novo / O que foi corrigido
              </h3>
              <button 
                onClick={onRefreshInfo}
                disabled={updating}
                className="text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1"
                title="Checar novamente"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Verificar</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-card/60 border border-border/80 text-xs text-secondary leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
              {updateInfo?.release_notes || 'Nenhuma nota de versão disponível no momento.'}
            </div>
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
            Fechar
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
                <span>Atualizando...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{updateInfo?.has_update ? 'Atualizar Orbit Agora' : 'Reinstalar / Forçar Atualização'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
