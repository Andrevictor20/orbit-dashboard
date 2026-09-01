import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStats } from '../contexts/StatsContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Network, Cpu, HardDrive, LayoutGrid, Monitor, Box, Rocket, Terminal, Clock, Info } from 'lucide-react';
import { ProcessMonitor } from '../components/metrics/ProcessMonitor';
import { AlertsPanel } from '../components/metrics/AlertsPanel';

type TabType = 'overview' | 'system' | 'containers' | 'orbit' | 'processes';
type TimeRangeType = '1m' | '5m' | '15m' | '30m' | '1h';

export function Metrics() {
  const { t } = useTranslation();
  const { stats, history, isConnected } = useStats();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('5m');

  // Filter history based on selected time range using exact timestamps
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    const durationMap: Record<TimeRangeType, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
    };

    const durationMs = durationMap[timeRange] || 5 * 60 * 1000;
    const latestTimestamp = history[history.length - 1]?.timestamp || Date.now();
    const cutoff = latestTimestamp - durationMs;

    let points = history.filter(p => p.timestamp >= cutoff);
    if (points.length === 0) {
      points = history.slice(-30);
    }

    // Downsample if there are more than 150 points to maintain high chart rendering performance
    if (points.length > 150) {
      const step = Math.ceil(points.length / 100);
      const sampled: typeof history = [];
      for (let i = 0; i < points.length; i += step) {
        sampled.push(points[i]);
      }
      if (sampled[sampled.length - 1] !== points[points.length - 1]) {
        sampled.push(points[points.length - 1]);
      }
      return sampled;
    }

    return points;
  }, [history, timeRange]);

  const formatDecimal = (val: any) => (typeof val === 'number' ? val.toFixed(2) : '0.00');
  const formatPercentage = (val: any) => (typeof val === 'number' ? `${val.toFixed(2)}%` : '0.00%');
  const formatSpeed = (bytesPerSec: any) => {
    if (bytesPerSec === 0 || isNaN(bytesPerSec)) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytesPerSec) / Math.log(k)));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeedAxis = (bytesPerSec: any) => {
    if (bytesPerSec === 0 || isNaN(bytesPerSec)) return '0';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytesPerSec) / Math.log(k)));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };
  
  const formatBytes = (bytes: any) => {
    if (bytes === 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatBytesAxis = (bytes: any) => {
    if (bytes === 0 || isNaN(bytes)) return '0';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            {t('metrics.title')}
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">{t('metrics.subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Time Range Selector */}
          {activeTab !== 'processes' && (
            <div className="bg-card border border-border p-1 rounded-lg flex items-center shadow-sm overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 px-2 text-xs font-semibold text-secondary">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">{t('metrics.time_range')}:</span>
              </div>
              {(['1m', '5m', '15m', '30m', '1h'] as TimeRangeType[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    timeRange === range
                      ? 'bg-accent text-white shadow'
                      : 'text-secondary hover:text-primary hover:bg-neutral-800/50'
                  }`}
                >
                  {t(`metrics.time_${range}`)}
                </button>
              ))}
            </div>
          )}

          {/* Tab Switcher */}
          <div className="bg-card border border-border p-1 rounded-lg flex items-center shadow-sm overflow-x-auto max-w-full scrollbar-none">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('common.all')}
            </button>
            <button 
              onClick={() => setActiveTab('system')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'system' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Host
            </button>
            <button 
              onClick={() => setActiveTab('containers')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'containers' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Box className="w-3.5 h-3.5" />
              {t('sidebar.containers')}
            </button>
            <button 
              onClick={() => setActiveTab('orbit')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'orbit' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Orbit
            </button>
            <button 
              onClick={() => setActiveTab('processes')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'processes' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              {t('metrics.process_monitor')}
            </button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-card border border-border rounded-lg shadow-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs font-medium text-secondary whitespace-nowrap">
              {isConnected ? t('dashboard.live') : t('dashboard.disconnected')}
            </span>
          </div>
        </div>
      </div>
      
      {activeTab !== 'processes' && <AlertsPanel />}

      {activeTab === 'orbit' && (
        <div className="bg-card/70 border border-yellow-500/20 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-primary">{t('metrics.orbit_consumption_title')}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  Consolidado
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />
                {t('metrics.orbit_consumption_desc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <div className="bg-neutral-900/80 border border-border px-3 py-1.5 rounded-lg text-right">
              <span className="text-[10px] uppercase font-bold text-secondary block">CPU Orbit</span>
              <span className="text-sm font-bold text-yellow-400 font-mono">
                {stats ? stats.orbit_cpu.toFixed(2) : '0.00'}%
              </span>
            </div>
            <div className="bg-neutral-900/80 border border-border px-3 py-1.5 rounded-lg text-right">
              <span className="text-[10px] uppercase font-bold text-secondary block">RAM Orbit</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {stats ? formatBytes(stats.orbit_memory) : '0 B'}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'processes' ? (
        <ProcessMonitor />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* CPU Panel */}
          <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[300px] sm:min-h-[350px] flex flex-col">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                {t('metrics.cpu_usage_history')}
              </h3>
              <span className="text-xs text-secondary font-mono">
                {filteredHistory.length} {filteredHistory.length === 1 ? 'amostra' : 'amostras'}
              </span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metricCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="metricDockerCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="metricOrbitCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatDecimal} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <Tooltip formatter={formatPercentage} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }} />
                  
                  <Area type="monotone" dataKey="cpu" stroke={(activeTab === 'overview' || activeTab === 'system') ? "#8b5cf6" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'system') ? 1 : 0} fill="url(#metricCpu)" name="Host CPU" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'system') ? undefined : 'none'} />
                  <Area type="monotone" dataKey="dockerCpu" stroke={(activeTab === 'overview' || activeTab === 'containers') ? "#ec4899" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'containers') ? 1 : 0} fill="url(#metricDockerCpu)" name="Containers CPU" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'containers') ? undefined : 'none'} />
                  <Area type="monotone" dataKey="orbitCpu" stroke={(activeTab === 'overview' || activeTab === 'orbit') ? "#eab308" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'orbit') ? 1 : 0} fill="url(#metricOrbitCpu)" name="Orbit CPU" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'orbit') ? undefined : 'none'} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Memory Panel */}
          <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[300px] sm:min-h-[350px] flex flex-col">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                {t('metrics.memory_usage_history')}
              </h3>
              <span className="text-xs text-secondary font-mono">
                {filteredHistory.length} {filteredHistory.length === 1 ? 'amostra' : 'amostras'}
              </span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metricMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="metricDockerMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="metricOrbitMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatBytesAxis} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} width={75} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <Tooltip formatter={formatBytes} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }} />
                  
                  <Area type="monotone" dataKey="memory" stroke={(activeTab === 'overview' || activeTab === 'system') ? "#10b981" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'system') ? 1 : 0} fill="url(#metricMem)" name="Host RAM" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'system') ? undefined : 'none'} />
                  <Area type="monotone" dataKey="dockerMemory" stroke={(activeTab === 'overview' || activeTab === 'containers') ? "#14b8a6" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'containers') ? 1 : 0} fill="url(#metricDockerMem)" name="Containers RAM" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'containers') ? undefined : 'none'} />
                  <Area type="monotone" dataKey="orbitMemory" stroke={(activeTab === 'overview' || activeTab === 'orbit') ? "#84cc16" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'orbit') ? 1 : 0} fill="url(#metricOrbitMem)" name="Orbit RAM" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'orbit') ? undefined : 'none'} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Network Panel (Only for System and Containers) */}
          {activeTab !== 'orbit' && (
            <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[300px] sm:min-h-[350px] lg:col-span-2 flex flex-col animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2">
                  <Network className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  {t('metrics.network_io_history')}
                </h3>
                <span className="text-xs text-secondary font-mono">
                  {filteredHistory.length} {filteredHistory.length === 1 ? 'amostra' : 'amostras'}
                </span>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metricTx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="metricRx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="metricDockerTx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="metricDockerRx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={formatSpeedAxis} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} width={80} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <Tooltip formatter={formatSpeed} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }} />
                    
                    <Area type="monotone" dataKey="dockerTx" stroke={(activeTab === 'overview' || activeTab === 'containers') ? "#6366f1" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'containers') ? 1 : 0} fill="url(#metricDockerTx)" name="Containers Upload" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'containers') ? undefined : 'none'} />
                    <Area type="monotone" dataKey="dockerRx" stroke={(activeTab === 'overview' || activeTab === 'containers') ? "#fb923c" : "transparent"} fillOpacity={(activeTab === 'overview' || activeTab === 'containers') ? 1 : 0} fill="url(#metricDockerRx)" name="Containers Download" isAnimationActive={false} tooltipType={(activeTab === 'overview' || activeTab === 'containers') ? undefined : 'none'} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
