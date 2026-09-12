import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, 
  RefreshCw, 
  Terminal, 
  Sparkles, 
  ChevronRight, 
  Flame,
  LayoutGrid, 
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ComposeInstallModal } from '../components/docker/ComposeInstallModal';
import { CustomInstallModal } from '../components/docker/CustomInstallModal';
import { PortConflictDialog } from '../components/docker/PortConflictDialog';
import toast from 'react-hot-toast';

import { useStoreAppsQuery, STORE_APPS_QUERY_KEY, type AppStoreItem } from '../queries';
import { AppStoreCard, AppStoreSidebar, AppStoreHeroCarousel, useAppStoreInstall } from '../components/appstore';
import { queryClient } from '../lib/queryClient';

interface DockerContainerLite {
  id: string;
  name: string;
  image: string;
  state: string;
  labels?: Record<string, string>;
}

export function AppStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: queryApps, isLoading: queryLoading } = useStoreAppsQuery();
  const apps = useMemo(() => queryApps || [], [queryApps]);
  const [installedContainers, setInstalledContainers] = useState<DockerContainerLite[]>([]);
  const loading = queryLoading && apps.length === 0;

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Discover');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  const {
    installing,
    customModalApp,
    setCustomModalApp,
    portConflictData,
    setPortConflictData,
    isDockerInstallOpen,
    setIsDockerInstallOpen,
    handleInstall,
    handleCustomInstall,
    handleAcceptSuggestedPorts,
    handleOpenCustomFromConflict,
  } = useAppStoreInstall();

  useEffect(() => {
    if (searchParams.get('custom') === 'true') {
      setIsDockerInstallOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  useEffect(() => {
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
        queryClient.invalidateQueries({ queryKey: STORE_APPS_QUERY_KEY });
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

      <ComposeInstallModal isOpen={isDockerInstallOpen} onClose={() => setIsDockerInstallOpen(false)} />

      {/* Main Grid: Left Category Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <AppStoreSidebar
          stores={stores}
          selectedStore={selectedStore}
          onSelectStore={setSelectedStore}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          apps={apps}
          dynamicCategories={dynamicCategories}
          search={search}
          onSearchChange={setSearch}
          onClearSearch={() => setSearch('')}
          isCategoryMenuOpen={isCategoryMenuOpen}
          onToggleCategoryMenu={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
          onCloseCategoryMenu={() => setIsCategoryMenuOpen(false)}
        />

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
              <AppStoreHeroCarousel
                featuredApps={featuredApps}
                heroIndex={heroIndex}
                onSetHeroIndex={setHeroIndex}
                isAppInstalled={isAppInstalled}
                onExplore={(id) => navigate(`/store/app/${id}`)}
              />


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
                  {apps.slice(0, 4).map((app, index) => (
                    <AppStoreCard
                      key={`trending-${app.id}-${index}`}
                      app={app}
                      index={index}
                      isInstalled={isAppInstalled(app)}
                      installing={installing}
                      onExplore={(id) => navigate(`/store/app/${id}`)}
                      onManage={() => navigate('/')}
                      onInstall={handleInstall}
                      onOpenCustom={(app) => setCustomModalApp(app)}
                    />
                  ))}
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
                  {filteredApps.map((app, index) => (
                    <AppStoreCard
                      key={`${app.store}-${app.id}-${index}`}
                      app={app}
                      index={index}
                      isInstalled={isAppInstalled(app)}
                      installing={installing}
                      onExplore={(id) => navigate(`/store/app/${id}`)}
                      onManage={() => navigate('/')}
                      onInstall={handleInstall}
                      onOpenCustom={(app) => setCustomModalApp(app)}
                    />
                  ))}
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
                {filteredApps.map((app, index) => (
                  <AppStoreCard
                    key={`${app.store}-${app.id}-${index}`}
                    app={app}
                    index={index}
                    isInstalled={isAppInstalled(app)}
                    installing={installing}
                    onExplore={(id) => navigate(`/store/app/${id}`)}
                    onManage={() => navigate('/')}
                    onInstall={handleInstall}
                    onOpenCustom={(app) => setCustomModalApp(app)}
                  />
                ))}
                
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

      {customModalApp && (
        <CustomInstallModal
          appId={customModalApp.id}
          appName={customModalApp.name}
          onClose={() => setCustomModalApp(null)}
          onInstall={handleCustomInstall}
        />
      )}

      {portConflictData && (
        <PortConflictDialog
          isOpen={portConflictData.isOpen}
          onClose={() => setPortConflictData(null)}
          appName={portConflictData.appName}
          conflicts={portConflictData.conflicts}
          onAcceptSuggested={handleAcceptSuggestedPorts}
          onOpenCustom={handleOpenCustomFromConflict}
          installing={installing === portConflictData.appId}
        />
      )}
    </div>
  );
}
