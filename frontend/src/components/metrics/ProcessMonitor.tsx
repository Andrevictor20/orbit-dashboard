import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, RefreshCw, Cpu, HardDrive, Filter, 
  Terminal, ShieldAlert, X, Layers, Box, Monitor, AlertTriangle, 
  ChevronUp, ChevronDown, Info, Trash2, CheckCircle2
} from 'lucide-react';
import { formatRAM, formatBytes } from '../../utils/format';

export interface ProcessInfo {
  pid: number;
  ppid?: number;
  name: string;
  cmd: string[];
  exe?: string;
  user?: string;
  cpu_usage: number;
  memory_rss: number;
  memory_vms: number;
  memory_percent: number;
  status: string;
  is_kernel_thread?: boolean;
  container_id?: string;
  container_name?: string;
  start_time: number;
  disk_read_bytes: number;
  disk_written_bytes: number;
}

export interface TopProcessSummary {
  pid: number;
  name: string;
  value: number;
  container_name?: string;
}

export interface ProcessesResponse {
  processes: ProcessInfo[];
  total_processes: number;
  user_processes_count?: number;
  kernel_threads_count?: number;
  running_processes: number;
  sleeping_processes: number;
  zombie_processes: number;
  host_processes_count: number;
  container_processes_count: number;
  top_cpu_process?: TopProcessSummary;
  top_memory_process?: TopProcessSummary;
  total_cpu_usage: number;
  total_memory_used: number;
  total_memory_available: number;
}

