import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Check, Settings2, X, Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface PortConflictItem {
  host_port: number;
  container_port: number;
  protocol: string;
  in_use: boolean;
  in_use_by: string | null;
  suggested_port: number;
}

export interface PortConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  conflicts: PortConflictItem[];
  onAcceptSuggested: () => void;
  onOpenCustom: () => void;
  installing?: boolean;
}

export function PortConflictDialog({
  isOpen,
  onClose,
  appName,
  conflicts,
  onAcceptSuggested,
  onOpenCustom,
  installing = false,
}: PortConflictDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const onlyInUse = conflicts.filter(c => c.in_use);

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden animate-slide-up my-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-card/80 backdrop-blur-md shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-primary text-base sm:text-lg leading-tight">
                {t('store.portConflictTitle', 'Conflito de Portas Detectado')}
              </h3>
              <p className="text-xs sm:text-sm text-secondary mt-1">
                {t('store.portConflictDesc', {
                  appName,
                  defaultValue: `Portas solicitadas por ${appName} já estão em uso no sistema.`
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={installing}
            className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors shrink-0 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-secondary">
            {t('store.portConflictSuggestionIntro', 'Detectamos que a(s) seguinte(s) porta(s) estão ocupadas. Calculamos a porta livre mais próxima para evitar falha na instalação:')}
          </p>

          <div className="space-y-2.5">
            {onlyInUse.map((conflict, idx) => (
              <div 
                key={idx}
                className="rounded-xl p-3.5 bg-accent/40 border border-border/80 flex items-center justify-between gap-3"
              >
                {/* Current occupied port */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-rose-500 dark:text-rose-400">
                      {conflict.host_port}
                    </span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/20 uppercase">
                      {t('store.portOccupied', 'Ocupada')}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-0.5 truncate" title={conflict.in_use_by || undefined}>
                    {conflict.in_use_by || t('store.portInUseGeneral', 'Em uso no host')}
                  </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-secondary px-1">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Suggested port */}
                <div className="min-w-0 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                      {t('store.portSuggestedBadge', 'Livre mais próxima')}
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {conflict.suggested_port}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    {t('store.portAvailable', 'Disponível')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-orbit-500/10 border border-orbit-500/20 rounded-xl text-xs text-slate-700 dark:text-orbit-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-orbit-500 shrink-0 mt-0.5" />
            <span>
              {t(
                'store.portConflictAutoTip',
                'Ao clicar em "Instalar com Porta Sugerida", o Orbit remapeia automaticamente os serviços para as portas disponíveis sem precisar baixar imagens novamente.'
              )}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-border/60 flex flex-wrap items-center justify-between gap-2.5 bg-card/60 shrink-0">
          <button
            onClick={onClose}
            disabled={installing}
            className="px-3.5 py-2 text-xs sm:text-sm font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl border border-border transition-colors disabled:opacity-50"
          >
            {t('common.cancel', 'Cancelar')}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCustom}
              disabled={installing}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium bg-accent hover:bg-accent/80 text-primary rounded-xl border border-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Settings2 className="w-4 h-4 text-secondary" />
              <span>{t('store.customizeInstall', 'Personalizar')}</span>
            </button>

            <button
              onClick={onAcceptSuggested}
              disabled={installing}
              className="px-4 py-2 text-xs sm:text-sm font-medium bg-orbit-600 hover:bg-orbit-500 active:scale-95 text-white rounded-xl shadow-md shadow-orbit-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {installing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{t('store.installWithSuggested', 'Instalar com Porta Sugerida')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
