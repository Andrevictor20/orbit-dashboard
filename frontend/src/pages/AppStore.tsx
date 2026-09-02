import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, 
  Download, 
  Search, 
  RefreshCw, 
  Terminal, 
  Compass, 
  LayoutGrid, 
  Film, 
  Briefcase, 
  Home, 
  Globe, 
  Cpu, 
  Coins, 
  MessageSquare, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Flame, 
  Layers,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInstall } from '../contexts/InstallContext';
import { DockerInstallModal } from '../components/docker/DockerInstallModal';
import toast from 'react-hot-toast';

interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  store: string;
}

interface DockerContainerLite {
  id: string;
  name: string;
  image: string;
  state: string;
  labels?: Record<string, string>;
}

// Global in-memory cache for instant navigation without loading states
let globalAppsCache: AppStoreItem[] = [];
try {
  const cached = localStorage.getItem('orbit_store_apps_cache');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      globalAppsCache = parsed;
    }
  }
} catch {
  // Ignore localStorage read errors
}

const getCategoryIcon = (category: string) => {
  const c = category.toLowerCase();
  if (c === 'all' || c === 'todas') return LayoutGrid;
  if (c === 'discover' || c === 'descobrir') return Compass;
  if (c.includes('media') || c.includes('multim') || c.includes('video') || c.includes('music') || c.includes('audio')) return Film;
  if (c.includes('prod') || c.includes('office') || c.includes('document')) return Briefcase;
  if (c.includes('home') || c.includes('casa') || c.includes('iot') || c.includes('automa')) return Home;
  if (c.includes('net') || c.includes('rede') || c.includes('dns') || c.includes('vpn') || c.includes('proxy')) return Globe;
  if (c.includes('ai') || c.includes('ia') || c.includes('llm') || c.includes('gpt') || c.includes('intel')) return Cpu;
  if (c.includes('finan') || c.includes('money') || c.includes('crypto')) return Coins;
  if (c.includes('social') || c.includes('chat') || c.includes('comun') || c.includes('mensag')) return MessageSquare;
  if (c.includes('dev') || c.includes('code') || c.includes('prog') || c.includes('util') || c.includes('ferram')) return Terminal;
  return Layers;
};

// Gradient palettes for hero showcase
const HERO_GRADIENTS = [
  'from-blue-600/35 via-indigo-900/40 to-neutral-950',
  'from-purple-600/35 via-orbit-900/40 to-neutral-950',
  'from-emerald-600/35 via-teal-950/40 to-neutral-950',
  'from-rose-600/35 via-amber-950/40 to-neutral-950'
];