export function ProcessMonitor() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProcessesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 3s default
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all'); // 'all' | 'host' | container_name
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // 'all' | 'Running' | 'Sleeping' | 'Zombie'
  
  // Sorting
  const [sortBy, setSortBy] = useState<'cpu' | 'memory' | 'pid' | 'name' | 'disk'>('cpu');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null);
  const [killModalProcess, setKillModalProcess] = useState<ProcessInfo | null>(null);
  const [killSignal, setKillSignal] = useState<'SIGTERM' | 'SIGKILL'>('SIGTERM');
  const [killing, setKilling] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchProcesses = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/processes', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache',
        },
      });

      if (res.ok) {
        const json: ProcessesResponse = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch system processes', err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchProcesses();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  const handleKillProcess = async () => {
    if (!killModalProcess) return;
    setKilling(true);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/system/processes/${killModalProcess.pid}/kill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ signal: killSignal }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setActionMessage({ text: resJson.message || `Processo ${killModalProcess.pid} encerrado.`, type: 'success' });
        setKillModalProcess(null);
        if (selectedProcess?.pid === killModalProcess.pid) {
          setSelectedProcess(null);
        }
        await fetchProcesses(true);
      } else {
        setActionMessage({ text: resJson.error || 'Erro ao finalizar processo.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: `Erro de rede: ${err.message}`, type: 'error' });
    } finally {
      setKilling(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Extract unique container names for filtering
  const containerNames = useMemo(() => {
    if (!data?.processes) return [];
    const set = new Set<string>();
    data.processes.forEach(p => {
      if (p.container_name) set.add(p.container_name);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filter and sort processes
  const filteredProcesses = useMemo(() => {
    if (!data?.processes) return [];
    const query = searchQuery.trim().toLowerCase();

    return data.processes
      .filter(p => {
        // Scope Filter
        if (selectedScope === 'user_only' && p.is_kernel_thread) return false;
        if (selectedScope === 'kthread_only' && !p.is_kernel_thread) return false;
        if (selectedScope === 'host' && p.container_name) return false;
        if (selectedScope !== 'all' && selectedScope !== 'user_only' && selectedScope !== 'kthread_only' && selectedScope !== 'host' && p.container_name !== selectedScope) return false;

        // Status Filter
        if (selectedStatus !== 'all' && p.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;

        // Query Filter
        if (query) {
          const matchPid = p.pid.toString().includes(query);
          const matchName = p.name.toLowerCase().includes(query);
          const matchUser = (p.user || '').toLowerCase().includes(query);
          const matchContainer = (p.container_name || '').toLowerCase().includes(query);
          const matchCmd = p.cmd.some(c => c.toLowerCase().includes(query));
          const matchExe = (p.exe || '').toLowerCase().includes(query);
          return matchPid || matchName || matchUser || matchContainer || matchCmd || matchExe;
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        switch (sortBy) {
          case 'cpu':
            comp = (a.cpu_usage || 0) - (b.cpu_usage || 0);
            break;
          case 'memory':
            comp = (a.memory_rss || 0) - (b.memory_rss || 0);
            break;
          case 'pid':
            comp = a.pid - b.pid;
            break;
          case 'name':
            comp = a.name.localeCompare(b.name);
            break;
          case 'disk':
            const diskA = (a.disk_read_bytes || 0) + (a.disk_written_bytes || 0);
            const diskB = (b.disk_read_bytes || 0) + (b.disk_written_bytes || 0);
            comp = diskA - diskB;
            break;
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [data, searchQuery, selectedScope, selectedStatus, sortBy, sortOrder]);

  const toggleSort = (field: 'cpu' | 'memory' | 'pid' | 'name' | 'disk') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
      {/* Toast Alert */}
      {actionMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top duration-200 shadow-lg ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-orbit-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('metrics.total_processes')}</span>
            <div className="p-2 rounded-lg bg-orbit-500/10 text-orbit-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary font-mono">
              {data?.user_processes_count ?? data?.total_processes ?? '—'}
            </span>
            <span className="text-xs text-secondary">
              {data?.kernel_threads_count ? `(${data.total_processes} ${t('common.total').toLowerCase()})` : t('metrics.user_tasks')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border/50 text-[11px] flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-medium">
              {data?.running_processes ?? 0} {t('common.running').toLowerCase()}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-background text-secondary border border-border/50">
              {data?.sleeping_processes ?? 0} {t('common.paused').toLowerCase()}
            </span>
            {Boolean(data?.kernel_threads_count) && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-medium" title="Kernel Threads (kthr)">
                {data?.kernel_threads_count} kthr
              </span>
            )}
            {Boolean(data?.zombie_processes) && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-semibold">
                {data?.zombie_processes} zombie
              </span>
            )}
          </div>
        </div>

        {/* Top CPU Consumer */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-orbit-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('metrics.cpu_usage_history')}</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-primary truncate max-w-full font-mono" title={data?.top_cpu_process?.name}>
              {data?.top_cpu_process?.name || '—'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-purple-400 font-mono">
                {data?.top_cpu_process?.value ? `${data.top_cpu_process.value.toFixed(1)}% CPU` : '0.0%'}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">PID {data?.top_cpu_process?.pid}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-secondary truncate">
            {t('logs.source')}: {data?.top_cpu_process?.container_name ? (
              <span className="text-orbit-400 font-medium">{data.top_cpu_process.container_name}</span>
            ) : (
              <span className="text-zinc-400 font-medium">Host</span>
            )}
          </div>
        </div>

        {/* Top RAM Consumer */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-orbit-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('metrics.memory_usage_history')}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-primary truncate max-w-full font-mono" title={data?.top_memory_process?.name}>
              {data?.top_memory_process?.name || '—'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-emerald-400 font-mono">
                {data?.top_memory_process?.value ? formatRAM(data.top_memory_process.value) : '0 B'}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">PID {data?.top_memory_process?.pid}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-secondary truncate">
            {t('logs.source')}: {data?.top_memory_process?.container_name ? (
              <span className="text-orbit-400 font-medium">{data.top_memory_process.container_name}</span>
            ) : (
              <span className="text-zinc-400 font-medium">Host</span>
            )}
          </div>
        </div>

        {/* Host vs Containers Distribution */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-orbit-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{t('metrics.system_overview')}</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-secondary flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-400" /> Host
              </span>
              <span className="text-xl font-bold text-primary font-mono mt-0.5">
                {data?.host_processes_count ?? 0}
              </span>
            </div>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex flex-col">
              <span className="text-xs text-secondary flex items-center gap-1">
                <Box className="w-3 h-3 text-orbit-400" /> Containers
              </span>
              <span className="text-xl font-bold text-orbit-400 font-mono mt-0.5">
                {data?.container_processes_count ?? 0}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-secondary flex items-center justify-between">
            <span>CPU: <span className="text-primary font-mono">{data?.total_cpu_usage?.toFixed(1) || '0.0'}%</span></span>
            <span>RAM: <span className="text-primary font-mono">{formatRAM(data?.total_memory_used)}</span></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col lg:flex-row gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('metrics.search_processes')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3.5 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all font-mono"
          />
        </div>

        {/* Scope Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="text-xs text-secondary font-medium whitespace-nowrap">{t('logs.source')}:</span>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="bg-transparent text-xs text-primary font-medium outline-none cursor-pointer max-w-[170px] truncate"
            >
              <option value="all">{t('common.all')} ({data?.total_processes ?? 0})</option>
              <option value="user_only">{t('metrics.user_tasks')} ({data?.user_processes_count ?? (data?.total_processes ?? 0)})</option>
              {Boolean(data?.kernel_threads_count) && (
                <option value="kthread_only">{t('metrics.kernel_threads')} ({data?.kernel_threads_count})</option>
              )}
              <option value="host">Host ({data?.host_processes_count ?? 0})</option>
              {containerNames.map(cName => (
                <option key={cName} value={cName}>Container: {cName}</option>
              ))}
            </select>
          </div>

          {/* Status Selector */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-secondary font-medium whitespace-nowrap">{t('common.status')}:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-primary font-medium outline-none cursor-pointer"
            >
              <option value="all">{t('common.all')}</option>
              <option value="Running">{t('common.running')}</option>
              <option value="Sleeping">{t('common.paused')}</option>
              <option value="Zombie">Zombie</option>
            </select>
          </div>

          {/* Auto Refresh Interval */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-secondary font-medium whitespace-nowrap">Taxa:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs text-primary font-medium outline-none cursor-pointer"
            >
              <option value={2000}>2s (Rápido)</option>
              <option value={3000}>3s (Padrão)</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={0}>Pausado</option>
            </select>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchProcesses(true)}
            className="p-2 rounded-lg bg-accent border border-border hover:bg-orbit-700 text-secondary hover:text-white transition-colors flex items-center justify-center shrink-0"
            title="Atualizar agora"
            aria-label="Atualizar processos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orbit-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Processes Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-background/80 border-b border-border text-[11px] font-semibold text-secondary uppercase tracking-wider select-none">
                <th 
                  onClick={() => toggleSort('pid')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors whitespace-nowrap w-[90px]"
                >
                  <div className="flex items-center gap-1">
                    <span>PID</span>
                    {sortBy === 'pid' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('name')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Processo / Comando</span>
                    {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">Origem</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Usuário</th>
                <th 
                  onClick={() => toggleSort('cpu')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors whitespace-nowrap w-[130px]"
                >
                  <div className="flex items-center gap-1">
                    <span>CPU (%)</span>
                    {sortBy === 'cpu' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('memory')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors whitespace-nowrap w-[140px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Memória</span>
                    {sortBy === 'memory' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('disk')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors whitespace-nowrap hidden md:table-cell w-[130px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Disco I/O</span>
                    {sortBy === 'disk' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap w-[90px]">Status</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap w-[90px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {loading && filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-secondary">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orbit-500 mb-2" />
                    Carregando tabela de processos do sistema...
                  </td>
                </tr>
              )}

              {!loading && filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-secondary">
                    Nenhum processo encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}

              {filteredProcesses.map((p) => {
                const isHighCpu = p.cpu_usage > 25.0;
                const isHighRam = p.memory_percent > 15.0;

                return (
                  <tr 
                    key={p.pid}
                    onClick={() => setSelectedProcess(p)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    {/* PID */}
                    <td className="px-3.5 py-2.5 font-medium text-primary">
                      {p.pid}
                    </td>

                    {/* Process / Command */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-col min-w-0 max-w-[320px] lg:max-w-[420px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary truncate" title={p.name}>
                            {p.name}
                          </span>
                          {p.is_kernel_thread && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                              kthr
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 truncate" title={p.cmd.join(' ') || p.exe}>
                          {p.cmd.join(' ') || p.exe || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Scope / Container */}
                    <td className="px-3.5 py-2.5 font-sans whitespace-nowrap">
                      {p.container_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orbit-500/15 text-orbit-300 text-xs font-medium border border-orbit-500/30">
                          <Box className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{p.container_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background text-zinc-400 text-xs font-medium border border-border">
                          <Monitor className="w-3 h-3 shrink-0 text-zinc-500" />
                          Host
                        </span>
                      )}
                    </td>

                    {/* User */}
                    <td className="px-3.5 py-2.5 text-zinc-400 text-xs whitespace-nowrap">
                      {p.user || 'root'}
                    </td>

                    {/* CPU Usage */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${isHighCpu ? 'text-purple-400 font-bold' : 'text-primary'}`}>
                            {p.cpu_usage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border/50">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isHighCpu ? 'bg-purple-500' : 'bg-orbit-500'
                            }`}
                            style={{ width: `${Math.min(100, p.cpu_usage)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Memory */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${isHighRam ? 'text-emerald-400 font-bold' : 'text-primary'}`}>
                            {formatRAM(p.memory_rss)}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {p.memory_percent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border/50">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isHighRam ? 'bg-emerald-500' : 'bg-teal-500/70'
                            }`}
                            style={{ width: `${Math.min(100, p.memory_percent * 2)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Disk I/O */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap hidden md:table-cell text-xs text-secondary font-mono">
                      <div className="flex flex-col text-[11px]">
                        <span>R: {formatBytes(p.disk_read_bytes)}</span>
                        <span>W: {formatBytes(p.disk_written_bytes)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2.5 font-sans whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        p.status === 'Running' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : p.status === 'Zombie' 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                          : 'bg-background text-zinc-400 border border-border'
                      }`}>
                        {p.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProcess(p);
                          }}
                          className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
                          title="Ver detalhes do processo"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setKillModalProcess(p);
                          }}
                          className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Finalizar processo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Details Modal */}
      {selectedProcess && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedProcess(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary font-mono">{selectedProcess.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-secondary font-mono">
                    <span>PID: {selectedProcess.pid}</span>
                    {selectedProcess.ppid && <span>(PPID: {selectedProcess.ppid})</span>}
                    <span>•</span>
                    <span>Usuário: {selectedProcess.user || 'root'}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProcess(null)} 
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Origin & Status Badge */}
            <div className="grid grid-cols-2 gap-3 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div>
                <span className="text-secondary block mb-1">Origem do Processo</span>
                {selectedProcess.container_name ? (
                  <div className="flex items-center gap-1.5 font-semibold text-orbit-400">
                    <Box className="w-4 h-4" />
                    <span>Container: {selectedProcess.container_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Monitor className="w-4 h-4" />
                    <span>Host / Raspberry Pi</span>
                  </div>
                )}
              </div>
              <div>
                <span className="text-secondary block mb-1">Status da Tarefa</span>
                <span className="font-semibold text-emerald-400">{selectedProcess.status}</span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-background/80 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] uppercase font-semibold text-purple-400 block mb-1">CPU Normalizada</span>
                <span className="text-base font-bold text-primary font-mono">{selectedProcess.cpu_usage.toFixed(1)}%</span>
              </div>
              <div className="bg-background/80 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] uppercase font-semibold text-emerald-400 block mb-1">Memória Real (RSS)</span>
                <span className="text-base font-bold text-primary font-mono">{formatRAM(selectedProcess.memory_rss)}</span>
              </div>
              <div className="bg-background/80 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] uppercase font-semibold text-orbit-400 block mb-1">% da RAM Total</span>
                <span className="text-base font-bold text-primary font-mono">{selectedProcess.memory_percent.toFixed(2)}%</span>
              </div>
            </div>

            {/* Command Line & Executable Path */}
            <div className="space-y-3 pt-1">
              <div>
                <span className="text-xs font-semibold text-secondary block mb-1">Executável (Path):</span>
                <div className="bg-background p-2.5 rounded-lg border border-border font-mono text-xs text-primary break-all">
                  {selectedProcess.exe || selectedProcess.name}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-secondary block mb-1">Linha de Comando Completa (Arguments):</span>
                <div className="bg-background p-2.5 rounded-lg border border-border font-mono text-xs text-zinc-300 max-h-32 overflow-y-auto break-all select-all">
                  {selectedProcess.cmd.length > 0 ? selectedProcess.cmd.join(' ') : selectedProcess.exe || selectedProcess.name}
                </div>
              </div>

              {/* Disk I/O */}
              <div className="flex items-center justify-between text-xs text-secondary bg-background p-2.5 rounded-lg border border-border font-mono">
                <span>Leitura em Disco: <strong className="text-primary">{formatBytes(selectedProcess.disk_read_bytes)}</strong></span>
                <span>Escrita em Disco: <strong className="text-primary">{formatBytes(selectedProcess.disk_written_bytes)}</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={() => {
                  setKillModalProcess(selectedProcess);
                  setSelectedProcess(null);
                }}
                className="px-4 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Finalizar Processo...
              </button>
              <button
                onClick={() => setSelectedProcess(null)}
                className="px-4 py-2 bg-accent hover:bg-white/10 text-secondary hover:text-primary rounded-xl text-xs sm:text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Process Confirmation Modal */}
      {killModalProcess && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setKillModalProcess(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-primary">Finalizar Processo?</h3>
                <p className="text-xs text-secondary">PID: {killModalProcess.pid} ({killModalProcess.name})</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-secondary leading-relaxed">
              Tem certeza que deseja enviar um sinal de encerramento para o processo <strong className="text-primary font-mono">{killModalProcess.name}</strong>?
            </p>

            {/* Signal Choice */}
            <div className="space-y-2 bg-background p-3 rounded-xl border border-border text-xs">
              <span className="font-semibold text-secondary block">Selecione o sinal:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="signal" 
                  checked={killSignal === 'SIGTERM'} 
                  onChange={() => setKillSignal('SIGTERM')} 
                  className="accent-orbit-500"
                />
                <div>
                  <span className="font-semibold text-primary">SIGTERM (Sinal 15 - Recomendado)</span>
                  <p className="text-[11px] text-zinc-500">Solicita encerramento gracioso do processo.</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input 
                  type="radio" 
                  name="signal" 
                  checked={killSignal === 'SIGKILL'} 
                  onChange={() => setKillSignal('SIGKILL')} 
                  className="accent-rose-500"
                />
                <div>
                  <span className="font-semibold text-rose-400">SIGKILL (Sinal 9 - Forçado)</span>
                  <p className="text-[11px] text-zinc-500">Mata o processo imediatamente sem cleanup.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setKillModalProcess(null)}
                disabled={killing}
                className="px-4 py-2 rounded-xl text-secondary hover:text-primary hover:bg-accent transition-colors text-xs sm:text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleKillProcess}
                disabled={killing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-rose-900/20 flex items-center gap-1.5"
              >
                {killing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {killing ? 'Finalizando...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
