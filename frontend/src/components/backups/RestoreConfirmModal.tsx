import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, AlertOctagon, Loader2, Sparkles, Sliders, Boxes } from 'lucide-react';

interface RestoreConfirmModalProps {
  backup: {
    filename: string;
    app_name: string;
    size_bytes: number;
    created_at: string;
    target_type?: string;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RestoreConfirmModal({ backup, onClose, onConfirm }: RestoreConfirmModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [confirmedInput, setConfirmedInput] = useState('');

  const isFullSystem = backup.target_type === 'system_full' || backup.filename.includes('system_full');
  const isOrbitConfigs = backup.target_type === 'orbit_configs' || backup.filename.includes('orbit_configs');
  const isAllContainers = backup.target_type === 'all_containers' || backup.filename.includes('all_containers');

  const requiredConfirmation = isFullSystem || isOrbitConfigs || isAllContainers
    ? 'RESTAURAR'
    : backup.app_name;

  const isConfirmed = confirmedInput.trim() === requiredConfirmation || confirmedInput.trim() === backup.app_name;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getScopeBadge = () => {
    if (isFullSystem) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          {t('backups.badge_full_system', 'Sistema Completo')}
        </span>
      );
    }
    if (isOrbitConfigs) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
          <Sliders className="w-3.5 h-3.5" />
          {t('backups.badge_orbit_configs', 'Configurações Orbit')}
        </span>
      );
    }
    if (isAllContainers) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <Boxes className="w-3.5 h-3.5" />
          {t('backups.badge_all_containers', 'Todos os Contêineres')}
        </span>
      );
    }
    return null;
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
              <h3 className="font-bold text-base text-primary">
                {isFullSystem
                  ? t('backups.restore_full_system_title', 'Restaurar Sistema Completo')
                  : t('backups.restore_snapshot_title', 'Restaurar Snapshot')}
              </h3>
              <p className="text-xs text-secondary truncate max-w-[280px]">{backup.filename}</p>
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

        <div className="p-5 space-y-4">
          <div className="bg-accent/40 rounded-xl p-3 border border-border/80 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-secondary">{t('backups.target_app_label', 'Alvo:')}</span>
              <div className="flex items-center gap-2">
                {getScopeBadge()}
                <span className="font-mono font-bold text-primary">{backup.app_name}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t('backups.file_size_label', 'Tamanho do Arquivo:')}</span>
              <span className="font-mono text-primary">{formatBytes(backup.size_bytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t('backups.snapshot_date_label', 'Data do Snapshot:')}</span>
              <span className="text-primary">{backup.created_at}</span>
            </div>
          </div>

          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{t('backups.restore_warning_title', 'Atenção: Ação Destrutiva')}</span>
            </div>
            <p>
              {isFullSystem
                ? t('backups.restore_system_full_warning', 'Esta restauração é global. Ela restaurará todas as credenciais do Orbit, arquivos de integrações e dados de todos os contêineres e stacks gerenciados.')
                : isOrbitConfigs
                ? t('backups.restore_configs_warning', 'Esta restauração restaurará todas as credenciais do Orbit, autenticação, usuários e configurações de integrações.')
                : t('backups.restore_warning_desc', {
                    app: backup.app_name,
                    defaultValue: `A restauração interrompe a stack Docker de ${backup.app_name}, substitui todos os arquivos de configuração e dados persistidos pelos contidos no backup, e reinicia a stack.`
                  })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1.5">
              {t('backups.type_to_confirm', {
                name: requiredConfirmation,
                defaultValue: `Digite ${requiredConfirmation} para confirmar:`
              })}
            </label>
            <input
              type="text"
              value={confirmedInput}
              onChange={(e) => setConfirmedInput(e.target.value)}
              placeholder={requiredConfirmation}
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
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !isConfirmed}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-rose-600/20 hover:shadow-rose-600/30 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? t('backups.restoring', 'Restaurando...') : t('backups.confirm_and_restore', 'Confirmar e Restaurar')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
