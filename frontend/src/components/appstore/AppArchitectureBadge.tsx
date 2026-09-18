import { memo } from 'react';
import { Cpu, AlertTriangle, Check, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseAppArchitectures, isArchCompatibleWithHost } from '../../utils/architecture';

interface AppArchitectureBadgeProps {
  architectures?: string[];
  hostArch?: string;
  mode?: 'compact' | 'detailed';
  className?: string;
}

export const AppArchitectureBadge = memo(function AppArchitectureBadge({
  architectures,
  hostArch,
  mode = 'compact',
  className = '',
}: AppArchitectureBadgeProps) {
  const { t } = useTranslation();
  const archInfo = parseAppArchitectures(architectures);
  const compat = isArchCompatibleWithHost(archInfo, hostArch);

  if (mode === 'compact') {
    // If host is explicitly incompatible, prioritize the incompatibility badge
    if (compat.severity === 'incompatible') {
      return (
        <span
          data-testid="arch-badge-incompatible"
          title={compat.warningMessage}
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-full shadow-sm ${className}`}
        >
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>{t('store.arch_incompatible_short', 'Incompatível')}</span>
        </span>
      );
    }

    if (archInfo.isOnlyX86) {
      return (
        <span
          data-testid="arch-badge-only-x86"
          title={t('store.arch_warning_only_x86', 'Aviso: Este aplicativo não possui suporte para ARM (Raspberry Pi/ARM64). Requer arquitetura x86_64.')}
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full shadow-sm ${className}`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span>x86_64</span>
        </span>
      );
    }

    if (archInfo.isOnlyArm) {
      return (
        <span
          data-testid="arch-badge-only-arm"
          title={t('store.arch_warning_only_arm', 'Aviso: Este aplicativo foi desenvolvido exclusivamente para arquiteturas ARM. Não suporta processadores x86.')}
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-full shadow-sm ${className}`}
        >
          <AlertTriangle className="w-3 h-3 text-purple-500 shrink-0" />
          <span>ARM64</span>
        </span>
      );
    }

    // Multi-Arch
    return (
      <span
        data-testid="arch-badge-multi"
        title={t('store.arch_multi_tooltip', 'Compatível com arquiteturas x86_64 e ARM64')}
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 rounded-full ${className}`}
      >
        <Cpu className="w-3 h-3 text-sky-500 shrink-0" />
        <span>x86 / ARM</span>
      </span>
    );
  }

  // Detailed mode for AppDetail
  return (
    <div className={`space-y-3 ${className}`} data-testid="arch-detailed-view">
      <div className="flex items-center gap-3 flex-wrap">
        {/* x86_64 Support Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            archInfo.supportsX86
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20 line-through'
          }`}
        >
          {archInfo.supportsX86 ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <X className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>x86_64 (Intel / AMD)</span>
        </div>

        {/* ARM64 Support Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            archInfo.supportsArm
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20 line-through'
          }`}
        >
          {archInfo.supportsArm ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <X className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>ARM64 (Raspberry Pi / ARM)</span>
        </div>
      </div>

      {/* Warning Notice Banner if app is restricted or incompatible */}
      {compat.severity === 'incompatible' && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-left">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-500">
              {t('store.arch_incompatible_title', 'Aviso de Incompatibilidade de Hardware')}
            </h4>
            <p className="text-xs text-secondary mt-0.5 leading-relaxed">
              {compat.warningMessage}
            </p>
          </div>
        </div>
      )}

      {compat.severity === 'warning' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {t('store.arch_notice_title', 'Aviso de Compatibilidade de Arquitetura')}
            </h4>
            <p className="text-xs text-secondary mt-0.5 leading-relaxed">
              {compat.warningMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
