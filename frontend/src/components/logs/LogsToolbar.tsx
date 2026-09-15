import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Copy,
  CheckCircle2,
  Download,
  Trash2,
  Search,
  Server,
  Cpu,
  Box,
  Activity,
  Clock,
  Layers,
} from 'lucide-react';

type LogSource = 'orbit' | 'system' | 'docker' | 'dmesg' | 'all';
type LogLevel = 'all' | 'info' | 'warn' | 'error';

interface LogsToolbarProps {
  source: LogSource;
  level: LogLevel;
  searchQuery: string;
  lineLimit: number;
  autoRefreshInterval: number;
  autoScroll: boolean;
  loading: boolean;
  clearing: boolean;
  copied: boolean;
  onSourceChange: (s: LogSource) => void;
  onLevelChange: (l: LogLevel) => void;
  onSearchChange: (q: string) => void;
  onLineLimitChange: (n: number) => void;
  onAutoRefreshChange: (n: number) => void;
  onAutoScrollToggle: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
  onRefresh: () => void;
}

export function LogsToolbar({
  source, level, searchQuery, lineLimit, autoRefreshInterval, autoScroll,
  loading, clearing, copied,
  onSourceChange, onLevelChange, onSearchChange, onLineLimitChange,
  onAutoRefreshChange, onAutoScrollToggle, onCopy, onDownload, onClear, onRefresh,
}: LogsToolbarProps) {
  const { t } = useTranslation();

  const sourcesList = [
    { id: 'orbit' as const, label: 'Orbit Backend', icon: Server, desc: t('logs.source_orbit_desc', 'Logs da aplicação Orbit, sync da App Store e APIs') },
    { id: 'system' as const, label: t('logs.source_system_label', 'Sistema Linux'), icon: Cpu, desc: t('logs.source_system_desc', 'Logs do sistema operacional via journalctl / syslog') },
    { id: 'docker' as const, label: 'Docker Daemon', icon: Box, desc: t('logs.source_docker_desc', 'Eventos e logs do motor Docker') },
    { id: 'dmesg' as const, label: 'Kernel (dmesg)', icon: Activity, desc: t('logs.source_kernel_desc', 'Mensagens do kernel Linux e hardware') },
    { id: 'all' as const, label: t('logs.source_all_label', 'Todos (Combinado)'), icon: Layers, desc: t('logs.source_all_desc', 'Visão unificada de logs do sistema e da aplicação') },
  ];

  const levelLabels: Record<LogLevel, string> = {
    all: t('common.all', 'Todos'),
    info: 'Info',
    warn: t('logs.level_warn_short', 'Avisos'),
    error: t('logs.level_error_short', 'Erros'),
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs sm:text-sm text-secondary">{t('logs.subtitle')}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onCopy} title={t('common.copy', 'Copiar')} className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary transition-all text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 shadow-sm">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('common.copied') : t('common.copy')}</span>
          </button>
          <button onClick={onDownload} className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <Download className="w-3.5 h-3.5" />
            <span>{t('common.download')}</span>
          </button>
          <button onClick={onClear} disabled={clearing} className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/40 text-slate-700 dark:text-secondary transition-all text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 shadow-sm">
            <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
            <span>{t('common.clear')}</span>
          </button>
          <button onClick={onRefresh} disabled={loading} className="px-3.5 py-1.5 bg-orbit-600 hover:bg-orbit-500 text-white rounded-xl transition-all shadow-md shadow-orbit-900/20 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 active:scale-95">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex space-x-1.5 bg-card/70 border border-border/80 rounded-2xl p-1.5 overflow-x-auto scrollbar-none backdrop-blur-md">
        {sourcesList.map((s) => {
          const Icon = s.icon;
          const isActive = source === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSourceChange(s.id)}
              className={`flex-1 min-w-[130px] sm:min-w-[150px] flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-xl transition-all ${
                isActive ? 'bg-orbit-600 text-white shadow-md shadow-orbit-900/30' : 'text-secondary hover:text-primary hover:bg-white/5'
              }`}
              title={s.desc}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/90 border border-border rounded-2xl p-3 backdrop-blur-md shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('logs.search_placeholder_short', 'Filtrar texto ou palavra-chave (ex: error, port, restart)...')}
            className="w-full bg-background/80 border border-border rounded-xl pl-9 pr-8 py-1.5 text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 font-mono transition-colors"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary px-1">✕</button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-background/80 border border-border rounded-xl p-1">
            {(['all', 'info', 'warn', 'error'] as LogLevel[]).map((lvl) => {
              const isActive = level === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => onLevelChange(lvl)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    isActive
                      ? lvl === 'error' ? 'bg-rose-600 text-white shadow-sm'
                        : lvl === 'warn' ? 'bg-amber-600 text-white shadow-sm'
                        : lvl === 'info' ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-orbit-600 text-white shadow-sm'
                      : 'text-secondary hover:text-primary hover:bg-white/5'
                  }`}
                >
                  {levelLabels[lvl]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-secondary bg-background/80 border border-border rounded-xl px-2.5 py-1">
            <span className="text-[11px] font-medium">{t('logs.lines_short', 'Linhas:')}</span>
            <select value={lineLimit} onChange={(e) => onLineLimitChange(Number(e.target.value))} className="bg-transparent text-xs text-primary focus:outline-none font-mono cursor-pointer">
              {[100, 250, 500, 1000, 2000].map(n => <option key={n} value={n} className="bg-card text-primary">{n}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-secondary bg-background/80 border border-border rounded-xl px-2.5 py-1">
            <Clock className="w-3 h-3 text-orbit-500" />
            <span className="text-[11px] font-medium">Auto:</span>
            <select value={autoRefreshInterval} onChange={(e) => onAutoRefreshChange(Number(e.target.value))} className="bg-transparent text-xs text-primary focus:outline-none font-mono cursor-pointer">
              <option value={0} className="bg-card text-primary">{t('common.disabled', 'Desativado')}</option>
              <option value={2000} className="bg-card text-primary">2s</option>
              <option value={5000} className="bg-card text-primary">5s</option>
              <option value={10000} className="bg-card text-primary">10s</option>
            </select>
          </div>

          <button
            onClick={onAutoScrollToggle}
            className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all ${
              autoScroll
                ? 'bg-orbit-500/15 text-orbit-600 dark:text-orbit-300 border-orbit-500/30'
                : 'bg-background/80 text-secondary border-border hover:text-primary'
            }`}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </>
  );
}

export type { LogSource, LogLevel };
