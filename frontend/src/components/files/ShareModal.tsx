import { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Clock, 
  Trash2, 
  ExternalLink, 
  Loader2,
  FileText,
  Folder
} from 'lucide-react';
import type { FileItem } from '../../pages/FileManager';

interface ShareLink {
  token: string;
  file_path: string;
  file_name: string;
  is_dir: boolean;
  size: number;
  created_at: string;
  expires_at?: string;
}

interface ShareModalProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const [expiration, setExpiration] = useState<number | null>(86400); // Default 24h
  const [createdShare, setCreatedShare] = useState<ShareLink | null>(null);
  const [existingShares, setExistingShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchShares = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/files/shares');
      if (res.ok) {
        const json = await res.json();
        setExistingShares(json.shares || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCreatedShare(null);
      setError(null);
      fetchShares();
    }
  }, [isOpen, file.path]);

  const handleCreateShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/files/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          expires_in_seconds: expiration,
        }),
      });

      if (!res.ok) throw new Error('Erro ao criar link de compartilhamento');
      const share: ShareLink = await res.json();
      setCreatedShare(share);
      fetchShares();
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar link');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShare = async (token: string) => {
    try {
      const res = await fetch(`/api/files/share/${token}`, { method: 'DELETE' });
      if (res.ok) {
        if (createdShare?.token === token) {
          setCreatedShare(null);
        }
        fetchShares();
      }
    } catch {
      // ignore
    }
  };

  const getPublicUrl = (token: string) => {
    return `${window.location.origin}/api/public/share/${token}`;
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getPublicUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatExpiry = (expires_at?: string) => {
    if (!expires_at) return 'Nunca expira';
    try {
      const date = new Date(expires_at);
      return `Expira em ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return expires_at;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Compartilhar Arquivo
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-sm">
                Gere um link público temporário sem necessidade de login.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Target File Info */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800/80">
            <div className="p-2 rounded-lg bg-zinc-700/30 text-violet-400">
              {file.is_dir ? <Folder size={20} /> : <FileText size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-zinc-200 truncate">{file.name}</h4>
              <p className="text-xs text-zinc-400 font-mono">
                {file.is_dir ? 'Pasta' : `${(file.size / 1024).toFixed(1)} KB`}
              </p>
            </div>
          </div>

          {/* Expiration Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> Validade do Link
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '1 Hora', val: 3600 },
                { label: '24 Horas', val: 86400 },
                { label: '7 Dias', val: 604800 },
                { label: '30 Dias', val: 2592000 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setExpiration(opt.val)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    expiration === opt.val
                      ? 'bg-violet-600/20 text-violet-400 border-violet-500/40 font-semibold'
                      : 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleCreateShare}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {loading ? 'Gerando Link...' : 'Gerar Novo Link de Compartilhamento'}
          </button>

          {/* Newly Created Share */}
          {createdShare && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Link Criado com Sucesso!
                </span>
                <span className="text-[11px] text-zinc-400">
                  {formatExpiry(createdShare.expires_at)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getPublicUrl(createdShare.token)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 select-all"
                />
                <button
                  onClick={() => handleCopy(createdShare.token)}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  title="Copiar Link"
                >
                  {copiedToken === createdShare.token ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Active Shares List for this file */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Links Ativos ({existingShares.filter(s => s.file_path === file.path).length})
            </h4>

            {loadingList ? (
              <div className="flex justify-center py-4 text-zinc-500">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : existingShares.filter(s => s.file_path === file.path).length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                Nenhum link ativo gerado para este item.
              </p>
            ) : (
              <div className="space-y-2">
                {existingShares
                  .filter(s => s.file_path === file.path)
                  .map((share) => (
                    <div
                      key={share.token}
                      className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/60 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-300 truncate">
                            {share.token}
                          </span>
                          <a
                            href={getPublicUrl(share.token)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-500 hover:text-violet-400"
                            title="Abrir link"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          {formatExpiry(share.expires_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(share.token)}
                          className="p-1.5 rounded-lg bg-zinc-700/40 hover:bg-zinc-700 text-zinc-300 transition-colors"
                          title="Copiar Link"
                        >
                          {copiedToken === share.token ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteShare(share.token)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Revogar Link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
