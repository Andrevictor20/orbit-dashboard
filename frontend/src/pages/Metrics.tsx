import { useState, useEffect } from 'react';
import { useStats } from '../contexts/StatsContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Network, Cpu, HardDrive, LayoutGrid, Monitor, Box, Rocket } from 'lucide-react';

interface MetricPoint {
  time: string;
  cpu: number;
  dockerCpu: number;
  orbitCpu: number;
  memory: number;
  dockerMemory: number;
  orbitMemory: number;
  tx: number;
  rx: number;
  dockerTx: number;
  dockerRx: number;
}

type TabType = 'overview' | 'system' | 'containers' | 'orbit';

export function Metrics() {
  const { stats, isConnected } = useStats();
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    if (stats) {
      setHistory(prev => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const newData = [...prev, { 
          time: timeStr, 
          cpu: stats.cpu_usage, 
          dockerCpu: stats.docker_cpu,
          orbitCpu: stats.orbit_cpu,
          memory: stats.memory_used, 
          dockerMemory: stats.docker_memory,
          orbitMemory: stats.orbit_memory,
          tx: stats.network_tx, 
          rx: stats.network_rx,
          dockerTx: stats.docker_tx,
          dockerRx: stats.docker_rx
        }];
        
        // Keep last 60 data points for metrics (longer history than overview)
        if (newData.length > 60) return newData.slice(newData.length - 60);
        return newData;
      });
    }
  }, [stats]);

  const formatDecimal = (val: any) => val.toFixed(2);
  const formatPercentage = (val: any) => `${val.toFixed(2)}%`;
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
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatBytesAxis = (bytes: any) => {
    if (bytes === 0 || isNaN(bytes)) return '0';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            Métricas do Sistema
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">Análise detalhada de performance e uso de recursos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="bg-card border border-border p-1 rounded-lg flex items-center shadow-sm overflow-x-auto max-w-full scrollbar-none">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Geral
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
              Containers
            </button>
            <button 
              onClick={() => setActiveTab('orbit')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'orbit' ? 'bg-accent text-white shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Orbit
            </button>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-card border border-border rounded-lg shadow-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs font-medium text-secondary whitespace-nowrap">
              {isConnected ? 'Real-time' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* CPU Panel */}
        <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[300px] sm:min-h-[350px] flex flex-col">
          <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
            Evolução de CPU (%)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
        <div className="glass-panel rounded-xl p-6 h-[350px] flex flex-col">
          <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-500" />
            Evolução de Memória (RAM Real)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
          <div className="glass-panel rounded-xl p-6 h-[350px] lg:col-span-2 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-500" />
              Tráfego de Rede (Velocidade em Tempo Real)
            </h3>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
    </div>
  );
}
