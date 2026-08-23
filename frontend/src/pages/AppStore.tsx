import { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Package, Download, Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInstall } from '../contexts/InstallContext';
import toast from 'react-hot-toast';

interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  store: string;
}

export function AppStore() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const { startInstall } = useInstall();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStore, setSelectedStore] = useState<string>('All');

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
        // Async install — open progress modal
        startInstall(data.task_id, appName);
      }
    } catch (err: any) {
      console.error('Install error:', err);
    } finally {
      setInstalling(null);
    }
  };

  const categories = useMemo(() => ['All', ...Array.from(new Set(apps.map(app => app.category)))].sort(), [apps]);
  const stores = useMemo(() => ['All', ...Array.from(new Set(apps.map(app => app.store)))].sort(), [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      const searchLower = deferredSearch.toLowerCase();
      const matchesSearch = app.name.toLowerCase().includes(searchLower) || 
                            app.description.toLowerCase().includes(searchLower);
      const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
      const matchesStore = selectedStore === 'All' || app.store === selectedStore;
      
      return matchesSearch && matchesCategory && matchesStore;
    });
  }, [apps, deferredSearch, selectedCategory, selectedStore]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Store</h1>
          <p className="text-secondary mt-1">One-click install applications.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-card/60 hover:bg-card border border-border text-secondary hover:text-primary transition-all active:scale-[0.98] disabled:opacity-50"
          title="Sincronizar lojas de aplicativos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-orbit-400' : ''}`} />
          <span>{syncing ? 'Sincronizando Lojas...' : 'Sincronizar Lojas'}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex gap-2">
          <select 
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {stores.map(store => (
              <option key={store} value={store}>{store === 'All' ? 'All Stores' : store}</option>
            ))}
          </select>

          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category === 'All' ? 'All Categories' : category}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        
        <div className="flex items-center text-gray-400 text-sm whitespace-nowrap">
          {filteredApps.length} {filteredApps.length === 1 ? 'app' : 'apps'}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredApps.map((app, index) => (
            <div 
              key={`${app.store}-${app.id}-${index}`} 
              onClick={() => navigate(`/store/app/${app.id}`)}
              className="border shad-border rounded-lg p-5 bg-background hover:border-primary/50 transition-colors flex flex-col h-full cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center p-2 overflow-hidden">
                  {app.icon ? (
                    <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
                  ) : (
                    <Package className="w-6 h-6 text-secondary" />
                  )}
                </div>
              </div>
              
              <h3 className="font-semibold text-lg mb-1 line-clamp-1" title={app.name}>{app.name}</h3>
              <p className="text-gray-400 text-sm line-clamp-2 mt-1 min-h-[40px]">{app.description}</p>
              <div className="flex gap-2 mt-2 mb-4">
                <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-full">{app.category}</span>
                <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-full">{app.store}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div 
                  className="w-full py-2 bg-gray-800 text-gray-300 hover:text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  Explorar
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstall(app.id, app.name);
                  }}
                  disabled={installing !== null}
                  className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {installing === app.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Install
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
          
          {filteredApps.length === 0 && (
            <div className="col-span-full py-12 text-center text-secondary">
              No apps found matching "{search}"
            </div>
          )}
        </div>
      )}

    </div>
  );
}
