import { useState } from 'react';
import { X, Archive, AlertTriangle, Loader2 } from 'lucide-react';

interface CreateBackupModalProps {
  apps: string[];
  onClose: () => void;
  onSubmit: (appName: string) => Promise<void>;
}

export function CreateBackupModal({ apps, onClose, onSubmit }: CreateBackupModalProps) {
  const [selectedApp, setSelectedApp] = useState(apps[0] || '');
  const [customApp, setCustomApp] = useState('');
  const [useCustom, setUseCustom] = useState(apps.length === 0);
  const [loading, setLoading] = useState(false);

  const effectiveApp = useCustom ? customApp.trim() : selectedApp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveApp) return;

    setLoading(true);
    try {
      await onSubmit(effectiveApp);
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
            <div className="p-2.5 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Criar Backup 1-Clique</h3>
              <p className="text-xs text-secondary">Compacta /data/apps/&lt;app&gt; e volumes em .tar.gz</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Selecione o Aplicativo / Stack
            </label>

            {!useCustom && apps.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                  disabled={loading}
                  className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500"
                >
                  {apps.map((app) => (
                    <option key={app} value={app} className="bg-card text-primary">
                      {app}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseCustom(true)}
                  className="text-xs text-orbit-500 hover:underline"
                >
                  Ou digite o nome do app manualmente
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Ex: nextcloud, jellyfin, vaultwarden..."
                  value={customApp}
                  onChange={(e) => setCustomApp(e.target.value)}
                  disabled={loading}
                  className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500 font-mono"
                  required
                />
                {apps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseCustom(false)}
                    className="text-xs text-orbit-500 hover:underline"
                  >
                    Voltar para lista de aplicativos detectados
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Para garantir consistência estrita dos dados sem corrupção, o stack Docker será pausado brevemente durante a compactação e reiniciado de imediato.
            </span>
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
              type="submit"
              disabled={loading || !effectiveApp}
              className="px-5 py-2 bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Compactando...' : 'Iniciar Backup'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
