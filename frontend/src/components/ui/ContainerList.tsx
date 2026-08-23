import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, RefreshCw, LayoutGrid, List, RotateCw, Pause, PlayCircle, ExternalLink, Link as LinkIcon, Settings2, X, Globe, DownloadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRAM, formatBytes } from '../../utils/format';
import { getIconForImage } from '../../utils/icons';

interface PortInfo {
  ip?: string;
  private_port: number;
  public_port?: number;
  typ: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_percent?: number;
  memory_used?: number;
  memory_limit?: number;
  ports?: PortInfo[];
  labels?: Record<string, string>;
  size_rw?: number;
  size_root_fs?: number;
}

// Global memory cache for instantaneous tab switching (SWR)
let globalContainerCache: Container[] | null = null;

export function ContainerList() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>(() => globalContainerCache || []);
  const [loading, setLoading] = useState(() => !globalContainerCache || globalContainerCache.length === 0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [updatesMap, setUpdatesMap] = useState<Record<string, { has_update: boolean }>>({});
  const [updatingContainerId, setUpdatingContainerId] = useState<string | null>(null);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [linkModal, setLinkModal] = useState<{ isOpen: boolean, containerId: string | null }>({ isOpen: false, containerId: null });
  const [linkInput, setLinkInput] = useState('');
  const [linkMode, setLinkMode] = useState<'builder' | 'raw'>('builder');
  const [linkSubdomain, setLinkSubdomain] = useState('');
  const [linkDomain, setLinkDomain] = useState('');
  
  // New filtering and sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'cpu' | 'ram' | 'disk'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchContainers = async (showLoading = true) => {
    if (showLoading && (!globalContainerCache || globalContainerCache.length === 0)) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/docker/containers');
      if (res.ok) {
        const data: Container[] = await res.json();
        
        // Update containers immediately with basic fast listing
        setContainers(prev => {
          const updated = data.map(c => {
            const existing = prev.find(p => p.id === c.id);
            return existing 
              ? { ...c, cpu_percent: existing.cpu_percent, memory_used: existing.memory_used, memory_limit: existing.memory_limit }
              : c;
          });
          globalContainerCache = updated;
          return updated;
        });
        setLoading(false);

        // Fetch CPU/RAM stats in the background without stalling the view
        fetch('/api/docker/containers/stats/snapshot')
          .then(r => r.ok ? r.json() : null)
          .then(statsData => {
            if (statsData) {
              setContainers(prev => {
                const merged = prev.map(c => {
                  const stat = statsData.find((s: any) => s.id.startsWith(c.id));
                  if (stat) {
                    return { ...c, cpu_percent: stat.cpu_percent, memory_used: stat.memory_used, memory_limit: stat.memory_limit };
                  }
                  return c;
                });
                globalContainerCache = merged;
                return merged;
              });
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to fetch containers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (e: React.MouseEvent, id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await fetch(`/api/docker/containers/${id}/${action}`, { method: 'POST' });
      await fetchContainers();
    } catch (err) {
      console.error(`Failed to ${action} container`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/docker/links', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomLinks(data);
      }
    } catch (err) {
      console.error('Failed to fetch links', err);
    }
  };

  const handleSetCustomLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const currentLink = customLinks[id] || '';
    setLinkInput(currentLink);

    const savedDomain = localStorage.getItem('orbit_base_domain') || '';
    setLinkDomain(savedDomain);
    setLinkSubdomain('');
    
    if (currentLink && currentLink.startsWith('https://') && savedDomain && currentLink.endsWith(`.${savedDomain}`)) {
      const sub = currentLink.replace('https://', '').replace(`.${savedDomain}`, '');
      if (!sub.includes('/')) {
        setLinkSubdomain(sub);
        setLinkMode('builder');
      } else {
        setLinkMode('raw');
      }
    } else {
      setLinkMode(currentLink ? 'raw' : 'builder');
    }

    setLinkModal({ isOpen: true, containerId: id });
  };

  const handleSaveLink = async () => {
    if (!linkModal.containerId) return;
    const id = linkModal.containerId;
    
    let newLink = '';
    if (linkMode === 'builder') {
      if (linkSubdomain && linkDomain) {
        newLink = `https://${linkSubdomain.trim()}.${linkDomain.trim()}`;
        localStorage.setItem('orbit_base_domain', linkDomain.trim());
      }
    } else {
      newLink = linkInput.trim();
    }
    
    setLinkModal({ isOpen: false, containerId: null });
    
    try {
      const res = await fetch(`/api/docker/links/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newLink })
      });
      if (!res.ok) {
        alert(`Erro ao salvar link: ${res.status} ${res.statusText}`);
      }
      fetchLinks();
    } catch (err) {
      console.error('Failed to set link', err);
      alert(`Erro na rede ao tentar salvar link: ${err}`);
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/docker/containers/check-updates');
      if (res.ok) {
        const data = await res.json();
        setUpdatesMap(data);
      }
    } catch (_) {}
  };

  const handleUpdateContainer = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUpdatingContainerId(id);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/docker/containers/${id}/update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUpdatesMap(prev => ({ ...prev, [id]: { has_update: false } }));
        await fetchContainers(false);
      } else {
        const err = await res.text();
        alert(`Erro ao atualizar container: ${err}`);
      }
    } catch (err) {
      console.error('Failed to update container', err);
    } finally {
      setUpdatingContainerId(null);
    }
  };

  useEffect(() => {
    fetchContainers();
    fetchLinks();
    fetchUpdates();
    const interval = setInterval(() => {
      if (!actionLoading) {
        fetchContainers(false);
      }
    }, 10000); // refresh every 10s as proposed
    return () => clearInterval(interval);
  }, [actionLoading]);

  // Smart Sorting and Filtering logic
  const query = searchQuery.trim().toLowerCase();
  const filteredAndSortedContainers = [...containers]
    .filter(c => {
      if (!query) return true;

      const name = (c.name || '').toLowerCase();
      const image = (c.image || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      const state = (c.state || '').toLowerCase();

      const portStrings = (c.ports || []).flatMap(p => [
        p.public_port?.toString() || '',
        p.private_port?.toString() || '',
      ]);

      const labelStrings = c.labels ? Object.values(c.labels).map(v => v.toLowerCase()) : [];

      if (
        name.includes(query) ||
        image.includes(query) ||
        id.includes(query) ||
        state.includes(query) ||
        portStrings.some(p => p.includes(query)) ||
        labelStrings.some(l => l.includes(query))
      ) {
        return true;
      }

      // Typo & alias tolerant matching (e.g. "overseer" -> "overseerr", "qbit" -> "qbittorrent")
      if (query === 'overseer' && (name.includes('overseerr') || image.includes('overseerr'))) return true;
      if (query === 'overseerr' && (name.includes('overseer') || image.includes('overseer'))) return true;
      if (query === 'qbit' && (name.includes('qbittorrent') || image.includes('qbittorrent'))) return true;

      return false;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'cpu':
          comparison = (a.cpu_percent || 0) - (b.cpu_percent || 0);
          break;
        case 'ram':
          comparison = (a.memory_used || 0) - (b.memory_used || 0);
          break;
        case 'disk':
          const diskA = (a.size_rw || 0) + (a.size_root_fs || 0);
          const diskB = (b.size_rw || 0) + (b.size_root_fs || 0);
          comparison = diskA - diskB;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-primary flex items-center gap-2">
            Inventário de Containers
          </h3>
          <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">Gerencie e monitore o consumo dos serviços</p>
        </div>
        <div className="flex gap-2 items-center self-start sm:self-auto">
          <div className="flex bg-card p-1 rounded-md border border-border">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:text-white'}`}
              aria-label="Visualização em grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:text-white'}`}
              aria-label="Visualização em tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => fetchContainers(true)}
            className="px-3 sm:px-4 py-2 bg-accent hover:bg-orbit-700 text-white rounded-md flex items-center gap-2 transition-colors text-xs sm:text-sm font-medium border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>
      
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all text-primary"
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs sm:text-sm text-secondary font-medium whitespace-nowrap">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all text-primary flex-1 sm:flex-none"
          >
            <option value="name">Nome</option>
            <option value="cpu">CPU</option>
            <option value="ram">Memória</option>
            <option value="disk">Disco</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-background border border-border rounded-md hover:bg-accent text-secondary hover:text-primary transition-colors text-sm font-medium"
            title={`Ordem ${sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}`}
            aria-label="Alternar ordem de classificação"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {loading && containers.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pb-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 bg-background/80 rounded-xl border border-border shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-background/80 rounded w-3/4" />
                  <div className="h-3 bg-background/50 rounded w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
                <div className="h-6 bg-background/50 rounded" />
                <div className="h-6 bg-background/50 rounded" />
                <div className="h-6 bg-background/50 rounded" />
              </div>
              <div className="h-8 bg-background/50 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {filteredAndSortedContainers.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-secondary border border-dashed border-border rounded-lg bg-card/50">
          Nenhum container encontrado.
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pb-4">
          {filteredAndSortedContainers.map(c => (
            <div 
              key={c.id} 
              onClick={() => navigate(`/containers/${c.id}`)}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 relative group hover:border-orbit-600 transition-colors cursor-pointer shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 bg-background rounded-xl flex items-center justify-center border border-border shadow-inner shrink-0">
                    <img 
                      src={getIconForImage(c.image, c.name)} 
                      alt={c.name} 
                      onError={(e) => {
                        if (!e.currentTarget.src.endsWith('docker.png')) {
                          e.currentTarget.src = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png';
                        }
                      }}
                      className="w-10 h-10 object-contain drop-shadow-md" 
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-primary truncate max-w-[150px]" title={c.name}>{c.name}</span>
                    <span className="text-[11px] text-zinc-400 truncate max-w-[150px]" title={c.image}>
                      {c.labels?.['com.docker.compose.service'] || c.labels?.['io.casaos.app.name'] || c.image.split(':')[0].split('/').pop()}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${c.state?.toLowerCase() === 'running' ? 'bg-emerald-500' : c.state?.toLowerCase() === 'paused' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span className="text-xs text-secondary capitalize">{c.state}</span>
                    </div>
                  </div>
                </div>

                {updatesMap[c.id]?.has_update && (
                  <button
                    onClick={(e) => handleUpdateContainer(e, c.id)}
                    disabled={updatingContainerId === c.id}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 text-[10px] font-semibold hover:bg-violet-500/30 transition-all shadow-sm shadow-violet-900/20 shrink-0"
                    title="Nova versão da imagem disponível para seu dispositivo. Clique para atualizar e reiniciar."
                  >
                    <DownloadCloud className={`w-3 h-3 ${updatingContainerId === c.id ? 'animate-bounce' : ''}`} />
                    <span>{updatingContainerId === c.id ? '...' : 'Atualizar'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 bg-background p-3 rounded-lg border border-border/50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-orbit-500 uppercase font-semibold">CPU</span>
                  <span className="text-xs text-secondary font-mono">{c.cpu_percent?.toFixed(1) || '0.0'}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-orbit-500 uppercase font-semibold">RAM</span>
                  <span className="text-xs text-secondary font-mono">{formatRAM(c.memory_used)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-orbit-500 uppercase font-semibold">Disco</span>
                  <span className="text-xs text-secondary font-mono">{formatBytes((c.size_rw || 0) + (c.size_root_fs || 0))}</span>
                </div>
              </div>

              {/* Links Bar */}
              <div className="flex items-center gap-2 mt-auto pt-2">
                {(() => {
                  const firstPublic = c.ports?.find(p => p.public_port);
                  if (firstPublic) {
                    const ip = window.location.hostname;
                    return (
                      <button 
                        onClick={(e) => { e.stopPropagation(); window.open(`http://${ip}:${firstPublic.public_port}`, '_blank'); }}
                        className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-primary flex-1 flex items-center justify-center gap-1.5 border border-border/50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>IP:Porta</span>
                      </button>
                    );
                  }
                  return null;
                })()}
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (customLinks[c.id]) {
                      window.open(customLinks[c.id], '_blank');
                    } else {
                      handleSetCustomLink(e, c.id);
                    }
                  }}
                  className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-primary flex-1 flex items-center justify-center gap-1.5 border border-border/50"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{customLinks[c.id] ? 'Acessar App' : 'Add Link'}</span>
                </button>
                
                {customLinks[c.id] && (
                  <button 
                    onClick={(e) => handleSetCustomLink(e, c.id)}
                    className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-primary flex items-center justify-center border border-border/50"
                    title="Editar Link"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Explicit Actions Bottom Bar */}
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50 gap-1.5">
                {c.state?.toLowerCase() === 'running' ? (
                  <>
                    <button onClick={(e) => handleAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-rose-400 flex-1 flex items-center justify-center gap-1" title="Parar container">
                      <Square className="w-3.5 h-3.5" />
                      <span>Parar</span>
                    </button>
                    <button onClick={(e) => handleAction(e, c.id, 'pause')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-amber-400 flex-1 flex items-center justify-center gap-1" title="Pausar container">
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar</span>
                    </button>
                    <button onClick={(e) => handleAction(e, c.id, 'restart')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-emerald-400 flex-1 flex items-center justify-center gap-1" title="Reiniciar container">
                      <RotateCw className={`w-3.5 h-3.5 ${actionLoading === c.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar</span>
                    </button>
                    <button 
                      onClick={(e) => handleUpdateContainer(e, c.id)} 
                      disabled={updatingContainerId === c.id || actionLoading === c.id} 
                      className={`glass-button px-2 py-1.5 text-xs rounded-lg flex-1 flex items-center justify-center gap-1 transition-all ${
                        updatesMap[c.id]?.has_update 
                          ? 'text-violet-300 bg-violet-500/20 border-violet-500/40 hover:bg-violet-500/30' 
                          : 'text-secondary hover:text-primary'
                      }`}
                      title="Atualizar imagem e recriar container com suporte a arquitetura nativa"
                    >
                      <DownloadCloud className={`w-3.5 h-3.5 ${updatingContainerId === c.id ? 'animate-bounce' : ''}`} />
                      <span>{updatingContainerId === c.id ? '...' : 'Atualizar'}</span>
                    </button>
                  </>
                ) : c.state?.toLowerCase() === 'paused' ? (
                  <>
                    <button onClick={(e) => handleAction(e, c.id, 'unpause')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-emerald-400 hover:text-emerald-300 flex-1 flex items-center justify-center gap-1.5">
                      <PlayCircle className={`w-3.5 h-3.5 ${actionLoading === c.id ? 'animate-pulse' : ''}`} />
                      <span>Retomar</span>
                    </button>
                    <button onClick={(e) => handleAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-secondary hover:text-rose-400 flex-1 flex items-center justify-center gap-1.5">
                      <Square className="w-3.5 h-3.5" />
                      <span>Parar</span>
                    </button>
                  </>
                ) : (
                  <button onClick={(e) => handleAction(e, c.id, 'start')} disabled={actionLoading === c.id} className="glass-button px-2 py-1.5 text-xs rounded-lg text-emerald-500 hover:text-emerald-400 w-full flex items-center justify-center gap-1.5">
                    <Play className={`w-3.5 h-3.5 ${actionLoading === c.id ? 'animate-pulse' : ''}`} />
                    <span>Iniciar Container</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'table' && containers.length > 0 && (
        <div className="flex-1 overflow-auto border border-border rounded-lg glass-panel">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-secondary uppercase bg-white/5 border-b border-border">
              <tr>
                <th className="px-4 py-4 font-medium">Nome</th>
                <th className="px-4 py-4 font-medium">Estado</th>
                <th className="px-4 py-4 font-medium">CPU</th>
                <th className="px-4 py-4 font-medium">RAM</th>
                <th className="px-4 py-4 font-medium">Disco</th>
                <th className="px-4 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedContainers.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/containers/${c.id}`)} className="border-b border-border hover:bg-white/5 transition-colors cursor-pointer">
                  <td className="px-4 py-4 font-medium text-primary flex items-center gap-3">
                    <img 
                      src={getIconForImage(c.image, c.name)} 
                      alt="" 
                      onError={(e) => {
                        if (!e.currentTarget.src.endsWith('docker.png')) {
                          e.currentTarget.src = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png';
                        }
                      }}
                      className="w-6 h-6 object-contain drop-shadow-sm" 
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary leading-tight">{c.name}</span>
                        {updatesMap[c.id]?.has_update && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-semibold border border-violet-500/30">
                            Atualização
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-secondary font-mono leading-tight">{c.image}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${c.state?.toLowerCase() === 'running' ? 'bg-emerald-500' : c.state?.toLowerCase() === 'paused' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span className="capitalize text-secondary">{c.state}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-primary font-mono">
                    {c.cpu_percent?.toFixed(1) || '0.0'}%
                  </td>
                  <td className="px-4 py-4 text-primary font-mono">
                    {formatRAM(c.memory_used)}
                  </td>
                  <td className="px-4 py-4 text-primary font-mono">
                    {formatBytes((c.size_rw || 0) + (c.size_root_fs || 0))}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      {/* Tabela: Links Rápidos */}
                      {(() => {
                        const firstPublic = c.ports?.find(p => p.public_port);
                        if (firstPublic) {
                          const ip = window.location.hostname;
                          return (
                            <button 
                              onClick={(e) => { e.stopPropagation(); window.open(`http://${ip}:${firstPublic.public_port}`, '_blank'); }}
                              className="p-1.5 rounded glass-button hover:text-primary transition-colors text-xs flex items-center gap-1" title="IP:Porta"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          );
                        }
                        return null;
                      })()}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (customLinks[c.id]) {
                            window.open(customLinks[c.id], '_blank');
                          } else {
                            handleSetCustomLink(e, c.id);
                          }
                        }}
                        className="p-1.5 rounded glass-button hover:text-primary transition-colors text-xs flex items-center gap-1" title={customLinks[c.id] ? 'Acessar App' : 'Add Link'}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-px h-4 bg-border mx-1"></div>

                      {updatesMap[c.id]?.has_update && (
                        <button 
                          onClick={(e) => handleUpdateContainer(e, c.id)}
                          disabled={updatingContainerId === c.id}
                          className="p-1.5 rounded glass-button text-violet-300 hover:text-white bg-violet-500/20 border border-violet-500/30 transition-colors text-xs flex items-center gap-1" 
                          title="Atualizar container"
                        >
                          <DownloadCloud className={`w-3.5 h-3.5 ${updatingContainerId === c.id ? 'animate-bounce' : ''}`} />
                        </button>
                      )}

                      {c.state?.toLowerCase() === 'running' ? (
                        <>
                          <button onClick={(e) => handleAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-rose-400 transition-colors" title="Parar">
                            <Square className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => handleAction(e, c.id, 'pause')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-amber-400 transition-colors" title="Pausar">
                            <Pause className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => handleAction(e, c.id, 'restart')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-emerald-400 transition-colors" title="Reiniciar">
                            <RotateCw className={`w-4 h-4 ${actionLoading === c.id ? 'animate-spin' : ''}`} />
                          </button>
                        </>
                      ) : c.state?.toLowerCase() === 'paused' ? (
                        <>
                          <button onClick={(e) => handleAction(e, c.id, 'unpause')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-emerald-400 transition-colors" title="Retomar">
                            <PlayCircle className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => handleAction(e, c.id, 'stop')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button hover:text-rose-400 transition-colors" title="Parar">
                            <Square className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={(e) => handleAction(e, c.id, 'start')} disabled={actionLoading === c.id} className="p-1.5 rounded glass-button text-emerald-500 hover:text-emerald-400 transition-colors" title="Iniciar">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {linkModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" 
          onClick={() => setLinkModal({ isOpen: false, containerId: null })}
        >
          <div 
            className="bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-lg mx-auto my-auto max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-primary">
                    Link Customizado do App
                  </h3>
                  <p className="text-xs text-secondary">Configure a URL de acesso rápido para este container</p>
                </div>
              </div>
              <button 
                onClick={() => setLinkModal({ isOpen: false, containerId: null })}
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex bg-background/60 border border-border rounded-xl p-1 mb-4">
              <button 
                onClick={() => setLinkMode('builder')} 
                className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors min-h-[38px] ${
                  linkMode === 'builder' 
                    ? 'bg-orbit-500 text-white shadow-sm font-semibold' 
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Construtor Automático
              </button>
              <button 
                onClick={() => setLinkMode('raw')} 
                className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors min-h-[38px] ${
                  linkMode === 'raw' 
                    ? 'bg-orbit-500 text-white shadow-sm font-semibold' 
                    : 'text-secondary hover:text-primary'
                }`}
              >
                URL Completa
              </button>
            </div>

            {linkMode === 'builder' ? (
              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Subdomínio (App)</label>
                    <input 
                      type="text" 
                      autoFocus
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
                      placeholder="meu-app"
                      value={linkSubdomain}
                      onChange={(e) => setLinkSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Domínio Base</label>
                    <input 
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
                      placeholder="exemplo.com"
                      value={linkDomain}
                      onChange={(e) => setLinkDomain(e.target.value.toLowerCase())}
                    />
                  </div>
                </div>
                <div className="bg-background/80 rounded-xl p-3.5 border border-border">
                  <span className="text-xs text-secondary block mb-1 font-medium">Hostname final de acesso:</span>
                  <span className="text-sm text-emerald-400 font-mono break-all font-semibold">
                    {linkSubdomain && linkDomain ? `https://${linkSubdomain}.${linkDomain}` : 'Preencha os campos acima...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-2">
                <label className="block text-xs font-medium text-secondary">
                  Insira a URL customizada completa (deixe em branco para remover):
                </label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
                  placeholder="https://exemplo.com:8080/caminho"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveLink();
                    if (e.key === 'Escape') setLinkModal({ isOpen: false, containerId: null });
                  }}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-2">
              <button 
                onClick={() => setLinkModal({ isOpen: false, containerId: null })}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-secondary hover:text-primary hover:bg-accent/50 transition-colors text-sm font-medium text-center"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveLink}
                className="w-full sm:w-auto px-5 py-2.5 bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white rounded-xl transition-all text-sm font-semibold shadow-md shadow-orbit-500/20 text-center"
              >
                Salvar Link
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
