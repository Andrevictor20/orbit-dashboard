import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Cpu, Activity, Terminal, RefreshCw } from 'lucide-react';
import { formatRAM } from '../../utils/format';
import { ContainerIcon } from '../ui/ContainerIcon';
import { resolveProcessAppInfo } from '../../utils/processAppResolver';
import type { ProcessInfo } from '../metrics/ProcessMonitor';

interface TopProcessesCardViewProps {
  type: 'cpu' | 'ram';
  processes: ProcessInfo[];
  containers: any[];
  loading: boolean;
  onBack: () => void;
  isConnected?: boolean;
}

export function TopProcessesCardView({
  type,
  processes,
  containers,
  loading,
  onBack,
  isConnected = true,
}: TopProcessesCardViewProps) {
  const { t } = useTranslation();
  const isCpu = type === 'cpu';

  return (
    <div className="flex flex-col justify-between h-full min-h-[180px] animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`p-1 rounded-md ${
              isCpu ? 'bg-violet-500/15 text-violet-500' : 'bg-emerald-500/15 text-emerald-500'
            }`}
          >
            {isCpu ? <Cpu className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-semibold text-primary truncate">
            {isCpu
              ? t('dashboard.top_processes_cpu', 'Top 5 Processos (CPU)')
              : t('dashboard.top_processes_ram', 'Top 5 Processos (RAM)')}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBack();
          }}
          className="px-2 py-0.5 rounded-lg bg-accent/70 hover:bg-accent text-secondary hover:text-primary border border-border/60 text-[10px] font-medium transition-all active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
          title={t('common.back', 'Voltar')}
          aria-label={t('common.back', 'Voltar')}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>{t('common.back', 'Voltar')}</span>
        </button>
      </div>

      {/* Body List */}
      <div className="my-1.5 space-y-1.5 flex-1 overflow-y-auto max-h-[170px] pr-0.5 custom-scrollbar">
        {loading && processes.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-secondary gap-1.5">
            <RefreshCw className="w-4 h-4 animate-spin text-saturn-500" />
            <span className="text-[11px] font-medium">Carregando processos...</span>
          </div>
        ) : processes.length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary">
            {t('dashboard.no_processes_found', 'Nenhum processo encontrado.')}
          </div>
        ) : (
          processes.slice(0, 5).map((proc, index) => {
            const app = resolveProcessAppInfo(proc, containers);
            const usagePercent = isCpu
              ? Math.min(proc.cpu_usage, 100)
              : Math.min(proc.memory_percent, 100);

            return (
              <div
                key={proc.pid}
                className="p-1.5 rounded-xl bg-accent/40 hover:bg-accent/70 border border-border/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-bold text-secondary/70 w-3.5 text-center shrink-0">
                      #{index + 1}
                    </span>

                    {/* App or Host Icon */}
                    {app.isHost && !app.iconUrl ? (
                      <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/40">
                        <Terminal className="w-3 h-3 text-secondary" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-muted/40 border border-border/40">
                        <ContainerIcon
                          src={app.iconUrl}
                          name={app.displayName}
                          image={app.containerImage}
                          size={18}
                          className="w-full h-full"
                        />
                      </div>
                    )}

                    {/* App Name and Subtitle */}
                    <div className="min-w-0 flex-1 leading-tight">
                      <span
                        className="text-xs font-semibold text-primary truncate block"
                        title={app.displayName}
                      >
                        {app.displayName}
                      </span>
                      <span
                        className="text-[9.5px] text-secondary font-mono truncate block"
                        title={app.subtitle}
                      >
                        {app.subtitle}
                      </span>
                    </div>
                  </div>

                  {/* Metric Value */}
                  <div className="text-right shrink-0">
                    {isCpu ? (
                      <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                        {proc.cpu_usage.toFixed(1)}%
                      </span>
                    ) : (
                      <div>
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRAM(proc.memory_rss)}
                        </span>
                        <span className="text-[9px] text-secondary font-mono block">
                          ({proc.memory_percent.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-muted/60 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCpu
                        ? usagePercent > 70
                          ? 'bg-rose-500'
                          : usagePercent > 40
                          ? 'bg-amber-500'
                          : 'bg-violet-500'
                        : usagePercent > 70
                        ? 'bg-rose-500'
                        : usagePercent > 40
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(usagePercent, 2)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-secondary font-mono pt-1 border-t border-border/40">
        <span className="flex items-center gap-1 text-[10px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          {isConnected ? t('dashboard.realtime', 'Tempo real') : t('dashboard.offline', 'Offline')}
        </span>
        <Link
          to="/metrics"
          className="flex items-center gap-1 text-[10px] font-semibold text-saturn-600 dark:text-saturn-400 hover:underline"
        >
          <span>{t('dashboard.view_all_processes', 'Ver monitor')}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}
