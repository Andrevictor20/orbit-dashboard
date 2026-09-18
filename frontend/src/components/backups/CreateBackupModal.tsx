import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Archive, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Sliders, 
  Boxes, 
  Box,
  Check
} from 'lucide-react';

export type BackupScope = 'system_full' | 'saturn_configs' | 'all_containers' | 'single_app';

export interface CreateBackupModalProps {
  apps: string[];
  onClose: () => void;
  onSubmit: (params: { targetType: string; appName?: string; stopContainer?: boolean } | string) => Promise<void>;
}

export function CreateBackupModal({ apps, onClose, onSubmit }: CreateBackupModalProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<BackupScope>('system_full');
  const [selectedApp, setSelectedApp] = useState(apps[0] || '');
  const [customApp, setCustomApp] = useState('');
  const [useCustom, setUseCustom] = useState(apps.length === 0);
  const stopContainer = true;
  const [loading, setLoading] = useState(false);

  const effectiveApp = useCustom ? customApp.trim() : selectedApp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scope === 'single_app' && !effectiveApp) return;

    setLoading(true);
    try {
      await onSubmit({
        targetType: scope,
        appName: scope === 'single_app' ? effectiveApp : undefined,
        stopContainer,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const scopeOptions: {
    id: BackupScope;
    title: string;
    desc: string;
    icon: typeof Sparkles;
    color: string;
    border: string;
    badge?: string;
  }[] = [
    {
      id: 'system_full',
      title: t('backups.scope_full_system', 'Sistema Completo'),
      desc: t('backups.scope_full_system_desc', 'Configurações do Saturn, credenciais, integrações (HA, Cloudflare, Pi-hole, Samba) e todos os contêineres e volumes'),
      icon: Sparkles,
      color: 'text-purple-500 bg-purple-500/10',
      border: 'border-purple-500/30',
      badge: '★ ' + t('common.recommended', 'Recomendado'),
    },
    {
      id: 'saturn_configs',
      title: t('backups.scope_configs_only', 'Configurações & Integrações'),
      desc: t('backups.scope_configs_only_desc', 'Apenas autenticação, 2FA, integrações, links e preferências (instantâneo e leve)'),
      icon: Sliders,
      color: 'text-blue-500 bg-blue-500/10',
      border: 'border-blue-500/30',
    },
    {
      id: 'all_containers',
      title: t('backups.scope_all_containers', 'Todos os Contêineres'),
      desc: t('backups.scope_all_containers_desc', 'Todos os aplicativos gerenciados, compose files, variáveis e dados de /data/apps'),
      icon: Boxes,
      color: 'text-amber-500 bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      id: 'single_app',
      title: t('backups.scope_single_app', 'Contêiner Específico'),
      desc: t('backups.scope_single_app_desc', 'Escolher um aplicativo individual para snapshot pontual'),
      icon: Box,
      color: 'text-emerald-500 bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-saturn-500/10 text-saturn-500 rounded-xl border border-saturn-500/20">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">{t('backups.create_snapshot_modal_title', 'Criar Backup 1-Clique')}</h3>
              <p className="text-xs text-secondary">{t('backups.create_snapshot_modal_desc', 'Compacta /data/apps/<app> e volumes em .tar.gz')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label={t('common.close', 'Fechar')}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2.5">
              {t('backups.backup_scope_label', 'Escopo do Backup')}
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {scopeOptions.map((opt) => {
                const isSelected = scope === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScope(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-saturn-500/10 border-saturn-500 shadow-sm'
                        : 'bg-accent/30 hover:bg-accent/60 border-border/80 text-secondary'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${opt.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-primary/90'}`}>
                          {opt.title}
                        </span>
                        {opt.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                    <div className="absolute right-3 top-3.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected ? 'border-saturn-500 bg-saturn-500 text-white' : 'border-border bg-accent/40'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Single App scope is selected, show app picker */}
          {scope === 'single_app' && (
            <div className="pt-2 border-t border-border space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                {t('backups.select_app_stack', 'Selecione o Aplicativo / Stack')}
              </label>

              {!useCustom && apps.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedApp}
                    onChange={(e) => setSelectedApp(e.target.value)}
                    disabled={loading}
                    className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saturn-500"
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
                    className="text-xs text-saturn-500 hover:underline"
                  >
                    {t('backups.or_enter_manually', 'Ou digite o nome do app manualmente')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={t('backups.app_input_placeholder', 'Ex: nextcloud, jellyfin, vaultwarden...')}
                    value={customApp}
                    onChange={(e) => setCustomApp(e.target.value)}
                    disabled={loading}
                    className="w-full bg-accent/50 border border-border text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saturn-500 font-mono"
                    required
                  />
                  {apps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setUseCustom(false)}
                      className="text-xs text-saturn-500 hover:underline"
                    >
                      {t('backups.back_to_app_list', 'Voltar para lista de aplicativos detectados')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pause notice for consistency */}
          {scope !== 'saturn_configs' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t('backups.backup_pause_notice', 'Para garantir consistência estrita dos dados sem corrupção, os contêineres serão pausados brevemente durante a compactação e reiniciados de imediato.')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-secondary hover:text-primary rounded-xl hover:bg-accent border border-border transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading || (scope === 'single_app' && !effectiveApp)}
              className="px-5 py-2 bg-saturn-500 hover:bg-saturn-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-saturn-500/20 hover:shadow-saturn-500/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? t('backups.compressing', 'Compactando...') : t('backups.start_backup_button', 'Iniciar Backup')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
