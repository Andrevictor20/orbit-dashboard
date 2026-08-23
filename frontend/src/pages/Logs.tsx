import { useEffect, useState, useRef } from 'react';
import { Terminal as TerminalIcon, RefreshCw, AlertTriangle, Copy, CheckCircle2, Download, Trash2, Search, Server, Cpu, Box, Activity } from 'lucide-react';
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
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

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

  const handleClearOrbitLogs = async () => {
    if (source !== 'orbit' && source !== 'all') {
      toast.error('Apenas os logs do Orbit podem ser limpos.');
      return;
    }
    if (!window.confirm('Deseja realmente limpar os registros de log do Orbit?')) return;

    setClearing(true);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/logs/clear', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        toast.success('Logs do Orbit limpos com sucesso!');
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

  const sourcesList: { id: LogSource; label: string; icon: any; desc: string }[] = [
    { id: 'orbit', label: 'Orbit Backend', icon: Server, desc: 'Logs da aplicação Orbit, sync da App Store e APIs' },
    { id: 'system', label: 'Sistema Linux', icon: Cpu, desc: 'Logs do sistema operacional via journalctl / syslog' },
    { id: 'docker', label: 'Docker Daemon', icon: Box, desc: 'Eventos e logs do motor Docker' },
    { id: 'dmesg', label: 'Kernel (dmesg)', icon: Activity, desc: 'Mensagens do kernel Linux e hardware' },
    { id: 'all', label: 'Todos (Combinado)', icon: TerminalIcon, desc: 'Visão unificada de logs do sistema e da aplicação' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <TerminalIcon className="w-7 h-7 text-orbit-500" />
            Logs do Sistema e do Orbit
          </h1>
          <p className="text-secondary text-xs sm:text-sm mt-1">
            Monitoramento em tempo real de logs da aplicação Orbit, sistema Linux, Docker daemon e kernel.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-accent text-secondary hover:text-primary transition-colors text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
            title="Copiar todos os logs visíveis"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-accent text-secondary hover:text-primary transition-colors text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
            title="Baixar arquivo de log (.log)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar</span>
          </button>

          {(source === 'orbit' || source === 'all') && (
            <button
              onClick={handleClearOrbitLogs}
              disabled={clearing}
              className="px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 text-secondary transition-colors text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
              title="Limpar arquivo de log do Orbit"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}

          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="px-3.5 py-1.5 bg-orbit-600 hover:bg-orbit-500 text-white rounded-lg transition-all shadow-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            title="Atualizar logs agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Sources Tabs */}
      <div className="flex space-x-1.5 bg-card/60 border border-border/80 rounded-xl p-1.5 overflow-x-auto scrollbar-none">
        {sourcesList.map((s) => {
          const Icon = s.icon;
          const isActive = source === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={`flex-1 min-w-[130px] sm:min-w-[150px] flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all ${
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

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar texto ou palavra-chave..."
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Level Filter */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
            {(['all', 'info', 'warn', 'error'] as LogLevel[]).map((lvl) => {
              const isActive = level === lvl;
              const labels = { all: 'Todos', info: 'Info', warn: 'Avisos', error: 'Erros' };
              return (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                    isActive
                      ? lvl === 'error'
                        ? 'bg-rose-600 text-white shadow'
                        : lvl === 'warn'
                        ? 'bg-amber-600 text-white shadow'
                        : lvl === 'info'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-accent text-primary shadow'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {labels[lvl]}
                </button>
              );
            })}
          </div>

          {/* Lines Limit */}
          <div className="flex items-center gap-1.5 text-xs text-secondary">
            <span>Linhas:</span>
            <select
              value={lineLimit}
              onChange={(e) => setLineLimit(Number(e.target.value))}
              className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-orbit-500 font-mono"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
            </select>
          </div>

          {/* Auto Refresh Select */}
          <div className="flex items-center gap-1.5 text-xs text-secondary">
            <span>Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-orbit-500 font-mono"
            >
              <option value={0}>Desativado</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>

          {/* Auto scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
              autoScroll
                ? 'bg-orbit-500/20 text-orbit-300 border-orbit-500/40'
                : 'bg-background text-secondary border-border hover:text-primary'
            }`}
            title="Rolar automaticamente para o final dos logs"
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="bg-[#090d16] rounded-2xl border border-border/80 shadow-2xl overflow-hidden flex flex-col h-[65vh] relative">
        {/* Terminal Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-border/60 text-xs text-secondary">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <div className="flex gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-zinc-400">orbit@host:</span>
            <span className="text-orbit-400 font-semibold">/var/log/{source}</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>{logs.length} linhas exibidas</span>
            {loading && <span className="text-orbit-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...</span>}
          </div>
        </div>

        {/* Terminal Body */}
        {error ? (
          <div className="flex items-center justify-center p-8 text-rose-400 gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Falha ao carregar logs</p>
              <p className="text-xs text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div 
            ref={logsContainerRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs text-zinc-300 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 py-12">
                <TerminalIcon className="w-8 h-8 stroke-1" />
                <p className="italic text-xs">Nenhum registro de log encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              logs.map((line, i) => {
                const isError = /error|crit|emerg|failed|fatal|\[err/i.test(line);
                const isWarn = /warn|warning/i.test(line);
                const isDebug = /debug/i.test(line);
                const isInfo = /info/i.test(line);

                let textColor = 'text-zinc-300';
                let badgeColor = 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60';
                let badgeText = 'LOG';

                if (isError) {
                  textColor = 'text-rose-300 font-medium';
                  badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                  badgeText = 'ERR';
                } else if (isWarn) {
                  textColor = 'text-amber-300';
                  badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                  badgeText = 'WRN';
                } else if (isDebug) {
                  textColor = 'text-purple-300';
                  badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                  badgeText = 'DBG';
                } else if (isInfo) {
                  textColor = 'text-emerald-300/90';
                  badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                  badgeText = 'INF';
                }

                return (
                  <div key={i} className="flex items-start gap-2.5 py-0.5 px-2 rounded hover:bg-white/[0.04] transition-colors group">
                    <span className="text-[10px] text-zinc-600 select-none font-mono w-8 text-right shrink-0 pt-0.5">{i + 1}</span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border select-none shrink-0 ${badgeColor}`}>{badgeText}</span>
                    <span className={`flex-1 break-all whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed ${textColor}`}>
                      {line}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

