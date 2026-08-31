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
  SlidersHorizontal
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
  const [apps, setApps] = useState<AppStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const { startInstall } = useInstall();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Discover');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [isDockerInstallOpen, setIsDockerInstallOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/store/apps', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to fetch apps');
      const data = await res.json();
      setApps(data);
    } catch (err: any) {
      console.error('Failed to fetch apps:', err);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40 border border-border/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm">
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
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900/70 hover:bg-neutral-800 border border-border/80 text-secondary hover:text-primary transition-all active:scale-[0.98] disabled:opacity-50"
            title={t('store.sync_stores')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-orbit-400' : ''}`} />
            <span className="hidden sm:inline">{syncing ? t('store.syncing_stores') : t('store.sync_stores')}</span>
          </button>
        </div>
      </div>

      <DockerInstallModal isOpen={isDockerInstallOpen} onClose={() => setIsDockerInstallOpen(false)} />

      {/* Main Grid: Left Category Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="bg-card/40 border border-border/70 backdrop-blur-md rounded-2xl p-4 space-y-4 shadow-sm">
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
            <input
              type="text"
              placeholder={t('store.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-900/80 border border-border/70 rounded-xl text-xs text-primary placeholder-secondary/60 focus:outline-none focus:border-orbit-500/80 transition-all"
            />
          </div>

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
              className="w-full px-3 py-2 bg-neutral-900/80 border border-border/70 rounded-xl text-xs text-primary focus:outline-none focus:border-orbit-500/80 transition-all"
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
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === 'Discover' && !search
                  ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                  : 'text-secondary hover:text-primary hover:bg-neutral-800/60'
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
              onClick={() => setSelectedCategory('All')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === 'All'
                  ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                  : 'text-secondary hover:text-primary hover:bg-neutral-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="w-4 h-4" />
                <span>Todas</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCategory === 'All' ? 'bg-white/20 text-white' : 'bg-neutral-800 text-secondary'}`}>
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
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                      : 'text-secondary hover:text-primary hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{category}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-neutral-800 text-secondary'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="space-y-7 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-orbit-500 border-t-transparent"></div>
              <p className="text-xs text-secondary animate-pulse">Carregando catálogo de aplicativos...</p>
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
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-orbit-500/30 text-orbit-300 border border-orbit-400/30">
                            Destaque
                          </span>
                          <span className="text-xs text-white/60 font-medium">
                            {featuredApps[heroIndex]?.category}
                          </span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {apps.slice(0, 4).map((app, index) => (
                    <div
                      key={`trending-${app.id}-${index}`}
                      onClick={() => navigate(`/store/app/${app.id}`)}
                      className="group bg-card/60 hover:bg-card border border-border/70 hover:border-orbit-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-neutral-900 border border-border/50 p-2 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
                          {app.icon ? (
                            <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-5 h-5 text-secondary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-sm text-primary block truncate group-hover:text-orbit-400 transition-colors" title={app.name}>
                            {app.name}
                          </span>
                          <p className="text-[11px] text-secondary line-clamp-2 mt-0.5 leading-relaxed">
                            {app.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
                        <span className="text-[10px] font-medium text-secondary bg-neutral-800/80 px-2 py-0.5 rounded-md">
                          {app.category}
                        </span>
                        <span className="text-xs font-semibold text-orbit-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Explorar
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* All Catalog Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-orbit-400" />
                    <span className="text-base font-bold text-primary tracking-tight">Catálogo de Aplicações</span>
                    <span className="text-xs text-secondary">({filteredApps.length} disponíveis)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    return (
      <div 
        key={`${app.store}-${app.id}-${index}`} 
        onClick={() => navigate(`/store/app/${app.id}`)}
        className="group bg-card/60 hover:bg-card border border-border/70 hover:border-orbit-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between h-full cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 relative"
      >
        <div>
          {/* Header row: Icon & Tags */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-border/60 p-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
              {app.icon ? (
                <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
              ) : (
                <Package className="w-6 h-6 text-secondary" />
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-neutral-800 text-secondary border border-border/50 rounded-full">
                {app.category}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 rounded-full">
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
        
        {/* Actions Grid (Explorar + Install) */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40">
          <div 
            className="w-full py-2 bg-neutral-800/80 text-secondary hover:text-primary rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5 border border-border/50"
          >
            <span>Explorar</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </div>

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
        </div>
      </div>
    );
  }
}
