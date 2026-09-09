import { useState } from 'react';
import { X, RotateCcw, AlertOctagon, Loader2 } from 'lucide-react';

interface RestoreConfirmModalProps {
  backup: {
    filename: string;
    app_name: string;
    size_bytes: number;
    created_at: string;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RestoreConfirmModal({ backup, onClose, onConfirm }: RestoreConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleConfirm = async () => {
    if (confirmedName !== backup.app_name) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Restaurar Snapshot</h3>
              <p className="text-xs text-secondary">{backup.filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-accent/40 rounded-xl p-3 border border-border/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-secondary">Aplicativo Alvo:</span>
              <span className="font-mono font-bold text-primary">{backup.app_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Tamanho do Arquivo:</span>
              <span className="font-mono text-primary">{formatBytes(backup.size_bytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Data do Snapshot:</span>
              <span className="text-primary">{backup.created_at}</span>
            </div>
          </div>

          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>Atenção: Ação Destrutiva</span>
            </div>
            <p>
              A restauração interrompe a stack Docker de <strong className="font-mono">{backup.app_name}</strong>, substitui todos os arquivos de configuração e dados persistidos pelos contidos no backup, e reinicia a stack.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1.5">
              Digite <span className="font-mono font-bold text-primary">{backup.app_name}</span> para confirmar:
            </label>
            <input
              type="text"
              value={confirmedName}
              onChange={(e) => setConfirmedName(e.target.value)}
              placeholder={backup.app_name}
              disabled={loading}
              className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-secondary hover:text-primary rounded-xl hover:bg-accent border border-border transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || confirmedName !== backup.app_name}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-rose-600/20 hover:shadow-rose-600/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Restaurando...' : 'Confirmar e Restaurar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
