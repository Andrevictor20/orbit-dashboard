import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Terminal as TerminalIcon, 
  RefreshCw, 
  AlertTriangle, 
  Copy, 
  CheckCircle2, 
  Download, 
  Trash2, 
  Search, 
  Server, 
  Cpu, 
  Box, 
  Activity, 
  Maximize2, 
  Minimize2, 
  ArrowDown, 
  FileText,
  Clock,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LogsResponse {
  logs: string[];
  source: string;
  available_sources: string[];
  total: number;
}

type LogSource = 'orbit' | 'system' | 'docker' | 'dmesg' | 'all';
type LogLevel = 'all' | 'info' | 'warn' | 'error';

export function Logs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<LogSource>('orbit');
  const [level, setLevel] = useState<LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lineLimit, setLineLimit] = useState<number>(500);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000); // ms, 0 = disabled
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('orbit_token');
      const params = new URLSearchParams({
        source,
        level,
        lines: lineLimit.toString(),
      });
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }

      const res = await fetch(`/api/logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error(`Falha ao buscar logs: ${res.status} ${res.statusText}`);
      const data: LogsResponse = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [source, level, lineLimit, searchQuery]);

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [source, level, lineLimit, searchQuery, autoRefreshInterval]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current?.scrollIntoView) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle ESC for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopied(true);
      toast.success('Logs copiados para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar logs');
    }
  };

  const handleCopyLine = async (line: string, index: number) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopiedLineIndex(index);
      toast.success('Linha copiada!');
      setTimeout(() => setCopiedLineIndex(null), 1500);
    } catch (err) {
      toast.error('Erro ao copiar linha');
    }
  };

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit-${source}-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download do arquivo de log iniciado!');
  };

  const handleClearLogs = async () => {
    const isOrbit = source === 'orbit';
    const confirmMsg = isOrbit
      ? 'Deseja realmente limpar os registros de log do Orbit?'
      : 'Deseja executar a limpeza e compactação de logs (vacuum do journald/sistema) para liberar espaço em disco?';

    if (!window.confirm(confirmMsg)) return;

    setClearing(true);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/logs/clear?source=${source}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        toast.success(isOrbit ? 'Logs do Orbit limpos com sucesso!' : 'Logs limpos e espaço em disco compactado (vacuum)!');
        await fetchLogs(true);
      } else {
        toast.error('Erro ao limpar logs.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao limpar logs.');
    } finally {
      setClearing(false);
    }
  };

  const sourcesList: { id: LogSource; label: string; icon: typeof Server; desc: string }[] = [
    { id: 'orbit', label: 'Orbit Backend', icon: Server, desc: 'Logs da aplicação Orbit, sync da App Store e APIs' },
    { id: 'system', label: 'Sistema Linux', icon: Cpu, desc: 'Logs do sistema operacional via journalctl / syslog' },
    { id: 'docker', label: 'Docker Daemon', icon: Box, desc: 'Eventos e logs do motor Docker' },
    { id: 'dmesg', label: 'Kernel (dmesg)', icon: Activity, desc: 'Mensagens do kernel Linux e hardware' },
    { id: 'all', label: 'Todos (Combinado)', icon: Layers, desc: 'Visão unificada de logs do sistema e da aplicação' },
  ];

  // Calculate error and warning count for summary badges
  const logStats = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const line of logs) {
      if (/error|crit|emerg|failed|fatal|\[err/i.test(line)) {
        errors++;
      } else if (/warn|warning/i.test(line)) {
        warnings++;
      }
    }
    return { errors, warnings };
  }, [logs]);

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#070a0f] p-4 flex flex-col' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orbit-500/10 border border-orbit-500/20 text-orbit-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {t('logs.title')}
                </h1>
                <p className="text-secondary text-xs sm:text-sm mt-0.5">
                  {t('logs.subtitle')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-accent text-secondary hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
              title={t('common.copy')}
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('common.copied') : t('common.copy')}</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-accent text-secondary hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
              title={t('common.download')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('common.download')}</span>
            </button>

            <button
              onClick={handleClearLogs}
              disabled={clearing}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 text-secondary transition-all text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
              title={t('common.clear')}
            >
              <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{t('common.clear')}</span>
            </button>

            <button
              onClick={() => fetchLogs(true)}
              disabled={loading}
              className="px-3.5 py-1.5 bg-orbit-600 hover:bg-orbit-500 text-white rounded-xl transition-all shadow-md shadow-orbit-900/20 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              title={t('common.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sources Tabs */}
      {!isFullscreen && (
        <div className="flex space-x-1.5 bg-card/70 border border-border/80 rounded-2xl p-1.5 overflow-x-auto scrollbar-none backdrop-blur-md">
          {sourcesList.map((s) => {
            const Icon = s.icon;
            const isActive = source === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`flex-1 min-w-[130px] sm:min-w-[150px] flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-orbit-600 text-white shadow-md shadow-orbit-900/30'
                    : 'text-secondary hover:text-primary hover:bg-white/5'
                }`}
                title={s.desc}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Controls & Filter Bar */}
      {!isFullscreen && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/90 border border-border rounded-2xl p-3 backdrop-blur-md shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar texto ou palavra-chave (ex: error, port, restart)..."
              className="w-full bg-background/80 border border-border rounded-xl pl-9 pr-8 py-1.5 text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 font-mono transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Level Filter */}
            <div className="flex items-center gap-1 bg-background/80 border border-border rounded-xl p-1">
              {(['all', 'info', 'warn', 'error'] as LogLevel[]).map((lvl) => {
                const isActive = level === lvl;
                const labels = { all: 'Todos', info: 'Info', warn: 'Avisos', error: 'Erros' };
                return (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      isActive
                        ? lvl === 'error'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : lvl === 'warn'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : lvl === 'info'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-orbit-600 text-white shadow-sm'
                        : 'text-secondary hover:text-primary hover:bg-white/5'
                    }`}
                  >
                    {labels[lvl]}
                  </button>
                );
              })}
            </div>

            {/* Lines Limit */}
            <div className="flex items-center gap-1.5 text-xs text-secondary bg-background/80 border border-border rounded-xl px-2.5 py-1">
              <span className="text-[11px] font-medium">Linhas:</span>
              <select
                value={lineLimit}
                onChange={(e) => setLineLimit(Number(e.target.value))}
                className="bg-transparent text-xs text-primary focus:outline-none font-mono cursor-pointer"
              >
                <option value={100} className="bg-card text-primary">100</option>
                <option value={250} className="bg-card text-primary">250</option>
                <option value={500} className="bg-card text-primary">500</option>
                <option value={1000} className="bg-card text-primary">1000</option>
                <option value={2000} className="bg-card text-primary">2000</option>
              </select>
            </div>

            {/* Auto Refresh Select */}
            <div className="flex items-center gap-1.5 text-xs text-secondary bg-background/80 border border-border rounded-xl px-2.5 py-1">
              <Clock className="w-3 h-3 text-orbit-500" />
              <span className="text-[11px] font-medium">Auto:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-xs text-primary focus:outline-none font-mono cursor-pointer"
              >
                <option value={0} className="bg-card text-primary">Desativado</option>
                <option value={2000} className="bg-card text-primary">2s</option>
                <option value={5000} className="bg-card text-primary">5s</option>
                <option value={10000} className="bg-card text-primary">10s</option>
              </select>
            </div>

            {/* Auto scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all ${
                autoScroll
                  ? 'bg-orbit-500/15 text-orbit-600 dark:text-orbit-300 border-orbit-500/30'
                  : 'bg-background/80 text-secondary border-border hover:text-primary'
              }`}
              title="Rolar automaticamente para o final ao receber novos logs"
            >
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Modern Terminal / Log Viewer Frame */}
      <div className={`bg-card rounded-2xl border border-border/80 shadow-2xl overflow-hidden flex flex-col relative ${
        isFullscreen ? 'flex-1 h-full' : 'h-[66vh]'
      }`}>
        {/* Integrated Console Header */}
        <div className="h-11 bg-muted/70 border-b border-border/70 px-3 sm:px-4 flex items-center justify-between gap-3 select-none shrink-0">
          {/* Left: System Breadcrumb & Source Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                autoRefreshInterval > 0 && !loading ? 'bg-emerald-500 animate-pulse' : 'bg-orbit-500'
              }`} />
              <TerminalIcon className="w-3.5 h-3.5 text-orbit-500 shrink-0" />
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs truncate">
              <span className="text-secondary hidden sm:inline">orbit@host:</span>
              <span className="text-orbit-600 dark:text-orbit-300 font-semibold px-2 py-0.5 rounded-md bg-orbit-500/10 border border-orbit-500/20">
                /var/log/{source}
              </span>
            </div>

            {/* Quick stats tags */}
            {logStats.errors > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-[10px] font-mono">
                {logStats.errors} erros
              </span>
            )}
            {logStats.warnings > 0 && (
              <span className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[10px] font-mono">
                {logStats.warnings} avisos
              </span>
            )}
          </div>

          {/* Right: Counter, Status & Quick Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 font-mono text-[11px] text-secondary">
              <span className="px-2 py-0.5 rounded bg-accent border border-border/60 hidden sm:inline">
                {logs.length} linhas
              </span>
              {loading && (
                <span className="text-orbit-500 flex items-center gap-1 text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Atualizando...</span>
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

            {/* Console Toolbar buttons */}
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1 disabled:opacity-40"
              title="Copiar todos os logs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Copiar</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1 disabled:opacity-40"
              title="Baixar arquivo de log"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Baixar</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1"
              title={isFullscreen ? "Sair da tela cheia (Esc)" : "Expandir em tela cheia"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Console Content Body */}
        {error ? (
          <div className="flex-1 flex items-center justify-center p-8 text-rose-500 gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Falha ao carregar logs</p>
              <p className="text-xs text-rose-600 dark:text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div 
            ref={logsContainerRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs text-primary space-y-0.5 scrollbar-thin select-text bg-card"
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-secondary space-y-2 py-16">
                <TerminalIcon className="w-8 h-8 stroke-1 text-secondary/60" />
                <p className="italic text-xs">Nenhum registro de log encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              logs.map((line, i) => {
                const isError = /error|crit|emerg|failed|fatal|\[err/i.test(line);
                const isWarn = /warn|warning/i.test(line);
                const isDebug = /debug/i.test(line);
                const isInfo = /info/i.test(line);

                let textColor = 'text-primary';
                let badgeColor = 'bg-accent text-secondary border-border/70';
                let badgeText = 'LOG';

                if (isError) {
                  textColor = 'text-rose-600 dark:text-rose-300 font-medium';
                  badgeColor = 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30';
                  badgeText = 'ERR';
                } else if (isWarn) {
                  textColor = 'text-amber-600 dark:text-amber-300 font-medium';
                  badgeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
                  badgeText = 'WRN';
                } else if (isDebug) {
                  textColor = 'text-purple-600 dark:text-purple-300';
                  badgeColor = 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
                  badgeText = 'DBG';
                } else if (isInfo) {
                  textColor = 'text-emerald-600 dark:text-emerald-300/90';
                  badgeColor = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
                  badgeText = 'INF';
                }

                const isLineCopied = copiedLineIndex === i;

                return (
                  <div 
                    key={i} 
                    className="flex items-start gap-2.5 py-0.5 px-2 rounded-lg hover:bg-accent/60 transition-colors group relative"
                  >
                    {/* Line number */}
                    <span className="text-[10px] text-secondary/60 select-none font-mono w-9 text-right shrink-0 pt-0.5 font-medium">
                      {i + 1}
                    </span>

                    {/* Level Tag */}
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border select-none shrink-0 tracking-wider ${badgeColor}`}>
                      {badgeText}
                    </span>

                    {/* Log Text Content */}
                    <span className={`flex-1 break-all whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed ${textColor}`}>
                      {line}
                    </span>

                    {/* Quick copy single line button */}
                    <button
                      onClick={() => handleCopyLine(line, i)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-secondary hover:text-primary bg-card hover:bg-accent rounded border border-border/70 transition-all shrink-0 select-none shadow-sm"
                      title="Copiar esta linha"
                    >
                      {isLineCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Floating scroll to bottom button */}
        {!autoScroll && logs.length > 50 && (
          <button
            onClick={() => {
              if (logsEndRef.current?.scrollIntoView) {
                logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-orbit-600/90 hover:bg-orbit-500 text-white text-xs font-medium shadow-lg shadow-black/50 border border-orbit-400/30 flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95 z-10"
            title="Ir para o final dos logs"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Fim dos logs</span>
          </button>
        )}
      </div>
    </div>
  );
}
