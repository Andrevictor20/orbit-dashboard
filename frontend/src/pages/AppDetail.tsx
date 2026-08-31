import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Settings, ChevronDown, Package } from 'lucide-react';
import { CustomInstallModal } from '../components/docker/CustomInstallModal';
import { useInstall } from '../contexts/InstallContext';

interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  store: string;
  compose_file: string;
}

export function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppStoreItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const { startInstall } = useInstall();

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/store/apps');
        if (!res.ok) throw new Error('Failed to fetch apps');
        const data: AppStoreItem[] = await res.json();
        const found = data.find(a => a.id === id);
        if (found) {
          setApp(found);
        } else {
          setError('App not found');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApp();
  }, [id]);

  const handleInstall = async (custom: boolean, payload?: any) => {
    if (custom && !payload) {
      setShowCustomModal(true);
      return;
    }
    
    try {
      setInstalling(true);
      setError(null);
      
      const endpoint = custom ? `/api/store/install/custom/${app?.id}` : `/api/store/install/${app?.id}`;
      const options = custom ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      } : { method: 'POST' };

      const res = await fetch(endpoint, options);
      
      if (!res.ok) throw new Error(await res.text() || 'Installation failed');
      
      if (res.status === 202) {
        // Backend task started for tracking
        const data = await res.json();
        startInstall(data.task_id, app!.name);
      } else {
        // Sync installation (fallback)
        setTimeout(() => navigate('/containers'), 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-500">
        {error || 'App not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/store')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="bg-background border shad-border rounded-xl p-8 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-32 h-32 bg-accent rounded-2xl flex items-center justify-center p-4 shrink-0 shadow-lg">
          {app.icon ? (
            <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
          ) : (
            <Package className="w-16 h-16 text-secondary" />
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <p className="text-gray-400 mt-2 text-lg">{app.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-800">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">Categoria</div>
              <div className="mt-1 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span>{app.category}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold">Loja / Repositório</div>
              <div className="mt-1 font-medium">{app.store}</div>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <div className="relative">
              <div className="flex">
                <button 
                  onClick={() => handleInstall(false)}
                  disabled={installing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-l-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {installing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  Instalar
                </button>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={installing}
                  className="px-3 py-3 bg-blue-700 text-white rounded-r-lg hover:bg-blue-800 transition-colors border-l border-blue-500 disabled:opacity-50"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-10">
                  <button 
                    onClick={() => { setIsDropdownOpen(false); handleInstall(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Instalação Personalizada
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showCustomModal && (
        <CustomInstallModal 
          appId={app.id} 
          onClose={() => setShowCustomModal(false)}
          onInstall={(payload) => {
            setShowCustomModal(false);
            handleInstall(true, payload);
          }}
        />
      )}
    </div>
  );
}
