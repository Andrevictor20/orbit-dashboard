import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  PieChart, 
  Folder, 
  FileText, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Archive, 
  ArrowRight,
  HardDrive,
  Loader2,
  RefreshCw,
  FolderTree,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
  Terminal,
  ExternalLink,
  ChevronRight,
  ArrowUpLeft,
  Search,
  Box,
  Layers,
  FileCode,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBytes, formatStorage, getFriendlyDiskName, isPhysicalStorage } from '../utils/format';

interface DiskItemStat {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  percentage: number;
}

interface DiskAnalysisResponse {
  path: string;
  total_size: number;
  item_count: number;
  items: DiskItemStat[];
}

interface MountItem {
  name: string;
  mount_point: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

// Safety categories for filesystem paths
type SafetyLevel = 'critical' | 'warning' | 'safe';

interface SafetyInfo {
  level: SafetyLevel;
  tag: string;
  description: string;
}

function getPathSafetyInfo(path: string): SafetyInfo {
  const p = path.toLowerCase();

  // Critical system paths - NEVER TOUCH
  if (
    p === '/boot' || p.startsWith('/boot/') ||
    p === '/etc' || p.startsWith('/etc/') ||
    p === '/lib' || p.startsWith('/lib/') ||
    p === '/lib64' || p.startsWith('/lib64/') ||
    p === '/usr/bin' || p === '/usr/sbin' || p === '/bin' || p === '/sbin' ||
    p === '/proc' || p.startsWith('/proc/') ||
    p === '/sys' || p.startsWith('/sys/') ||
    p === '/dev' || p.startsWith('/dev/') ||
    p.includes('/docker/overlay2') ||
    p.includes('/var/lib/docker/overlay2') ||
    p === '/root'
  ) {
    return {
      level: 'critical',
      tag: 'Crítico do Sistema',
      description: 'NÃO APAGAR manualmente. Essencial para o funcionamento do kernel e do sistema operacional.',
    };
  }

  // Warning paths - Review before touching
  if (
    p.startsWith('/var/lib') ||
    p.includes('/.config') ||
    p.startsWith('/etc/docker') ||
    p.includes('/docker/volumes')
  ) {
    return {
      level: 'warning',
      tag: 'Cuidado (Revisar)',
      description: 'Pode conter bancos de dados, volumes de containers ou configurações ativas de aplicações.',
    };
  }

  // Safe paths for cleaning
  if (
    p.startsWith('/tmp') ||
    p.startsWith('/var/tmp') ||
    p.includes('/.cache') ||
    p.includes('/cache/apt') ||
    p.includes('/.local/share/trash') ||
    p.includes('__trash__') ||
    p.endsWith('.gz') ||
    p.endsWith('.log.1') ||
    p.endsWith('.old') ||
    p.endsWith('.bak')
  ) {
    return {
      level: 'safe',
      tag: 'Seguro para Limpeza',
      description: 'Cache temporário, log rotacionado ou lixeira que pode ser liberado sem afetar o sistema.',
    };
  }

  return {
    level: 'warning',
    tag: 'Dados de Usuário',
    description: 'Arquivos e pastas de usuário ou de aplicações.',
  };
}

export function DiskAnalyzer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPath = searchParams.get('path') || '/';

  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [data, setData] = useState<DiskAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [storages, setStorages] = useState<MountItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ncdu' | 'insights' | 'safety'>('ncdu');

  // Search and Sort states
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'size' | 'percentage' | 'name'>('size');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Prune / Cleanup loading states
  const [isPruningDocker, setIsPruningDocker] = useState<boolean>(false);
  const [isCleaningTrash, setIsCleaningTrash] = useState<boolean>(false);

  // Fetch mount points
  const loadMounts = () => {
    fetch('/api/files/storages')
      .then((res) => res.json())
      .then((json) => {
        if (json.mounts && Array.isArray(json.mounts)) {
          const filtered = json.mounts.filter((m: MountItem) =>
            isPhysicalStorage(m.name, m.mount_point, m.fs_type, m.total_bytes)
          );
          setStorages(filtered);
        }
      })
      .catch(() => {});
  };