export function AppStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppStoreItem[]>(() => globalAppsCache);
  const [installedContainers, setInstalledContainers] = useState<DockerContainerLite[]>([]);
  const [loading, setLoading] = useState<boolean>(() => globalAppsCache.length === 0);
  const [syncing, setSyncing] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const { startInstall } = useInstall();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Discover');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [isDockerInstallOpen, setIsDockerInstallOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  const fetchInstalledContainers = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/containers', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setInstalledContainers(data);
        }
      }
    } catch {
      // Ignore background container fetch errors
    }
  };

  const fetchApps = async (retryCount = 0) => {
    try {
      if (globalAppsCache.length === 0) {
        setLoading(true);
      }
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/store/apps', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to fetch apps');
      const data: AppStoreItem[] = await res.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setApps(data);
        globalAppsCache = data;
        try {
          localStorage.setItem('orbit_store_apps_cache', JSON.stringify(data));
        } catch {}
        setLoading(false);
      } else if (retryCount < 6) {
        setTimeout(() => fetchApps(retryCount + 1), 3000);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Failed to fetch apps:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchInstalledContainers();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const loadingToast = toast.loading('Sincronizando lojas de aplicativos...');
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/store/sync', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Catálogo atualizado! (${data.total_apps || 0} apps)`, { id: loadingToast });
        await fetchApps();
      } else {
        toast.error('Erro ao sincronizar lojas.', { id: loadingToast });
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Erro de conexão ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleInstall = async (id: string, appName: string) => {
    try {
      setInstalling(id);
      
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/store/install/${id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Installation failed');
      }

      const data = await res.json();
      if (data.task_id) {
        startInstall(data.task_id, appName);
      }
    } catch (err: any) {
      console.error('Install error:', err);
    } finally {
      setInstalling(null);
    }
  };

  const dynamicCategories = useMemo(() => {
    const unique = Array.from(new Set(apps.map(app => app.category))).filter(Boolean).sort();
    return unique;
  }, [apps]);

  const stores = useMemo(() => ['All', ...Array.from(new Set(apps.map(app => app.store)))].sort(), [apps]);

  // Determine if an app from the store is already installed locally
  const isAppInstalled = useMemo(() => {
    const installedIdentifiers = new Set<string>();
    installedContainers.forEach(c => {
      const cleanName = (c.name || '').replace(/^\//, '').toLowerCase().trim();
      if (cleanName) {
        installedIdentifiers.add(cleanName);
        installedIdentifiers.add(cleanName.replace(/[^a-z0-9]/g, ''));
      }
      if (c.labels) {
        if (c.labels['com.docker.compose.project']) {
          const proj = c.labels['com.docker.compose.project'].toLowerCase().trim();
          installedIdentifiers.add(proj);
          installedIdentifiers.add(proj.replace(/[^a-z0-9]/g, ''));
        }
        if (c.labels['com.docker.compose.service']) {
          const srv = c.labels['com.docker.compose.service'].toLowerCase().trim();
          installedIdentifiers.add(srv);
          installedIdentifiers.add(srv.replace(/[^a-z0-9]/g, ''));
        }
      }
      const rawImage = (c.image || '').split(':')[0].split('/').pop()?.toLowerCase().trim();
      if (rawImage) {
        installedIdentifiers.add(rawImage);
        installedIdentifiers.add(rawImage.replace(/[^a-z0-9]/g, ''));
      }
    });

    return (app: AppStoreItem) => {
      if (!app) return false;
      const id = (app.id || '').toLowerCase().trim();
      const idSimple = id.replace(/[^a-z0-9]/g, '');
      const name = (app.name || '').toLowerCase().trim();
      const nameSimple = name.replace(/[^a-z0-9]/g, '');

      return (
        installedIdentifiers.has(id) || 
        installedIdentifiers.has(idSimple) ||
        installedIdentifiers.has(name) ||
        installedIdentifiers.has(nameSimple)
      );
    };
  }, [installedContainers]);

  // Featured apps for Hero Banner
  const featuredApps = useMemo(() => {
    if (apps.length === 0) return [];
    return apps.slice(0, 5);
  }, [apps]);

  // Auto-advance hero banner
  useEffect(() => {
    if (featuredApps.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % featuredApps.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [featuredApps.length]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(app => {
      const matchesSearch = !q || 
                            app.name.toLowerCase().includes(q) ||
                            app.description.toLowerCase().includes(q) ||
                            app.category.toLowerCase().includes(q);
      
      const matchesCategory = selectedCategory === 'Discover' || 
                              selectedCategory === 'All' || 
                              app.category.toLowerCase() === selectedCategory.toLowerCase();
                              
      const matchesStore = selectedStore === 'All' || app.store === selectedStore;
      
      return matchesSearch && matchesCategory && matchesStore;
    });
  }, [apps, search, selectedCategory, selectedStore]);

  const isDiscoverMode = selectedCategory === 'Discover' && !search.trim() && selectedStore === 'All';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border/70 p-4 sm:p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-orbit-500/10 border border-orbit-500/20 flex items-center justify-center text-orbit-400 shadow-inner shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              {t('store.title')}
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-orbit-500/15 text-orbit-400 border border-orbit-500/30">
                Hub
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-0.5">
              {t('store.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setIsDockerInstallOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orbit-500 hover:bg-orbit-600 text-white shadow-md shadow-orbit-500/20 transition-all active:scale-[0.98]"
            title={t('docker_install.title')}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('store.install_custom')}</span>
          </button>
          
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-card hover:bg-accent border border-border text-secondary hover:text-primary transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
            title={t('store.sync_stores')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-orbit-500' : ''}`} />
            <span className="hidden sm:inline">{syncing ? t('store.syncing_stores') : t('store.sync_stores')}</span>
          </button>
        </div>
      </div>

      <DockerInstallModal isOpen={isDockerInstallOpen} onClose={() => setIsDockerInstallOpen(false)} />

      {/* Main Grid: Left Category Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="bg-card border border-border/70 rounded-2xl p-4 space-y-4 shadow-sm">
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
            <input
              type="text"
              placeholder={t('store.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-accent/50 border border-border rounded-xl text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500/80 transition-all shadow-sm"
            />
          </div>

          {/* Category Mobile / Small screen toggle button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-accent/60 border border-border text-xs font-semibold text-primary transition-all hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orbit-500" />
                <span>Categorias & Filtros ({selectedCategory === 'All' ? 'Todas' : selectedCategory})</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isCategoryMenuOpen ? 'rotate-90 text-primary' : 'text-secondary'}`} />
            </button>
          </div>

          {/* Collapsible content wrapper for small screens, always visible on large screens */}
          <div className={`space-y-4 ${isCategoryMenuOpen ? 'block' : 'hidden lg:block'}`}>
            {/* Store Catalog Selector */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
                  Origem do Catálogo
                </label>
                <SlidersHorizontal className="w-3 h-3 text-secondary/70" />
              </div>
              <select 
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 bg-accent/50 border border-border rounded-xl text-xs text-primary focus:outline-none focus:border-orbit-500/80 transition-all shadow-sm"
              >
                {stores.map(store => (
                  <option key={store} value={store}>
                    {store === 'All' ? t('store.all_stores') : store}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-px bg-border/50 my-1" />

            {/* Navigation Category List */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-secondary uppercase tracking-wider px-2 mb-2">
                Categorias
              </div>

              {/* Discover Button */}
              <button
                onClick={() => {
                  setSelectedCategory('Discover');
                  setSearch('');
                  setIsCategoryMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === 'Discover' && !search
                    ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                    : 'text-secondary hover:text-primary hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4" />
                  <span>Descobrir</span>
                </div>
                <Sparkles className={`w-3 h-3 ${selectedCategory === 'Discover' && !search ? 'text-white' : 'text-orbit-400 opacity-60'}`} />
              </button>

              {/* All Apps Button */}
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setIsCategoryMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === 'All'
                    ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                    : 'text-secondary hover:text-primary hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Todas</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCategory === 'All' ? 'bg-white/20 text-white' : 'bg-accent text-secondary border border-border/60'}`}>
                  {apps.length}
                </span>
              </button>

              {/* Dynamic Categories */}
              {dynamicCategories.map((category) => {
                const Icon = getCategoryIcon(category);
                const count = apps.filter(a => a.category === category).length;
                const isSelected = selectedCategory === category;

                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                        : 'text-secondary hover:text-primary hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{category}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-accent text-secondary border border-border/60'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="space-y-7 min-w-0">
          {loading && apps.length === 0 ? (
            <div className="space-y-6 animate-pulse">
              {/* Hero Banner Skeleton */}
              <div className="h-56 bg-card border border-border/60 rounded-3xl p-8 flex items-end">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-16 h-16 rounded-2xl bg-accent/60 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 bg-accent/60 rounded-full" />
                    <div className="h-7 w-64 bg-accent/80 rounded-lg" />
                    <div className="h-3 w-96 bg-accent/40 rounded" />
                  </div>
                </div>
              </div>

              {/* Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-card border border-border/60 rounded-2xl p-5 h-48 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-accent/60 shrink-0" />
                      <div className="h-5 w-16 bg-accent/60 rounded-full" />
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="h-4 w-3/4 bg-accent/70 rounded" />
                      <div className="h-3 w-full bg-accent/40 rounded" />
                      <div className="h-3 w-4/5 bg-accent/40 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40">
                      <div className="h-8 bg-accent/40 rounded-xl" />
                      <div className="h-8 bg-accent/60 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card border border-border/70 rounded-3xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-orbit-500/10 border border-orbit-500/20 flex items-center justify-center text-orbit-400 shadow-inner">
                <Package className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-lg font-bold text-primary">Nenhum aplicativo no catálogo local</h3>
                <p className="text-xs sm:text-sm text-secondary">
                  O catálogo está sendo baixado em segundo plano ou você pode iniciar a sincronização imediata agora.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orbit-500 hover:bg-orbit-600 text-white shadow-md shadow-orbit-500/20 transition-all active:scale-[0.98]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Sincronizando...' : 'Sincronizar Catálogo'}</span>
                </button>
                <button
                  onClick={() => setIsDockerInstallOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-card hover:bg-accent border border-border text-secondary hover:text-primary transition-all active:scale-[0.98]"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Instalar Manualmente</span>
                </button>
              </div>
            </div>
          ) : isDiscoverMode ? (
            /* ===== DISCOVER / FEATURED VIEW ===== */
            <>
              {/* Hero Banner Carousel */}
              {featuredApps.length > 0 && (
                <div className="relative rounded-3xl overflow-hidden border border-border/80 bg-neutral-950 shadow-xl min-h-[250px] sm:min-h-[270px] flex flex-col justify-end p-6 sm:p-8">
                  {/* Ambient Backdrop Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${HERO_GRADIENTS[heroIndex % HERO_GRADIENTS.length]} transition-all duration-700`} />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_70%)]" />
                  <div className="absolute inset-0 backdrop-blur-[1px]" />

                  {/* Carousel Content */}
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start sm:items-center gap-4 max-w-xl">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-black/60 border border-white/15 p-3 flex items-center justify-center shrink-0 shadow-2xl backdrop-blur-md">
                        {featuredApps[heroIndex]?.icon ? (
                          <img 
                            src={featuredApps[heroIndex]?.icon} 
                            alt={featuredApps[heroIndex]?.name} 
                            className="w-full h-full object-contain drop-shadow-md"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-orbit-400" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-orbit-500/30 text-orbit-300 border border-orbit-400/30">
                            Destaque
                          </span>
                          <span className="text-xs text-white/60 font-medium">
                            {featuredApps[heroIndex]?.category}
                          </span>
                          {featuredApps[heroIndex] && isAppInstalled(featuredApps[heroIndex]) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 rounded-full flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Instalado</span>
                            </span>
                          )}
                        </div>

                        <span className="text-2xl sm:text-3xl font-extrabold text-white block tracking-tight drop-shadow-sm">
                          {featuredApps[heroIndex]?.name}
                        </span>

                        <p className="text-xs sm:text-sm text-white/80 line-clamp-2 leading-relaxed max-w-lg">
                          {featuredApps[heroIndex]?.description}
                        </p>
                      </div>
                    </div>

                    {/* Hero Actions */}
                    <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
                      <button
                        onClick={() => navigate(`/store/app/${featuredApps[heroIndex]?.id}`)}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2"
                      >
                        <span>Explorar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Carousel Indicators & Controls */}
                  <div className="relative z-10 flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5">
                      {featuredApps.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setHeroIndex(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === heroIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                          }`}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHeroIndex((prev) => (prev === 0 ? featuredApps.length - 1 : prev - 1))}
                        className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Previous featured app"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setHeroIndex((prev) => (prev + 1) % featuredApps.length)}
                        className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Next featured app"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Trending Now Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span className="text-base font-bold text-primary tracking-tight">Trending Now</span>
                    <span className="text-xs text-secondary">· Populares na comunidade</span>
                  </div>
                  <button 
                    onClick={() => setSelectedCategory('All')}
                    className="text-xs font-semibold text-orbit-400 hover:text-orbit-300 transition-colors flex items-center gap-1"
                  >
                    <span>Ver todos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
                  {apps.slice(0, 4).map((app, index) => {
                    const isInstalled = isAppInstalled(app);
                    return (
                      <div
                        key={`trending-${app.id}-${index}`}
                        onClick={() => navigate(`/store/app/${app.id}`)}
                        className="group bg-card/60 hover:bg-card border border-border/70 hover:border-orbit-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-accent/60 border border-border p-2 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
                            {app.icon ? (
                              <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
                            ) : (
                              <Package className="w-5 h-5 text-secondary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-sm text-primary block truncate group-hover:text-orbit-500 transition-colors" title={app.name}>
                              {app.name}
                            </span>
                            <p className="text-[11px] text-secondary line-clamp-2 mt-0.5 leading-relaxed">
                              {app.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-secondary bg-accent px-2 py-0.5 rounded-md border border-border/50">
                              {app.category}
                            </span>
                            {isInstalled && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                <span>Instalado</span>
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-orbit-500 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Explorar
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All Catalog Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-orbit-500" />
                    <span className="text-base font-bold text-primary tracking-tight">Catálogo de Aplicações</span>
                    <span className="text-xs text-secondary">({filteredApps.length} disponíveis)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-4">
                  {filteredApps.map((app, index) => renderAppCard(app, index))}
                </div>
              </div>
            </>
          ) : (
            /* ===== CATEGORY / SEARCH FILTERED VIEW ===== */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <div>
                  <h2 className="text-base font-bold text-primary tracking-tight">
                    {selectedCategory === 'All' ? 'Todas as Aplicações' : selectedCategory}
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    {filteredApps.length} {filteredApps.length === 1 ? 'aplicativo encontrado' : 'aplicativos encontrados'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-4">
                {filteredApps.map((app, index) => renderAppCard(app, index))}
                
                {filteredApps.length === 0 && (
                  <div className="col-span-full py-16 text-center space-y-3 bg-card/20 rounded-2xl border border-dashed border-border/60">
                    <Package className="w-10 h-10 text-secondary/50 mx-auto" />
                    <p className="text-sm font-semibold text-primary">Nenhum aplicativo encontrado</p>
                    <p className="text-xs text-secondary max-w-sm mx-auto">
                      Não encontramos apps com o termo "{search}". Tente buscar por outra categoria ou termo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  function renderAppCard(app: AppStoreItem, index: number) {
    const isInstalled = isAppInstalled(app);

    return (
      <div 
        key={`${app.store}-${app.id}-${index}`} 
        onClick={() => navigate(`/store/app/${app.id}`)}
        className="group bg-card hover:bg-card border border-border/80 hover:border-orbit-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between h-full cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 relative"
      >
        <div>
          {/* Header row: Icon & Tags */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-accent/60 border border-border p-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
              {app.icon ? (
                <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
              ) : (
                <Package className="w-6 h-6 text-secondary" />
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isInstalled && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Instalado</span>
                </span>
              )}
              <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-accent text-secondary border border-border/70 rounded-full">
                {app.category}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 bg-orbit-500/10 text-orbit-500 border border-orbit-500/20 rounded-full">
                {app.store}
              </span>
            </div>
          </div>

          {/* Name & Description */}
          <h3 
            className="font-bold text-base text-primary group-hover:text-orbit-400 transition-colors line-clamp-1" 
            title={app.name}
          >
            {app.name}
          </h3>
          
          <p className="text-secondary text-xs line-clamp-2 mt-1 min-h-[34px] leading-relaxed">
            {app.description}
          </p>
        </div>
        
        {/* Actions Grid (Explorar + Install / Gerenciar) */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40">
          <div 
            className="w-full py-2 bg-accent/70 text-secondary hover:text-primary rounded-xl text-xs font-semibold hover:bg-accent transition-all flex items-center justify-center gap-1.5 border border-border/70 shadow-sm"
          >
            <span>Explorar</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </div>

          {isInstalled ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/');
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] flex items-center justify-center gap-1.5"
              title="Aplicativo já instalado no sistema. Clique para abrir ou gerenciar no painel."
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Gerenciar</span>
            </button>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleInstall(app.id, app.name);
              }}
              disabled={installing !== null}
              className="w-full py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {installing === app.id ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }
}
