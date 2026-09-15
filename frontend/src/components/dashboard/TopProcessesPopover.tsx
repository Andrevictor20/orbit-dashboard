import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink, Cpu, Activity, Box, RefreshCw } from 'lucide-react';
import { formatRAM } from '../../utils/format';
import type { ProcessInfo } from '../metrics/ProcessMonitor';

interface TopProcessesPopoverProps {
  type: 'cpu' | 'ram';
  isOpen: boolean;
  onClose: () => void;
}

export function TopProcessesPopover({ type, isOpen, onClose }: TopProcessesPopoverProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch processes on open and every 3 seconds while open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchTop = async () => {
      try {
        const res = await fetch('/api/system/processes');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const list: ProcessInfo[] = data.processes || [];
        if (type === 'cpu') {
          list.sort((a, b) => b.cpu_usage - a.cpu_usage);
        } else {
          list.sort((a, b) => b.memory_rss - a.memory_rss);
        }
        setProcesses(list.slice(0, 5));
      } catch {
        // graceful
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTop();
    const interval = setInterval(fetchTop, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, type]);

  // Click outside and Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCpu = type === 'cpu';
  const title = isCpu
    ? t('dashboard.top_processes_cpu', 'Top 5 Processos (CPU)')
    : t('dashboard.top_processes_ram', 'Top 5 Processos (RAM)');

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-12 right-2 z-50 w-72 sm:w-80 bg-card/95 backdrop-blur-2xl border border-border/90 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-primary animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/70">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isCpu ? 'bg-violet-500/15 text-violet-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
            {isCpu ? <Cpu className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-primary tracking-tight">{title}</h4>
            <span className="text-[10px] text-secondary font-mono">Consumo em tempo real</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
          aria-label={t('common.close', 'Fechar')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body List */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
        {loading && processes.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-secondary gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-orbit-500" />
            <span className="text-xs">Identificando processos...</span>
          </div>
        ) : processes.length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary">
            {t('dashboard.no_processes_found', 'Nenhum processo em execução encontrado.')}
          </div>
        ) : (
          processes.map((proc, index) => {
            const usagePercent = isCpu
              ? Math.min(proc.cpu_usage, 100)
              : Math.min(proc.memory_percent, 100);

            return (
              <div
                key={proc.pid}
                className="p-2 rounded-xl bg-accent/40 border border-border/50 hover:bg-accent/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 text-[10px] font-mono font-bold text-secondary text-center">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-semibold text-primary truncate max-w-[120px] sm:max-w-[140px]" title={proc.name}>
                      {proc.name}
                    </span>
                    {proc.container_name && (
                      <span className="px-1.5 py-0.2 rounded bg-orbit-500/15 text-orbit-700 dark:text-orbit-300 border border-orbit-500/30 text-[9px] font-mono font-semibold truncate max-w-[70px] flex items-center gap-0.5">
                        <Box className="w-2.5 h-2.5 shrink-0" />
                        {proc.container_name}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {isCpu ? (
                      <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                        {proc.cpu_usage.toFixed(1)}%
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRAM(proc.memory_rss)}
                        </span>
                        <span className="text-[10px] text-secondary font-mono">
                          ({proc.memory_percent.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCpu
                        ? usagePercent > 70 ? 'bg-rose-500' : usagePercent > 40 ? 'bg-amber-500' : 'bg-violet-500'
                        : usagePercent > 70 ? 'bg-rose-500' : usagePercent > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(usagePercent, 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-secondary/80 font-mono mt-0.5">
                  <span>PID: {proc.pid}</span>
                  <span>{proc.status || 'running'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="pt-2.5 mt-2.5 border-t border-border/70 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            navigate('/metrics');
          }}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-orbit-600 dark:text-orbit-400 hover:text-orbit-700 dark:hover:text-orbit-300 hover:underline"
        >
          <span>{t('dashboard.view_all_processes', 'Ver monitor de processos completo')}</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
