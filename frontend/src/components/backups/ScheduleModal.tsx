import { useState } from 'react';
import { X, Clock, Calendar, ShieldCheck, Loader2 } from 'lucide-react';

export interface BackupScheduleConfig {
  enabled: boolean;
  interval_hours: number;
  max_backups_per_app: number;
  last_run?: string | null;
  apps: string[];
}

interface ScheduleModalProps {
  initialConfig: BackupScheduleConfig;
  availableApps: string[];
  onClose: () => void;
  onSave: (config: BackupScheduleConfig) => Promise<void>;
}

export function ScheduleModal({
  initialConfig,
  availableApps,
  onClose,
  onSave,
}: ScheduleModalProps) {
  const [config, setConfig] = useState<BackupScheduleConfig>({ ...initialConfig });
  const [loading, setLoading] = useState(false);

  const toggleApp = (app: string) => {
    setConfig((prev) => {
      const exists = prev.apps.includes(app);
      return {
        ...prev,
        apps: exists ? prev.apps.filter((a) => a !== app) : [...prev.apps, app],
      };
    });
  };

  const handleSelectAll = () => {
    setConfig((prev) => ({ ...prev, apps: [...availableApps] }));
  };

  const handleClearAll = () => {
    setConfig((prev) => ({ ...prev, apps: [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(config);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Agendamento de Backups</h3>
              <p className="text-xs text-secondary">Rotina automatizada e política de retenção</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3.5 bg-accent/40 rounded-xl border border-border">
            <div>
              <div className="text-sm font-semibold text-primary">Ativar Rotina Automática</div>
              <div className="text-xs text-secondary">Executa em background via scheduler interno</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orbit-500"></div>
            </label>
          </div>

          {/* Interval & Retention */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orbit-500" />
                <span>Intervalo de Execução</span>
              </label>
              <select
                value={config.interval_hours}
                onChange={(e) => setConfig({ ...config, interval_hours: Number(e.target.value) })}
                disabled={!config.enabled}
                className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500 disabled:opacity-50"
              >
                <option value={6} className="bg-card">A cada 6 horas</option>
                <option value={12} className="bg-card">A cada 12 horas</option>
                <option value={24} className="bg-card">Diariamente (24h)</option>
                <option value={48} className="bg-card">A cada 2 dias (48h)</option>
                <option value={168} className="bg-card">Semanalmente (7 dias)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Retenção por App</span>
              </label>
              <select
                value={config.max_backups_per_app}
                onChange={(e) => setConfig({ ...config, max_backups_per_app: Number(e.target.value) })}
                disabled={!config.enabled}
                className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500 disabled:opacity-50"
              >
                <option value={2} className="bg-card">Manter últimos 2</option>
                <option value={3} className="bg-card">Manter últimos 3</option>
                <option value={5} className="bg-card">Manter últimos 5 (Padrão)</option>
                <option value={10} className="bg-card">Manter últimos 10</option>
                <option value={20} className="bg-card">Manter últimos 20</option>
              </select>
            </div>
          </div>

          {/* Target Apps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Aplicativos Selecionados ({config.apps.length === 0 ? 'Todos' : config.apps.length})
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={!config.enabled}
                  className="text-orbit-500 hover:underline disabled:opacity-50"
                >
                  Selecionar Todos
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={!config.enabled}
                  className="text-secondary hover:text-primary disabled:opacity-50"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-2 space-y-1 bg-accent/20">
              {availableApps.length === 0 ? (
                <div className="text-xs text-secondary text-center py-4">Nenhum aplicativo ativo detectado</div>
              ) : (
                availableApps.map((app) => {
                  const isSelected = config.apps.includes(app);
                  return (
                    <label
                      key={app}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected ? 'bg-orbit-500/10 text-primary' : 'hover:bg-accent text-secondary'
                      }`}
                    >
                      <span className="font-mono font-medium">{app}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleApp(app)}
                        disabled={!config.enabled}
                        className="rounded border-border text-orbit-500 focus:ring-orbit-500"
                      />
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-secondary mt-1">
              * Se nenhum aplicativo for marcado individualmente, a rotina fará backup de todos os apps instalados.
            </p>
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
              disabled={loading}
              className="px-5 py-2 bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Salvar Agendamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