  // Fetch analysis for target path
  const fetchAnalysis = async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/analyze?path=${encodeURIComponent(targetPath)}`);
      if (!res.ok) throw new Error(`Falha ao analisar o diretório ${targetPath}`);
      const json: DiskAnalysisResponse = await res.json();
      setData(json);
      setCurrentPath(json.path || targetPath);
      setSearchParams({ path: json.path || targetPath }, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do analisador');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMounts();
  }, []);

  useEffect(() => {
    fetchAnalysis(initialPath);
  }, [initialPath]);

  // Navigate to another path
  const handleNavigate = (path: string) => {
    setSearchFilter('');
    fetchAnalysis(path);
  };

  // Navigate one level up
  const handleGoUp = () => {
    if (currentPath === '/' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    handleNavigate(parentPath);
  };

  // Format breadcrumb segments
  const breadcrumbSegments = useMemo(() => {
    if (currentPath === '/' || !currentPath) {
      return [{ label: 'Raiz (/)', path: '/' }];
    }
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: 'Raiz (/)', path: '/' }];
    let accum = '';
    parts.forEach((p) => {
      accum += `/${p}`;
      crumbs.push({ label: p, path: accum });
    });
    return crumbs;
  }, [currentPath]);

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items
      .filter((item) => {
        if (!searchFilter) return true;
        return item.name.toLowerCase().includes(searchFilter.toLowerCase());
      })
      .sort((a, b) => {
        let ord = 0;
        if (sortBy === 'name') {
          ord = a.name.localeCompare(b.name);
        } else if (sortBy === 'percentage') {
          ord = a.percentage - b.percentage;
        } else {
          ord = a.size - b.size;
        }
        return sortAsc ? ord : -ord;
      });
  }, [data, searchFilter, sortBy, sortAsc]);

  // File Icon helper
  const getItemIcon = (name: string, is_dir: boolean) => {
    if (is_dir) return <Folder className="text-amber-400 w-4 h-4 shrink-0" />;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) return <Film className="text-rose-400 w-4 h-4 shrink-0" />;
    if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext)) return <Music className="text-violet-400 w-4 h-4 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return <ImageIcon className="text-pink-400 w-4 h-4 shrink-0" />;
    if (['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext)) return <Archive className="text-orange-400 w-4 h-4 shrink-0" />;
    if (['js', 'ts', 'jsx', 'tsx', 'rs', 'py', 'json', 'yaml', 'yml', 'sh', 'html', 'css', 'toml', 'env'].includes(ext)) {
      return <FileCode className="text-emerald-400 w-4 h-4 shrink-0" />;
    }
    return <FileText className="text-sky-400 w-4 h-4 shrink-0" />;
  };

  // Safe delete handler with prompt
  const handleDeleteItem = async (item: DiskItemStat) => {
    const safety = getPathSafetyInfo(item.path);
    if (safety.level === 'critical') {
      toast.error(`Bloqueado: "${item.name}" é um arquivo crítico do sistema e não deve ser removido.`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja mover "${item.name}" para a lixeira?`)) return;

    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [item.path] }),
      });
      if (!res.ok) throw new Error('Erro ao excluir item');
      toast.success(`"${item.name}" movido para a lixeira!`);
      fetchAnalysis(currentPath);
    } catch {
      toast.error('Falha ao excluir item.');
    }
  };

  // 1-Click Docker Prune
  const handleDockerPrune = async () => {
    if (!window.confirm('Deseja executar a limpeza do Docker (remover imagens órfãs, build cache e containers parados)?')) return;
    setIsPruningDocker(true);
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/images/prune', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Erro ao limpar Docker');
      toast.success('Limpeza de imagens Docker concluída com sucesso!');
      loadMounts();
      fetchAnalysis(currentPath);
    } catch {
      toast.error('Erro ao executar limpeza do Docker.');
    } finally {
      setIsPruningDocker(false);
    }
  };

  // 1-Click Empty Trash
  const handleEmptyTrash = async () => {
    if (!window.confirm('Tem certeza que deseja esvaziar permanentemente a lixeira do sistema?')) return;
    setIsCleaningTrash(true);
    try {
      const res = await fetch('/api/files/trash', { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao esvaziar');
      toast.success('Lixeira esvaziada com sucesso!');
      loadMounts();
      fetchAnalysis(currentPath);
    } catch {
      toast.error('Erro ao esvaziar lixeira.');
    } finally {
      setIsCleaningTrash(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 border border-border/80 rounded-2xl p-4 sm:p-6 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 shadow-inner">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              Analisador de Espaço em Disco
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-orbit-500/10 text-orbit-400 border border-orbit-500/20">
                ncdu-mode
              </span>
            </h1>
            <p className="text-xs text-secondary mt-0.5">
              Análise hierárquica precisa, insights inteligentes e diretrizes de segurança do sistema de arquivos
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-neutral-900/80 border border-border/80 p-1 rounded-xl shrink-0 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('ncdu')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ncdu'
                ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25'
                : 'text-secondary hover:text-primary hover:bg-neutral-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Árvore de Pastas (ncdu)</span>
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'insights'
                ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25'
                : 'text-secondary hover:text-primary hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Insights & Dicas</span>
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'safety'
                ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25'
                : 'text-secondary hover:text-primary hover:bg-neutral-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>O que NÃO Mexer</span>
          </button>
        </div>
      </div>

      {/* Disks Mounts Selector Carousel/Deck */}
      {storages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {storages.map((st, idx) => {
            const usedFormatted = formatStorage(st.used_bytes, 1);
            const totalFormatted = formatStorage(st.total_bytes, 1);
            const availFormatted = formatStorage(st.available_bytes || (st.total_bytes - st.used_bytes), 1);
            const pct = st.total_bytes > 0 ? Math.round((st.used_bytes / st.total_bytes) * 100) : 0;
            const isSelected = currentPath === st.mount_point || currentPath.startsWith(`${st.mount_point}/`);
            const friendlyName = getFriendlyDiskName(st.name, st.mount_point);

            return (
              <button
                key={idx}
                onClick={() => handleNavigate(st.mount_point)}
                className={`text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-orbit-500/10 border-orbit-500/50 shadow-md ring-2 ring-orbit-500/20'
                    : 'bg-card/40 border-border/70 hover:bg-neutral-900/60 hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <HardDrive className={`w-4 h-4 shrink-0 ${isSelected ? 'text-orbit-400' : 'text-secondary'}`} />
                    <span className="text-xs font-bold text-primary truncate">{friendlyName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-secondary px-1.5 py-0.5 rounded bg-neutral-800 border border-border/50">
                    {st.fs_type}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct > 85 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-orbit-500'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-secondary">
                  <span>{availFormatted} livre</span>
                  <span className="font-semibold text-primary">{pct}% ({usedFormatted}/{totalFormatted})</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 1: NCDU DIRECTORY TREE BREAKDOWN */}
      {activeTab === 'ncdu' && (
        <div className="flex-1 flex flex-col bg-card/60 border border-border/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl min-h-[500px]">
          {/* Breadcrumb Navigation & Controls Toolbar */}
          <div className="p-3 sm:p-4 border-b border-border/70 bg-card/40 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Breadcrumbs & Up Button */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={handleGoUp}
                disabled={currentPath === '/' || !currentPath}
                className="p-1.5 rounded-xl border border-border/80 bg-neutral-900/80 text-secondary hover:text-primary hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                title="Subir um diretório (..)"
              >
                <ArrowUpLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono scrollbar-none py-1 truncate">
                {breadcrumbSegments.map((crumb, idx, arr) => (
                  <div key={crumb.path} className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleNavigate(crumb.path)}
                      className={`hover:text-orbit-400 transition-colors px-2 py-0.5 rounded-lg ${
                        idx === arr.length - 1
                          ? 'bg-orbit-500/15 text-orbit-400 font-bold border border-orbit-500/30'
                          : 'text-secondary hover:bg-neutral-800'
                      }`}
                    >
                      {crumb.label}
                    </button>
                    {idx < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Search, Sort, Refresh & File Manager Link */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search Filter */}
              <div className="relative w-32 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar nesta pasta..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 rounded-xl bg-neutral-900 border border-border text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500"
                />
              </div>

              {/* Sort Mode */}
              <div className="flex items-center bg-neutral-900 border border-border rounded-xl p-0.5 text-xs">
                <button
                  onClick={() => {
                    if (sortBy === 'size') setSortAsc(!sortAsc);
                    else { setSortBy('size'); setSortAsc(false); }
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    sortBy === 'size' ? 'bg-orbit-500 text-white' : 'text-secondary hover:text-primary'
                  }`}
                  title="Ordenar por tamanho"
                >
                  Tamanho {sortBy === 'size' && (sortAsc ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'name') setSortAsc(!sortAsc);
                    else { setSortBy('name'); setSortAsc(true); }
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    sortBy === 'name' ? 'bg-orbit-500 text-white' : 'text-secondary hover:text-primary'
                  }`}
                  title="Ordenar por nome"
                >
                  Nome {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={() => fetchAnalysis(currentPath)}
                className="p-1.5 rounded-xl border border-border bg-neutral-900 text-secondary hover:text-primary hover:bg-neutral-800 transition-colors"
                title="Atualizar análise"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orbit-400' : ''}`} />
              </button>

              {/* Open in File Manager */}
              <button
                onClick={() => navigate(`/files?path=${encodeURIComponent(currentPath)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-border text-secondary hover:text-primary hover:bg-neutral-800 text-xs font-semibold transition-colors"
                title="Explorar no Gerenciador de Arquivos"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Gerenciador</span>
              </button>
            </div>
          </div>

          {/* Current Path Summary Bar */}
          {data && (
            <div className="px-4 py-2 bg-neutral-900/50 border-b border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary font-mono">
              <div className="flex items-center gap-3">
                <span>Tamanho Total: <strong className="text-primary">{formatBytes(data.total_size)}</strong></span>
                <span>Itens: <strong className="text-primary">{data.item_count}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-sans">Dica: clique em uma pasta para navegar hierarquicamente</span>
              </div>
            </div>
          )}

          {/* Content Body / Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-secondary">
                <Loader2 className="w-8 h-8 animate-spin text-orbit-400" />
                <p className="text-xs font-medium font-mono">Calculando uso de disco recursivo em {currentPath}...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-rose-400">
                <AlertTriangle className="w-10 h-10" />
                <p className="text-sm font-semibold">{error}</p>
                <button
                  onClick={() => handleNavigate('/')}
                  className="px-4 py-1.5 rounded-xl bg-orbit-500 text-white text-xs font-semibold hover:bg-orbit-600"
                >
                  Voltar para a Raiz (/)
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-secondary">
                <Folder className="w-10 h-10 stroke-[1.5] text-zinc-600" />
                <p className="text-sm font-semibold text-primary">Nenhum item encontrado neste diretório</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-900/80 text-secondary border-b border-border/80 font-mono font-semibold sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Nome & Caminho</th>
                    <th className="py-2.5 px-4 font-bold text-right w-28">Tamanho</th>
                    <th className="py-2.5 px-4 font-bold w-48 sm:w-64">Uso Visual (ncdu)</th>
                    <th className="py-2.5 px-4 font-bold text-center w-32 hidden md:table-cell">Segurança</th>
                    <th className="py-2.5 px-4 font-bold text-right w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredItems.map((item) => {
                    const safety = getPathSafetyInfo(item.path);
                    const pct = Math.round(item.percentage);

                    return (
                      <tr
                        key={item.path}
                        onClick={() => {
                          if (item.is_dir) handleNavigate(item.path);
                        }}
                        className={`group hover:bg-neutral-800/50 transition-colors ${
                          item.is_dir ? 'cursor-pointer' : ''
                        }`}
                      >
                        {/* Name & Type */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getItemIcon(item.name, item.is_dir)}
                            <span 
                              className={`font-semibold truncate max-w-xs sm:max-w-md ${
                                item.is_dir ? 'text-primary group-hover:text-orbit-400 transition-colors' : 'text-zinc-300'
                              }`}
                              title={item.name}
                            >
                              {item.name}
                              {item.is_dir && <span className="text-secondary/60 ml-0.5">/</span>}
                            </span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-primary whitespace-nowrap">
                          {formatBytes(item.size)}
                        </td>

                        {/* ncdu Progress Bar */}
                        <td className="py-2.5 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-border/40">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct > 70
                                    ? 'bg-rose-500'
                                    : pct > 40
                                    ? 'bg-amber-500'
                                    : 'bg-orbit-500'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-secondary w-12 text-right">
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Safety Badge */}
                        <td className="py-2.5 px-4 text-center hidden md:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              safety.level === 'critical'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : safety.level === 'safe'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-neutral-800 text-zinc-400 border-border'
                            }`}
                            title={safety.description}
                          >
                            {safety.level === 'critical' ? (
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                            ) : safety.level === 'safe' ? (
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Info className="w-3 h-3 text-zinc-400" />
                            )}
                            {safety.tag}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.is_dir && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/terminal?cwd=${encodeURIComponent(item.path)}`);
                                }}
                                className="p-1 rounded-lg text-secondary hover:text-emerald-400 hover:bg-neutral-800"
                                title="Abrir no Terminal"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/files?path=${encodeURIComponent(item.path)}`);
                              }}
                              className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-neutral-800"
                              title="Ver no Gerenciador de Arquivos"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {safety.level !== 'critical' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item);
                                }}
                                className="p-1 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10"
                                title="Mover para a lixeira"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SMART INSIGHTS & SPACE-SAVING RECOMMENDATIONS */}
      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1: Docker EcoSystem Cleanup */}
          <div className="bg-card/60 border border-border/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">Imagens e Cache do Docker</h3>
                    <p className="text-xs text-secondary">Imagens não referenciadas e caches de build</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Seguro
                </span>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Containers atualizados frequentemente deixam imagens antigas e camadas órfãs em disco. A limpeza automática remove apenas imagens sem uso (`dangling`), mantendo todos os seus containers intactos.
              </p>

              <div className="p-3 rounded-xl bg-neutral-900/70 border border-border/60 text-xs font-mono space-y-1">
                <div className="text-zinc-400">💡 Comando CLI equivalente:</div>
                <div className="text-orbit-400 font-bold">docker image prune -a</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
              <span className="text-xs text-secondary font-mono">Liberação média: 2 a 15 GB</span>
              <button
                onClick={handleDockerPrune}
                disabled={isPruningDocker}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isPruningDocker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isPruningDocker ? 'Limpando Docker...' : 'Limpar Imagens Órfãs'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: System Logs & Journal Vacuum */}
          <div className="bg-card/60 border border-border/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">Logs Rotacionados & Journals</h3>
                    <p className="text-xs text-secondary">Arquivos compactados em /var/log</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Seguro
                </span>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Logs de serviços (`.log.1`, `.gz`, `journal/`) podem crescer indefinidamente ao longo dos meses. Manter apenas os últimos 3 dias de log libera espaço substancial sem perder auditoria recente.
              </p>

              <div className="p-3 rounded-xl bg-neutral-900/70 border border-border/60 text-xs font-mono space-y-1">
                <div className="text-zinc-400">💡 Comando CLI para aspirar journals:</div>
                <div className="text-orbit-400 font-bold">journalctl --vacuum-time=3d</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
              <span className="text-xs text-secondary font-mono">Localização: /var/log</span>
              <button
                onClick={() => handleNavigate('/var/log')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 border border-border hover:bg-neutral-800 text-primary text-xs font-semibold transition-all"
              >
                <span>Inspecionar /var/log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Package Manager & Runtime Caches */}
          <div className="bg-card/60 border border-border/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">Caches de Pacotes (APT / npm / pip)</h3>
                    <p className="text-xs text-secondary">Arquivos .deb e módulos temporários baixados</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Seguro
                </span>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Quando pacotes são instalados via `apt install`, os arquivos `.deb` ficam retidos em `/var/cache/apt/archives`. Limpar o cache não remove os programas instalados.
              </p>

              <div className="p-3 rounded-xl bg-neutral-900/70 border border-border/60 text-xs font-mono space-y-1">
                <div className="text-zinc-400">💡 Comando CLI de limpeza de pacotes:</div>
                <div className="text-orbit-400 font-bold">apt-get clean && apt-get autoclean</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
              <span className="text-xs text-secondary font-mono">Localização: /var/cache</span>
              <button
                onClick={() => handleNavigate('/var/cache')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 border border-border hover:bg-neutral-800 text-primary text-xs font-semibold transition-all"
              >
                <span>Inspecionar /var/cache</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 4: System Trash & Temporary Directory */}
          <div className="bg-card/60 border border-border/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">Lixeira do Sistema & /tmp</h3>
                    <p className="text-xs text-secondary">Arquivos descartados mantidos em quarentena</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Seguro
                </span>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Itens movidos para a Lixeira continuam consumindo espaço no disco até que sejam esvaziados permanentemente.
              </p>

              <div className="p-3 rounded-xl bg-neutral-900/70 border border-border/60 text-xs font-mono space-y-1">
                <div className="text-zinc-400">💡 Localização comum da Lixeira:</div>
                <div className="text-orbit-400 font-bold">~/.local/share/Trash</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
              <button
                onClick={() => navigate('/files?path=__trash__')}
                className="text-xs text-secondary hover:text-primary hover:underline"
              >
                Ver Lixeira
              </button>
              <button
                onClick={handleEmptyTrash}
                disabled={isCleaningTrash}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 active:scale-95 text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isCleaningTrash ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isCleaningTrash ? 'Esvaziando...' : 'Esvaziar Lixeira'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FILESYSTEM SAFETY GUARDRAILS (O QUE NÃO MEXER) */}
      {activeTab === 'safety' && (
        <div className="space-y-4">
          {/* Critical Warning Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-200">
                Atenção Máxima: Diretórios Fundamentais do Sistema Linux
              </h3>
              <p className="text-xs leading-relaxed text-rose-300/90">
                A exclusão acidental de qualquer um dos diretórios listados em vermelho causará parada imediata do servidor (Kernel Panic), perda permanente de serviços ou corrupção irreversível do banco de dados do Docker.
              </p>
            </div>
          </div>

          {/* Detailed Directory Safety Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: /boot */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /boot
                </span>
                <span className="text-xs font-bold text-primary">Kernel do Linux & Grub</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Contém as imagens do kernel (`vmlinuz`), arquivos `initramfs` e o carregador de inicialização. Se apagado, o computador ou VPS não inicializará após o reboot.
              </p>
            </div>

            {/* Rule 2: /var/lib/docker/overlay2 */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /var/lib/docker/overlay2
                </span>
                <span className="text-xs font-bold text-primary">Camadas Internas do Docker</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                É onde o Docker armazena os sistemas de arquivos dos containers em execução. <strong>NUNCA</strong> execute `rm -rf` nesta pasta diretamente; utilize os comandos da aba "Insights & Dicas" ou o menu do Orbit para podar imagens de forma segura.
              </p>
            </div>

            {/* Rule 3: /etc */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /etc
                </span>
                <span className="text-xs font-bold text-primary">Configurações Globais</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Armazena arquivos de configuração vitais (`/etc/fstab`, `/etc/passwd`, `/etc/network`, `/etc/docker`). Ocupa muito pouco espaço (poucos megabytes) e nunca deve ser limpo para ganhar espaço.
              </p>
            </div>

            {/* Rule 4: /lib, /lib64, /usr/lib */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /lib e /usr/lib
                </span>
                <span className="text-xs font-bold text-primary">Bibliotecas Dinâmicas (.so)</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Bibliotecas essenciais exigidas por quase todos os executáveis do sistema operacional. Apagar qualquer arquivo aqui quebra utilitários básicos como `ls`, `cat`, `docker` e o próprio `orbit`.
              </p>
            </div>

            {/* Rule 5: /bin, /sbin, /usr/bin */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /bin e /sbin
                </span>
                <span className="text-xs font-bold text-primary">Binários do Sistema</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Contém todos os executáveis de linha de comando (`bash`, `sh`, `systemctl`, `iptables`, `ip`).
              </p>
            </div>

            {/* Rule 6: /proc, /sys, /dev */}
            <div className="bg-card/60 border border-rose-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  /proc e /sys
                </span>
                <span className="text-xs font-bold text-primary">Sistemas Virtuais em RAM</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Estes diretórios não consom espaço real em disco (são interfaces virtuais em memória do kernel). Não tente analisá-los ou apagá-los.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiskAnalyzer;
