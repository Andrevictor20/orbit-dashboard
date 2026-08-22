import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/ui/StatCard';
import { TrendingUp, Activity, HardDrive, Box } from 'lucide-react';
import { useStats } from '../contexts/StatsContext';
import { getFriendlyDiskName } from '../utils/format';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

export function Overview() {
  const { t } = useTranslation();
  const { stats, isConnected } = useStats();
  
  const [history, setHistory] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (stats) {
      setHistory(prev => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint: ChartDataPoint = {
          time: timeStr,
          cpu: stats.cpu_usage,
          memory: stats.memory_total > 0 ? (stats.memory_used / stats.memory_total) * 100 : 0
        };
        const updated = [...prev, newPoint];
        if (updated.length > 20) {
          return updated.slice(updated.length - 20);
        }
        return updated;
      });
    }
  }, [stats]);

  // Derived metrics
  const cpuPercent = stats ? stats.cpu_usage.toFixed(1) : '0.0';
  const memoryUsedGB = stats ? (stats.memory_used / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryTotalGB = stats ? (stats.memory_total / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryPercent = stats && stats.memory_total > 0 
    ? ((stats.memory_used / stats.memory_total) * 100).toFixed(1)
    : '0.0';

  // Deduplicate and clean disks by device / physical partition
  const uniqueDisksMap = new Map<string, any>();
  if (stats) {
    stats.disks.forEach((d: any) => {
      // Pick cleanest primary mountpoint (prefer root / or /mnt or /media over internal container sub-paths)
      if (uniqueDisksMap.has(d.name)) {
        const existing = uniqueDisksMap.get(d.name)!;
        if (d.mount_point === '/' || d.mount_point.startsWith('/mnt') || d.mount_point.startsWith('/media')) {
          existing.mount_point = d.mount_point;
        }
      } else {
        uniqueDisksMap.set(d.name, { ...d });
      }
    });
  }
  const uniqueDisks = Array.from(uniqueDisksMap.values());

  const globalDiskUsed = uniqueDisks.reduce((acc, d) => acc + d.used, 0);
  const globalDiskTotal = uniqueDisks.reduce((acc, d) => acc + d.total, 0);

  const diskUsedGB = (globalDiskUsed / 1024 / 1024 / 1024).toFixed(2);
  const diskTotalGB = (globalDiskTotal / 1024 / 1024 / 1024).toFixed(2);
  const diskPercent = globalDiskTotal > 0
    ? ((globalDiskUsed / globalDiskTotal) * 100).toFixed(1)
    : '0.0';
    
  const tempC = stats ? stats.temperature.toFixed(1) : '0.0';

  return (
    <>
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">{t('dashboard.title')}</h2>
          <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto px-2.5 py-1 rounded-full bg-card/60 border border-border/50">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-medium text-secondary">
            {isConnected ? t('dashboard.connected') : t('dashboard.disconnected')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard 
          title={t('dashboard.containers')} 
          value={t('dashboard.live')} 
          trend="WS"
          trendUp={isConnected}
          subText={t('dashboard.syncing')}
          icon={TrendingUp}
        />
        <StatCard 
          title={t('dashboard.cpu_usage')} 
          value={`${cpuPercent}%`} 
          trend="Avg"
          trendUp={parseFloat(cpuPercent) < 70}
          subText={t('dashboard.system_average')}
          icon={Activity}
        />
        <StatCard 
          title="Temperatura"
          value={`${tempC}°C`} 
          trend="Sys"
          trendUp={parseFloat(tempC) < 75}
          subText="Sensores"
          icon={Activity}
        />
        <StatCard 
          title={t('dashboard.memory_usage')} 
          value={`${memoryUsedGB} GB`} 
          trend={`${memoryPercent}%`}
          trendUp={parseFloat(memoryPercent) < 80}
          subText={`${memoryTotalGB} GB ${t('dashboard.total')}`}
          icon={HardDrive}
        />
        <StatCard 
          title="Rede (TX/RX)"
          value={`${(stats ? stats.network_tx / 1024 / 1024 : 0).toFixed(1)} MB`} 
          trend={`${(stats ? stats.network_rx / 1024 / 1024 : 0).toFixed(1)} MB`}
          trendUp={true}
          subText="Transferência"
          icon={Box}
        />
        <StatCard 
          title={t('dashboard.storage')} 
          value={`${diskUsedGB} GB`} 
          trend={`${diskPercent}%`}
          trendUp={parseFloat(diskPercent) < 85}
          subText={`${diskTotalGB} GB ${t('dashboard.total')}`}
          icon={Box}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[350px] sm:min-h-[400px] lg:col-span-2 flex flex-col">
          <div className="mb-4 sm:mb-6">
            <h3 className="text-sm font-semibold text-primary">{t('dashboard.system_performance')}</h3>
          </div>
          <div className="flex-1 min-h-[240px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} width={40} />
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <Tooltip 
                  formatter={(value: any) => typeof value === 'number' ? value.toFixed(1) : value}
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: '#d4d4d4', fontWeight: 600 }}
                  labelStyle={{ color: '#a3a3a3', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" name="CPU (%)" />
                <Area type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMemory)" name="RAM (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 sm:p-6 min-h-[350px] sm:min-h-[400px] flex flex-col overflow-y-auto">
          <div className="mb-4 sm:mb-6 sticky top-0 bg-background/80 backdrop-blur-md pb-2 z-10">
            <h3 className="text-sm font-semibold text-primary">{t('dashboard.storage')}</h3>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            {uniqueDisks.length > 0 ? (
              uniqueDisks.map((disk, idx) => {
                const usedGB = (disk.used / 1024 / 1024 / 1024).toFixed(2);
                const totalGB = (disk.total / 1024 / 1024 / 1024).toFixed(2);
                const percent = ((disk.used / disk.total) * 100).toFixed(1);
                const friendlyName = getFriendlyDiskName(disk.name, disk.mount_point);
                
                return (
                  <div key={idx} className="bg-white/5 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium text-primary text-sm truncate max-w-[160px]" title={disk.name}>
                          {friendlyName}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-secondary bg-card px-2 py-0.5 rounded border border-border/50">
                        {disk.mount_point}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-secondary mb-1">
                      <span>{usedGB} GB usado</span>
                      <span>{totalGB} GB total</span>
                    </div>
                    
                    <div className="w-full bg-card rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full ${parseFloat(percent) > 85 ? 'bg-rose-500' : 'bg-primary'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-orbit-500 mt-1 font-mono">
                      {percent}%
                    </div>
                  </div>
                );
              })
            ) : (
              <span className="text-secondary text-sm flex items-center justify-center h-full">Carregando discos...</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
