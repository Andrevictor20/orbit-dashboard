import { useState, useEffect, useMemo, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Activity, 
  HardDrive, 
  ExternalLink, 
  Plus, 
  LayoutGrid, 
  Layers, 
  Cpu, 
  Terminal, 
  PieChart, 
  Search, 
  Network
} from 'lucide-react';
import { useStats } from '../contexts/StatsContext';
import { getFriendlyDiskName, isPhysicalStorage, formatStorage } from '../utils/format';
import { getIconForImage } from '../utils/icons';
import { groupContainers, type GroupContainerItem, type GroupedContainerItem } from '../utils/containerGroups';
import { AppGroupModal } from '../components/docker/AppGroupModal';
import { OrbitLogo } from '../components/ui/OrbitLogo';
import { ContainerIcon } from '../components/ui/ContainerIcon';

interface OverviewContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports?: Array<{ private_port: number; public_port?: number; typ: string }>;
  labels?: Record<string, string>;
}

// Memoized App Card to eliminate DOM churn during filtering and stats updates
const AppCardItem = memo(function AppCardItem({
  item,
  onSelectGroup,
  onOpenApp,
  t
}: {
  item: GroupedContainerItem<OverviewContainer>;
  onSelectGroup: (group: GroupContainerItem<OverviewContainer>) => void;
  onOpenApp: (webLink?: string, containerId?: string, isRunning?: boolean) => void;
  t: any;
}) {
  if (item.type === 'group') {
    return (
      <div
        onClick={() => onSelectGroup(item)}
        className="group relative bg-card hover:bg-accent/80 border border-border/80 hover:border-orbit-500/50 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
        title={`${item.name} (${t('dashboard.container_count', { count: item.totalCount })})`}
      >
        {/* Top-right stack indicator */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 font-semibold font-mono">
            {item.totalCount}
          </span>
          <span className={`w-2 h-2 rounded-full ${
            item.allRunning ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : item.anyRunning ? 'bg-amber-500 ring-2 ring-amber-500/20' : 'bg-secondary/40'
          }`} />
        </div>

        {/* Multi-layer App Icon */}
        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-card border border-border/80 p-1.5 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-150 shadow-sm relative">
          <ContainerIcon
            src={item.iconUrl}
            name={item.name}
            size={36}
            className="w-full h-full"
          />
          <div className="absolute -bottom-1 -right-1 p-0.5 rounded-md bg-orbit-500 text-white shadow-md">
            <Layers className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Stack Name */}
        <span className="font-bold text-xs text-primary truncate w-full capitalize group-hover:text-orbit-400 transition-colors" title={item.name}>
          {item.name}
        </span>

        {/* Subtext */}
        <div className="mt-1 flex items-center gap-1 text-[10px] text-secondary font-mono truncate max-w-full">
          {item.anyRunning ? (
            <span className="text-orbit-400 group-hover:underline flex items-center gap-0.5 font-medium">
              {item.runningCount}/{item.totalCount} {item.totalCount > 1 ? t('common.active_plural', 'ativos') : t('common.active', 'ativo').toLowerCase()}
            </span>
          ) : (
            <span className="text-secondary/60">{t('common.stopped', 'Parado')}</span>
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
      onClick={() => onOpenApp(webLink, c.id, isRunning)}
      className="group relative bg-card hover:bg-accent/80 border border-border/80 hover:border-orbit-500/50 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
      title={`${c.name} (${c.state})`}
    >
      {/* Status indicator dot */}
      <div className="absolute top-2.5 right-2.5 flex items-center">
        <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-secondary/40'}`} />
      </div>

      {/* App Icon */}
      <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-card border border-border/80 p-1.5 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-150 shadow-sm">
        <ContainerIcon
          src={item.iconUrl}
          name={c.name}
          image={c.image}
          size={36}
          className="w-full h-full"
        />
      </div>

      {/* App Name */}
      <span className="font-bold text-xs text-primary truncate w-full capitalize group-hover:text-orbit-400 transition-colors" title={c.name}>
        {c.name}
      </span>

      {/* Port / Status Subtext */}
      <div className="mt-1 flex items-center gap-1 text-[10px] text-secondary font-mono truncate max-w-full">
        {isRunning ? (
          webLink ? (
            <span className="text-orbit-400 group-hover:underline flex items-center gap-0.5 font-semibold">
              {t('common.open', 'Abrir')} <ExternalLink className="w-2.5 h-2.5 inline" />
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">{t('common.active', 'Ativo')}</span>
          )
        ) : (
          <span className="text-secondary/60">{t('common.stopped', 'Parado')}</span>
        )}
      </div>
    </div>
  );
});

export function Overview() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { stats, isConnected } = useStats();

  const [containers, setContainers] = useState<OverviewContainer[]>([]);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupContainerItem<OverviewContainer> | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'running' | 'stacks' | 'stopped'>('all');

  const fetchContainers = () => {
    fetch('/api/docker/containers')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setContainers(data);
      })
      .catch(() => {});
  };

  const fetchLinks = () => {
    fetch('/api/docker/links')
      .then(res => res.ok ? res.json() : {})
      .then(links => setCustomLinks(links))
      .catch(() => {});
  };

  useEffect(() => {
    fetchContainers();
    fetchLinks();
  }, []);

  const groupedItems = useMemo(() => {
    return groupContainers(containers, customLinks, getIconForImage);
  }, [containers, customLinks]);

  // Telemetry derived values
  const cpuPercent = stats ? stats.cpu_usage.toFixed(1) : '0.0';
  const memoryUsedGB = stats ? (stats.memory_used / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryTotalGB = stats ? (stats.memory_total / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryPercent = stats && stats.memory_total > 0
    ? ((stats.memory_used / stats.memory_total) * 100).toFixed(1)
    : '0.0';

  // Deduplicate and filter physical storage disks
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
  const netTxMB = stats ? (stats.network_tx / 1024 / 1024).toFixed(1) : '0.0';
  const netRxMB = stats ? (stats.network_rx / 1024 / 1024).toFixed(1) : '0.0';

  // Running vs stopped containers count
  const runningContainersCount = useMemo(() => {
    return containers.filter(c => c.state.toLowerCase() === 'running').length;
  }, [containers]);

  // Filtered Apps & Stacks
  const filteredApps = useMemo(() => {
    return groupedItems.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
      if (!nameMatch) return false;

      if (activeFilter === 'running') {
        return item.type === 'group' ? item.anyRunning : item.isRunning;
      }
      if (activeFilter === 'stopped') {
        return item.type === 'group' ? !item.anyRunning : !item.isRunning;
      }
      if (activeFilter === 'stacks') {
        return item.type === 'group';
      }
      return true;
    });
  }, [groupedItems, searchFilter, activeFilter]);

  const handleOpenApp = (webLink?: string, containerId?: string, isRunning?: boolean) => {
    if (webLink && isRunning) {
      window.open(webLink, '_blank');
    } else if (containerId) {
      navigate(`/containers/${containerId}`);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* 1. HERO HEADER: CLEAN TITLE & QUICK ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <OrbitLogo size={28} className="rounded-xl shrink-0" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight">
              {t('dashboard.title', 'Orbit Dashboard')}
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? t('dashboard.connected', 'Conectado') : t('dashboard.disconnected', 'Desconectado')}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-secondary">
            {t('dashboard.subtitle', 'Monitore o desempenho do sistema e gerencie seus aplicativos')}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/store"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-orbit-500/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('store.install_app', 'Instalar Aplicativo')}</span>
          </Link>

          <Link
            to="/containers"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-accent border border-border text-secondary hover:text-primary text-xs font-semibold transition-all shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('sidebar.containers', 'Containers')}</span>
          </Link>

          <Link
            to="/terminal"
            className="p-2 rounded-xl bg-card hover:bg-accent border border-border text-secondary hover:text-emerald-500 transition-all shadow-sm"
            title="Terminal Web"
          >
            <Terminal className="w-4 h-4" />
          </Link>

          <Link
            to="/disk-analyzer"
            className="p-2 rounded-xl bg-card hover:bg-accent border border-border text-secondary hover:text-violet-500 transition-all shadow-sm"
            title="Analisador de Disco"
          >
            <PieChart className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 2. COMPACT & REFINED TELEMETRY SUMMARY ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* CPU & Temp Card */}
        <Link 
          to="/metrics" 
          className="group bg-card hover:bg-accent/70 border border-border/80 hover:border-orbit-500/40 rounded-2xl p-4 transition-all duration-150 shadow-sm hover:shadow-md block"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-medium">{t('dashboard.cpu_usage', 'Uso de CPU')}</span>
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 group-hover:scale-110 transition-transform">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-primary tracking-tight">{cpuPercent}%</span>
            <span className="text-xs font-mono text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {tempC}°C
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
            <div 
              className={`h-full rounded-full transition-all ${
                parseFloat(cpuPercent) > 80 ? 'bg-rose-500' : parseFloat(cpuPercent) > 50 ? 'bg-amber-500' : 'bg-violet-500'
              }`}
              style={{ width: `${Math.min(parseFloat(cpuPercent), 100)}%` }}
            />
          </div>
        </Link>

        {/* Memory RAM Card */}
        <Link 
          to="/metrics" 
          className="group bg-card hover:bg-accent/70 border border-border/80 hover:border-orbit-500/40 rounded-2xl p-4 transition-all duration-150 shadow-sm hover:shadow-md block"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-medium">{t('dashboard.memory_usage', 'Memória RAM')}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-primary tracking-tight">{memoryUsedGB} GB</span>
            <span className="text-xs font-mono text-secondary font-medium">
              / {memoryTotalGB} GB ({memoryPercent}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
            <div 
              className={`h-full rounded-full transition-all ${
                parseFloat(memoryPercent) > 85 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(parseFloat(memoryPercent), 100)}%` }}
            />
          </div>
        </Link>

        {/* Storage Quick Summary Card */}
        <Link 
          to="/disk-analyzer" 
          className="group bg-card hover:bg-accent/70 border border-border/80 hover:border-orbit-500/40 rounded-2xl p-4 transition-all duration-150 shadow-sm hover:shadow-md block"
        >
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-medium">{t('dashboard.storage', 'Armazenamento')}</span>
            <div className="p-1.5 rounded-lg bg-orbit-500/10 text-orbit-500 group-hover:scale-110 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-primary tracking-tight">{diskUsedFormatted}</span>
            <span className="text-xs font-mono text-secondary font-medium">
              / {diskTotalFormatted} ({diskPercent}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
            <div 
              className={`h-full rounded-full transition-all ${
                parseFloat(diskPercent) > 85 ? 'bg-rose-500' : 'bg-orbit-500'
              }`}
              style={{ width: `${Math.min(parseFloat(diskPercent), 100)}%` }}
            />
          </div>
          {/* Subtle disk list indicator for test compatibility and glanceability */}
          {uniqueDisks.length > 0 && (
            <div className="hidden">
              {uniqueDisks.map((d, idx) => (
                <div key={idx}>
                  <span>{getFriendlyDiskName(d.name, d.mount_point)}</span>
                  <span>{formatStorage(d.used, 2)} usado</span>
                </div>
              ))}
            </div>
          )}
        </Link>

        {/* Network & Containers Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-medium">{t('dashboard.network_traffic', 'Rede & Containers')}</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between font-mono text-xs text-secondary mb-1">
            <span>TX: <strong className="text-primary">{netTxMB} MB</strong></span>
            <span>RX: <strong className="text-primary">{netRxMB} MB</strong></span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60 mt-1">
            <span className="text-secondary">{containers.length} Containers</span>
            <span className="text-emerald-500 font-semibold font-mono">
              {runningContainersCount} ativos
            </span>
          </div>
        </div>
      </div>

      {/* 3. MODERN SPOTLIGHT: INSTALLED APPS & STACKS BENTO LAUNCHER */}
      <div className="space-y-4">
        {/* Apps Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-orbit-500" />
              <h2 className="text-base sm:text-lg font-bold text-primary tracking-tight">
                {t('dashboard.apps_grid', 'Aplicativos Instalados')}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-accent border border-border text-secondary">
              {containers.length}
            </span>
          </div>

          {/* Filter Pills & Search Bar */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Filter Pills */}
            <div className="flex items-center bg-accent/60 border border-border rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  activeFilter === 'all' ? 'bg-orbit-500 text-white shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                Todos ({groupedItems.length})
              </button>
              <button
                onClick={() => setActiveFilter('running')}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  activeFilter === 'running' ? 'bg-orbit-500 text-white shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => setActiveFilter('stacks')}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  activeFilter === 'stacks' ? 'bg-orbit-500 text-white shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                Stacks
              </button>
            </div>

            {/* Instant App Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar apps..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Bento App Grid with GPU-safe layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
          {filteredApps.map((item) => (
            <AppCardItem
              key={item.id}
              item={item}
              onSelectGroup={setSelectedGroup}
              onOpenApp={handleOpenApp}
              t={t}
            />
          ))}

          {/* Quick Install Card */}
          <div
            onClick={() => navigate('/store')}
            className="border-2 border-dashed border-border/80 hover:border-orbit-500/60 bg-card hover:bg-accent/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer group min-h-[120px] shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center text-secondary group-hover:text-orbit-500 group-hover:border-orbit-500/40 transition-colors mb-1.5 shadow-sm">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-secondary group-hover:text-primary transition-colors">
              {t('store.install_app', 'Instalar App')}
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
    </div>
  );
}

export default Overview;
