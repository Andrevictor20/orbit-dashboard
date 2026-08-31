import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/ui/StatCard';
import { TrendingUp, Activity, HardDrive, Box, FolderOpen, ExternalLink, Plus, LayoutGrid, Layers } from 'lucide-react';
import { useStats } from '../contexts/StatsContext';
import { getFriendlyDiskName, isPhysicalStorage, formatStorage } from '../utils/format';
import { getIconForImage } from '../utils/icons';
import { groupContainers, type GroupContainerItem } from '../utils/containerGroups';
import { AppGroupModal } from '../components/ui/AppGroupModal';
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

interface OverviewContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports?: Array<{ private_port: number; public_port?: number; typ: string }>;
  labels?: Record<string, string>;
}

export function Overview() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { stats, isConnected } = useStats();

  const [history, setHistory] = useState<ChartDataPoint[]>([]);
  const [containers, setContainers] = useState<OverviewContainer[]>([]);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupContainerItem | null>(null);

  const fetchContainers = () => {
    fetch('/api/docker/containers')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setContainers(data);
      })
      .catch(() => { });
  };

  const fetchLinks = () => {
    fetch('/api/docker/links')
      .then(res => res.ok ? res.json() : {})
      .then(links => setCustomLinks(links))
      .catch(() => { });
  };

  useEffect(() => {
    fetchContainers();
    fetchLinks();
  }, []);

  const groupedItems = useMemo(() => {
    return groupContainers(containers, customLinks, getIconForImage);
  }, [containers, customLinks]);

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

  // Deduplicate and filter only real physical storage disks
  const uniqueDisksMap = new Map<string, any>();
  if (stats && Array.isArray(stats.disks)) {
    stats.disks.forEach((d: any) => {
      if (!isPhysicalStorage(d.name, d.mount_point, d.fs_type, d.total)) {
        return;
      }
      const key = d.name.startsWith('/dev/') ? d.name : getFriendlyDiskName(d.name, d.mount_point);
      if (uniqueDisksMap.has(key)) {
        const existing = uniqueDisksMap.get(key)!;
        if (d.mount_point === '/' || d.mount_point.startsWith('/home') || d.mount_point.startsWith('/mnt') || d.mount_point.startsWith('/media')) {
          existing.mount_point = d.mount_point;
          existing.used = Math.max(existing.used, d.used);
          existing.total = Math.max(existing.total, d.total);
        }
      } else {
        uniqueDisksMap.set(key, { ...d });
      }
    });
  }
  const uniqueDisks = Array.from(uniqueDisksMap.values());

  const globalDiskUsed = uniqueDisks.reduce((acc, d) => acc + d.used, 0);
  const globalDiskTotal = uniqueDisks.reduce((acc, d) => acc + d.total, 0);

  const diskUsedFormatted = formatStorage(globalDiskUsed, 2);
  const diskTotalFormatted = formatStorage(globalDiskTotal, 2);
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
          title={t('metrics.temperature')}
          value={`${tempC}°C`}
          trend="Sys"
          trendUp={parseFloat(tempC) < 75}
          subText={t('metrics.temperature')}
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
          title={t('dashboard.network_traffic')}
          value={`${(stats ? stats.network_tx / 1024 / 1024 : 0).toFixed(1)} MB`}
          trend={`${(stats ? stats.network_rx / 1024 / 1024 : 0).toFixed(1)} MB`}
          trendUp={true}
          subText={t('dashboard.network_traffic')}
          icon={Box}
        />
        <StatCard
          title={t('dashboard.storage')}
          value={diskUsedFormatted}
          trend={`${diskPercent}%`}
          trendUp={parseFloat(diskPercent) < 85}
          subText={`${diskTotalFormatted} ${t('dashboard.total')}`}
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
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
          <div className="mb-4 sm:mb-6 sticky top-0 bg-background/80 backdrop-blur-md pb-2 z-10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">{t('dashboard.storage')}</h3>
            <button
              onClick={() => navigate('/files')}
              className="text-xs text-orbit-400 hover:text-orbit-300 font-medium flex items-center gap-1 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t('common.all')}</span>
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {uniqueDisks.length > 0 ? (
              uniqueDisks.map((disk, idx) => {
                const usedFormatted = formatStorage(disk.used, 2);
                const totalFormatted = formatStorage(disk.total, 2);
                const percent = disk.total > 0 ? ((disk.used / disk.total) * 100).toFixed(1) : '0.0';
                const friendlyName = getFriendlyDiskName(disk.name, disk.mount_point);

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(`/files?path=${encodeURIComponent(disk.mount_point || '/')}`)}
                    className="bg-accent/30 border border-border hover:border-orbit-500/50 hover:bg-accent/60 rounded-xl p-3.5 transition-all cursor-pointer group shadow-sm"
                    title={`Abrir ${friendlyName} no Gerenciador de Arquivos`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-orbit-500/10 text-orbit-400 group-hover:bg-orbit-500/20 group-hover:text-orbit-300 transition-colors shrink-0">
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-primary text-sm truncate" title={disk.name}>
                          {friendlyName}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-orbit-400 bg-orbit-500/10 px-2 py-0.5 rounded-full border border-orbit-500/20 font-semibold shrink-0">
                        {percent}%
                      </span>
                    </div>

                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${parseFloat(percent) > 85 ? 'bg-rose-500' : 'bg-orbit-500 group-hover:bg-orbit-400'
                          }`}
                        style={{ width: `${Math.min(parseFloat(percent), 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-secondary font-mono">
                      <span>{usedFormatted} {t('common.used').toLowerCase()}</span>
                      <span>{totalFormatted} {t('common.total').toLowerCase()}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-secondary text-xs gap-2 py-8">
                <HardDrive className="w-8 h-8 stroke-[1.5] text-zinc-600" />
                <span>{t('volumes.no_volumes')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CasaOS Style Installed Apps Grid */}
      <div className="mt-6 sm:mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-orbit-400" />
            <h3 className="text-base sm:text-lg font-semibold text-primary">{t('dashboard.apps_grid')}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-secondary font-mono">
              {containers.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/store')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 hover:bg-orbit-500/20 transition-all text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('store.install_app')}</span>
            </button>
            <button
              onClick={() => navigate('/containers')}
              className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1 font-medium px-2 py-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('sidebar.containers')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
          {groupedItems.map((item) => {
            if (item.type === 'group') {
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedGroup(item)}
                  className="group relative bg-card/60 hover:bg-accent/70 border border-border/70 hover:border-orbit-500/50 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  title={`${item.name} (${t('dashboard.container_count', { count: item.totalCount })})`}
                >
                  {/* Top-right stack count badge & running indicator */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-orbit-500/20 text-orbit-300 border border-orbit-500/30 font-semibold font-mono">
                      {item.totalCount}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      item.allRunning ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : item.anyRunning ? 'bg-amber-500 ring-2 ring-amber-500/20' : 'bg-zinc-600'
                    }`} />
                  </div>

                  {/* Stack App Icon with multi-layer effect */}
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900/60 p-2 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-200 shadow-inner relative">
                    <img
                      src={item.iconUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded bg-orbit-500 text-white shadow-sm">
                      <Layers className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Stack Name */}
                  <span className="font-semibold text-xs text-primary truncate w-full capitalize" title={item.name}>
                    {item.name}
                  </span>

                  {/* Status / Sub-containers Subtext */}
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-secondary font-mono truncate max-w-full">
                    {item.anyRunning ? (
                      <span className="text-orbit-400 group-hover:underline flex items-center gap-0.5">
                        {item.runningCount}/{item.totalCount} {item.totalCount > 1 ? t('common.active_plural', 'ativos') : t('common.active', 'ativo').toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-zinc-500">{t('common.stopped')}</span>
                    )}
                  </div>
                </div>
              );
            }

            const c = item.container;
            const isRunning = item.isRunning;
            const webLink = item.webLink;

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (webLink && isRunning) {
                    window.open(webLink, '_blank');
                  } else {
                    navigate(`/containers/${c.id}`);
                  }
                }}
                className="group relative bg-card/60 hover:bg-accent/70 border border-border/70 hover:border-orbit-500/50 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
                title={`${c.name} (${c.state})`}
              >
                {/* Status indicator dot */}
                <div className="absolute top-2.5 right-2.5 flex items-center">
                  <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-600'}`} />
                </div>

                {/* App Icon */}
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/60 p-2 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-200 shadow-inner">
                  <img
                    src={item.iconUrl}
                    alt={c.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* App Name */}
                <span className="font-semibold text-xs text-primary truncate w-full capitalize" title={c.name}>
                  {c.name}
                </span>

                {/* Port / Status Subtext */}
                <div className="mt-1 flex items-center gap-1 text-[10px] text-secondary font-mono truncate max-w-full">
                  {isRunning ? (
                    webLink ? (
                      <span className="text-orbit-400 group-hover:underline flex items-center gap-0.5">
                        {t('common.open')} <ExternalLink className="w-2.5 h-2.5 inline" />
                      </span>
                    ) : (
                      <span className="text-emerald-400">{t('common.active')}</span>
                    )
                  ) : (
                    <span className="text-zinc-500">{t('common.stopped')}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick Install Card */}
          <div
            onClick={() => navigate('/store')}
            className="border-2 border-dashed border-border/70 hover:border-orbit-500/50 bg-card/20 hover:bg-orbit-500/5 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer group min-h-[110px]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-secondary group-hover:text-orbit-400 group-hover:bg-orbit-500/10 transition-colors mb-1.5">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-secondary group-hover:text-primary transition-colors">
              {t('store.install_app')}
            </span>
          </div>
        </div>
      </div>

      {/* App Group / Stack Sub-Containers Modal */}
      <AppGroupModal
        group={selectedGroup}
        isOpen={Boolean(selectedGroup)}
        onClose={() => setSelectedGroup(null)}
        onRefresh={fetchContainers}
        customLinks={customLinks}
      />
    </>
  );
}
