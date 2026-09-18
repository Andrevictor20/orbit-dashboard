import { useTranslation } from 'react-i18next';
import { 
  Search, RefreshCw, Filter, Box, Monitor, 
  ChevronUp, ChevronDown, Info, Trash2 
} from 'lucide-react';
import { formatRAM, formatBytes } from '../../../utils/format';
import type { ProcessInfo, ProcessesResponse } from '../ProcessMonitor';

interface ProcessTableProps {
  data: ProcessesResponse | null;
  loading: boolean;
  isRefreshing: boolean;
  fetchProcesses: (isManual?: boolean) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedScope: string;
  setSelectedScope: (scope: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  refreshInterval: number;
  setRefreshInterval: (val: number) => void;
  containerNames: string[];
  filteredProcesses: ProcessInfo[];
  sortBy: 'cpu' | 'memory' | 'pid' | 'name' | 'disk';
  sortOrder: 'asc' | 'desc';
  toggleSort: (field: 'cpu' | 'memory' | 'pid' | 'name' | 'disk') => void;
  onSelectProcess: (p: ProcessInfo) => void;
  onInitiateKill: (p: ProcessInfo) => void;
}

export function ProcessTable({
  data,
  loading,
  isRefreshing,
  fetchProcesses,
  searchQuery,
  setSearchQuery,
  selectedScope,
  setSelectedScope,
  selectedStatus,
  setSelectedStatus,
  refreshInterval,
  setRefreshInterval,
  containerNames,
  filteredProcesses,
  sortBy,
  sortOrder,
  toggleSort,
  onSelectProcess,
  onInitiateKill,
}: ProcessTableProps) {
  const { t } = useTranslation();

  return (
    <>
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
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3.5 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-saturn-500/50 transition-all font-mono"
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
            <span className="text-xs text-secondary font-medium whitespace-nowrap">{t('metrics.rate', 'Taxa:')}</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs text-primary font-medium outline-none cursor-pointer"
            >
              <option value={2000}>{t('metrics.rate_fast', '2s (Rápido)')}</option>
              <option value={3000}>{t('metrics.rate_normal', '3s (Padrão)')}</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={0}>{t('metrics.rate_paused', 'Pausado')}</option>
            </select>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchProcesses(true)}
            className="p-2 rounded-lg bg-accent border border-border hover:bg-saturn-700 text-secondary hover:text-white transition-colors flex items-center justify-center shrink-0"
            title={t('metrics.refresh_now', 'Atualizar agora')}
            aria-label={t('metrics.refresh_processes', 'Atualizar processos')}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-saturn-400' : ''}`} />
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
                    <span>{t('metrics.process_command', 'Processo / Comando')}</span>
                    {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">{t('metrics.origin', 'Origem')}</th>
                <th className="px-3.5 py-3 whitespace-nowrap">{t('metrics.user', 'Usuário')}</th>
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
                    <span>{t('metrics.real_memory', 'Memória')}</span>
                    {sortBy === 'memory' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('disk')} 
                  className="px-3.5 py-3 cursor-pointer hover:text-primary transition-colors whitespace-nowrap hidden md:table-cell w-[130px]"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('metrics.disk_io', 'Disco I/O')}</span>
                    {sortBy === 'disk' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap w-[90px]">{t('common.status', 'Status')}</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap w-[90px]">{t('common.actions', 'Ações')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {loading && filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-secondary">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-saturn-500 mb-2" />
                    {t('metrics.loading_processes', 'Carregando tabela de processos do sistema...')}
                  </td>
                </tr>
              )}

              {!loading && filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-secondary">
                    {t('metrics.no_processes', 'Nenhum processo encontrado para os filtros selecionados.')}
                  </td>
                </tr>
              )}

              {filteredProcesses.map((p) => {
                const isHighCpu = p.cpu_usage > 25.0;
                const isHighRam = p.memory_percent > 15.0;

                return (
                  <tr 
                    key={p.pid}
                    onClick={() => onSelectProcess(p)}
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
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shrink-0">
                              kthr
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-secondary truncate font-mono" title={p.cmd.join(' ') || p.exe}>
                          {p.cmd.join(' ') || p.exe || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Scope / Container */}
                    <td className="px-3.5 py-2.5 font-sans whitespace-nowrap">
                      {p.container_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-saturn-500/15 text-saturn-700 dark:text-saturn-300 text-xs font-semibold border border-saturn-500/30">
                          <Box className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{p.container_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background text-secondary text-xs font-medium border border-border">
                          <Monitor className="w-3 h-3 shrink-0 text-secondary" />
                          Host
                        </span>
                      )}
                    </td>

                    {/* User */}
                    <td className="px-3.5 py-2.5 text-secondary text-xs font-medium whitespace-nowrap">
                      {p.user || 'root'}
                    </td>

                    {/* CPU Usage */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${isHighCpu ? 'text-purple-700 dark:text-purple-400 font-bold' : 'text-primary'}`}>
                            {p.cpu_usage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border/50">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isHighCpu ? 'bg-purple-500' : 'bg-saturn-500'
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
                          <span className={`font-semibold ${isHighRam ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-primary'}`}>
                            {formatRAM(p.memory_rss)}
                          </span>
                          <span className="text-[10px] text-secondary font-mono">
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
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                          : p.status === 'Zombie' 
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' 
                          : 'bg-background text-secondary border border-border font-medium'
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
                            onSelectProcess(p);
                          }}
                          className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
                          title={t('metrics.process_details', 'Ver detalhes do processo')}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInitiateKill(p);
                          }}
                          className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title={t('metrics.kill_process', 'Finalizar processo')}
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
    </>
  );
}
