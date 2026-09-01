import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  PieChart, 
  Folder, 
  FileText, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Archive, 
  HardDrive, 
  RefreshCw, 
  FolderTree, 
  Sparkles, 
  Trash2, 
  Terminal, 
  ExternalLink, 
  ArrowUpLeft, 
  Search, 
  FileCode, 
  ShieldAlert,
  ArrowRight,
  Flame,
  CornerDownRight,
  FolderSearch,
  Clock,
  Compass
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
  const currentUrlPath = searchParams.get('path') || '/';

  const [currentPath, setCurrentPath] = useState<string>(currentUrlPath);
  const [customInputPath, setCustomInputPath] = useState<string>(currentUrlPath);
  const [data, setData] = useState<DiskAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const [storages, setStorages] = useState<MountItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ncdu' | 'insights' | 'safety'>('ncdu');

  // Search and Sort states
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'size' | 'percentage' | 'name'>('size');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Prune / Cleanup loading states
  const [isPruningDocker, setIsPruningDocker] = useState<boolean>(false);
  const [isCleaningTrash, setIsCleaningTrash] = useState<boolean>(false);

  // Elapsed timer and fetch abort controller for scanning progress
  const timerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

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

  // Fetch analysis for target path with race-condition protection
  const fetchAnalysis = async (targetPath: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/analyze?path=${encodeURIComponent(targetPath)}`, {
        signal: abortController.signal,
      });
      if (!res.ok) throw new Error(`Falha ao analisar o diretório ${targetPath}`);
      const json: DiskAnalysisResponse = await res.json();
      setData(json);
      const resPath = json.path || targetPath;
      setCurrentPath(resPath);
      setCustomInputPath(resPath);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Erro ao carregar dados do analisador');
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadMounts();
  }, []);

  // React strictly to URL query parameter changes
  useEffect(() => {
    fetchAnalysis(currentUrlPath);
  }, [currentUrlPath]);

  // Navigate to another path cleanly updating searchParams
  const handleNavigate = (path: string) => {
    setSearchFilter('');
    const clean = path || '/';
    if (clean === currentUrlPath) {
      fetchAnalysis(clean);
    } else {
      setSearchParams({ path: clean });
    }
  };

  // Handle custom path form submit
  const handleCustomPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputPath.trim()) return;
    handleNavigate(customInputPath.trim());
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

  // Top 5 Largest Consumers in the current directory
  const topConsumers = useMemo(() => {
    if (!data?.items || data.items.length === 0) return [];
    return [...data.items]
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
  }, [data]);

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

  // Quick Preset Folders
  const presetFolders = [
    { label: 'Sistema (/)', path: '/' },
    { label: 'Início (/home)', path: '/home' },
    { label: 'Docker (/var/lib/docker)', path: '/var/lib/docker' },
    { label: 'Logs (/var/log)', path: '/var/log' },
    { label: 'Cache APT (/var/cache/apt)', path: '/var/cache/apt' },
    { label: 'Temporários (/tmp)', path: '/tmp' },
    { label: 'HD Externo (/mnt)', path: '/mnt' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 shadow-inner">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
              Analisador de Espaço em Disco
            </h1>
            <p className="text-xs text-secondary mt-0.5">
              Análise hierárquica precisa, maiores consumidores de espaço e diretrizes de segurança
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-border/80 p-1 rounded-xl shrink-0 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('ncdu')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ncdu'
                ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25'
                : 'text-secondary hover:text-primary hover:bg-neutral-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Árvore de Pastas</span>
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
                    : 'bg-card border-border/70 hover:bg-neutral-900/60 hover:border-border'
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

      {/* DIRECT PATH INPUT & QUICK PRESET CHIPS */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-4 space-y-3">
        <form onSubmit={handleCustomPathSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <FolderSearch className="w-4 h-4 text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customInputPath}
              onChange={(e) => setCustomInputPath(e.target.value)}
              placeholder="Digite qualquer caminho de pasta (ex: /var/lib/docker, /home, /var/log, /mnt)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900 border border-border text-xs text-primary font-mono placeholder-zinc-500 focus:outline-none focus:border-orbit-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-orbit-500/20 transition-all disabled:opacity-50 shrink-0"
          >
            <span>Analisar Pasta</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Preset Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-secondary font-medium mr-1 flex items-center gap-1">
            <Compass className="w-3 h-3 text-orbit-400" />
            Atalhos Rápidos:
          </span>
          {presetFolders.map((p) => (
            <button
              key={p.path}
              onClick={() => handleNavigate(p.path)}
              className={`px-2.5 py-1 rounded-lg border transition-all font-mono ${
                currentPath === p.path
                  ? 'bg-orbit-500/20 text-orbit-300 border-orbit-500/40 font-semibold'
                  : 'bg-neutral-900/60 text-secondary border-border/60 hover:text-primary hover:bg-neutral-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DIRECTORY TREE & TOP CONSUMERS */}
      {activeTab === 'ncdu' && (
        <div className="space-y-4">
          {/* TOP 5 SPACE CONSUMERS DECK */}
          {!loading && topConsumers.length > 0 && (
            <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-primary">
                    Top Maiores Consumidores de Espaço em <span className="font-mono text-orbit-400">{currentPath}</span>
                  </h3>
                </div>
                <span className="text-xs text-secondary font-mono">
                  {formatBytes(data?.total_size || 0)} analisados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {topConsumers.map((item, idx) => {
                  const medal = idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
                  return (
                    <div
                      key={item.path}
                      onClick={() => item.is_dir && handleNavigate(item.path)}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        item.is_dir
                          ? 'bg-neutral-900/80 border-border/80 hover:border-orbit-500/50 hover:bg-neutral-800/90 cursor-pointer group shadow-sm hover:shadow-md'
                          : 'bg-neutral-900/50 border-border/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-orbit-500/10 text-orbit-300 border border-orbit-500/20">
                          {medal}
                        </span>
                        <span className="text-xs font-mono font-bold text-rose-400">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 min-w-0">
                        {getItemIcon(item.name, item.is_dir)}
                        <span className="text-xs font-bold text-primary truncate group-hover:text-orbit-400 transition-colors" title={item.name}>
                          {item.name}
                        </span>
                      </div>

                      <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-secondary">
                        <span className="font-semibold text-primary">{formatBytes(item.size)}</span>
                        {item.is_dir && (
                          <span className="text-orbit-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Explorar <CornerDownRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NCDU DIRECTORY TREE BREAKDOWN */}
          <div className="flex-1 flex flex-col bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl min-h-[450px]">
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
                        className={`hover:text-orbit-400 transition-colors px-1 py-0.5 rounded ${
                          idx === arr.length - 1 ? 'font-bold text-primary bg-neutral-800' : 'text-secondary'
                        }`}
                      >
                        {crumb.label}
                      </button>
                      {idx < arr.length - 1 && <span className="text-zinc-600">&gt;</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Search Filter & Sort Tools */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Instant Filter input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrar nesta pasta..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-border text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 w-40 sm:w-52"
                  />
                </div>

                {/* Sort Toggle buttons */}
                <div className="flex items-center bg-neutral-900/80 border border-border/80 rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => {
                      if (sortBy === 'size') setSortAsc(!sortAsc);
                      else {
                        setSortBy('size');
                        setSortAsc(false);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-mono ${
                      sortBy === 'size' ? 'bg-orbit-500 text-white font-semibold' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Tamanho {sortBy === 'size' ? (sortAsc ? '↑' : '↓') : ''}
                  </button>
                  <button
                    onClick={() => {
                      if (sortBy === 'name') setSortAsc(!sortAsc);
                      else {
                        setSortBy('name');
                        setSortAsc(true);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-mono ${
                      sortBy === 'name' ? 'bg-orbit-500 text-white font-semibold' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Nome {sortBy === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                  </button>
                </div>

                {/* Refresh button */}
                <button
                  onClick={() => fetchAnalysis(currentPath)}
                  className="p-2 rounded-xl border border-border/80 bg-neutral-900/80 text-secondary hover:text-primary hover:bg-neutral-800 transition-colors"
                  title="Recarregar"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Open in File Manager shortcut */}
                <button
                  onClick={() => navigate(`/files?path=${encodeURIComponent(currentPath)}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-semibold transition-all"
                  title="Abrir pasta no Gerenciador de Arquivos"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Gerenciador</span>
                </button>
              </div>
            </div>

            {/* Tree Summary Bar */}
            <div className="px-4 py-2 bg-neutral-950/60 border-b border-border/60 flex items-center justify-between text-xs font-mono text-secondary">
              <div>
                <span>Tamanho Total: <strong className="text-primary">{formatBytes(data?.total_size || 0)}</strong></span>
                <span className="mx-2 text-zinc-700">•</span>
                <span>Itens: <strong className="text-primary">{data?.item_count || 0}</strong></span>
              </div>
              <div className="hidden sm:block text-[11px] text-zinc-500">
                Dica: clique em uma pasta para navegar hierarquicamente
              </div>
            </div>

            {/* Content List Area */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-orbit-500/20 border-t-orbit-500 animate-spin" />
                    <Compass className="w-6 h-6 text-orbit-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-primary">
                      Calculando uso recursivo em <span className="font-mono text-orbit-400">{currentPath}</span>
                    </p>
                    <p className="text-xs text-secondary flex items-center justify-center gap-1.5">
                      <Clock className="w-3 h-3 text-orbit-400" />
                      Tempo decorrido: <span className="font-mono font-bold text-primary">{elapsedSeconds}s</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 max-w-sm pt-1">
                      Varrendo subdiretórios com segurança e calculando ocupação real...
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <ShieldAlert className="w-10 h-10 text-rose-500" />
                  <p className="text-sm font-bold text-rose-400">{error}</p>
                  <button
                    onClick={() => handleNavigate('/')}
                    className="px-4 py-2 rounded-xl bg-neutral-900 border border-border text-xs text-primary hover:bg-neutral-800"
                  >
                    Voltar para Raiz (/)
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-secondary space-y-3">
                  <Folder className="w-12 h-12 stroke-[1.2] text-zinc-600" />
                  <p className="text-sm font-medium">Nenhum item encontrado neste diretório</p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleGoUp}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-border text-xs text-primary hover:bg-neutral-800"
                    >
                      Subir de Pasta
                    </button>
                    <button
                      onClick={() => handleNavigate('/')}
                      className="px-3 py-1.5 rounded-xl bg-orbit-500 text-white text-xs font-semibold"
                    >
                      Ir para Raiz (/)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/40 font-mono text-xs">
                  {filteredItems.map((item) => {
                    const safety = getPathSafetyInfo(item.path);
                    const filledBlocks = Math.round(item.percentage / 10);
                    const emptyBlocks = Math.max(0, 10 - filledBlocks);
                    const barGraphic = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

                    return (
                      <div
                        key={item.path}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 hover:bg-accent/40 transition-colors gap-2"
                      >
                        {/* Left: Icon, Name & Safety Badge */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.is_dir ? (
                            <button
                              onClick={() => handleNavigate(item.path)}
                              className="p-1 rounded-lg hover:bg-neutral-800 text-amber-400 transition-colors"
                              title="Explorar pasta"
                            >
                              <Folder className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="p-1">{getItemIcon(item.name, item.is_dir)}</div>
                          )}

                          <span
                            onClick={() => item.is_dir && handleNavigate(item.path)}
                            className={`font-semibold truncate ${
                              item.is_dir ? 'text-primary hover:text-orbit-400 cursor-pointer underline-offset-2 hover:underline' : 'text-zinc-300'
                            }`}
                            title={item.name}
                          >
                            {item.name}
                            {item.is_dir && '/'}
                          </span>

                          {/* Safety Status Pill */}
                          <span
                            className={`text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full border shrink-0 hidden md:inline-block ${
                              safety.level === 'critical'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : safety.level === 'safe'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                            }`}
                            title={safety.description}
                          >
                            {safety.tag}
                          </span>
                        </div>

                        {/* Middle: NCDU Visual Percentage Bar */}
                        <div className="flex items-center gap-3 shrink-0 sm:w-64">
                          <span className="text-zinc-500 font-mono tracking-tighter text-xs hidden sm:inline">
                            [{barGraphic}]
                          </span>
                          <div className="w-20 sm:w-24 text-right">
                            <span className="font-bold text-primary">{formatBytes(item.size)}</span>
                          </div>
                          <div className="w-12 text-right">
                            <span className="text-secondary text-[11px] font-semibold">{item.percentage.toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Right: Quick Action Controls */}
                        <div className="flex items-center gap-1 justify-end shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.is_dir ? (
                            <button
                              onClick={() => handleNavigate(item.path)}
                              className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-orbit-400 text-[11px] font-semibold flex items-center gap-1 transition-colors border border-border"
                              title="Navegar para este diretório"
                            >
                              <span>Abrir</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => navigate(`/terminal?cwd=${encodeURIComponent(item.path)}`)}
                            className="p-1.5 rounded hover:bg-neutral-800 text-secondary hover:text-emerald-400 transition-colors"
                            title="Abrir no Terminal"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>

                          {safety.level !== 'critical' && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded hover:bg-rose-500/10 text-secondary hover:text-rose-400 transition-colors"
                              title="Mover para a lixeira"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SMART INSIGHTS & CLEANUP ADVISOR */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Docker Prune Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-primary">Docker: Limpeza de Imagens & Cache Órfãos</h3>
                    <span className="text-[11px] text-emerald-400 font-mono">Liberação média: 2 a 15 GB</span>
                  </div>
                </div>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  O Docker acumula camadas antigas de build, imagens não utilizadas (<code className="text-sky-300">dangling</code>) e containers parados. Esta ação limpa tudo que não está em uso ativo sem afetar seus containers em execução.
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono">POST /api/docker/images/prune</span>
                <button
                  onClick={handleDockerPrune}
                  disabled={isPruningDocker}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isPruningDocker ? 'animate-spin' : ''}`} />
                  <span>{isPruningDocker ? 'Limpando...' : 'Executar Prune'}</span>
                </button>
              </div>
            </div>

            {/* System Logs & Journals Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-primary">Logs Rotacionados & Systemd Journals</h3>
                    <span className="text-[11px] text-amber-400 font-mono">Liberação média: 500 MB a 5 GB</span>
                  </div>
                </div>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  Arquivos em <code className="text-amber-300">/var/log</code> e journals do Linux podem crescer indefinidamente. Arquivos compactados (<code className="text-zinc-400">.gz</code>, <code className="text-zinc-400">.log.1</code>) são seguros para exclusão.
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono">journalctl --vacuum-time=3d</span>
                <button
                  onClick={() => handleNavigate('/var/log')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 border border-border hover:bg-neutral-800 text-primary text-xs font-semibold transition-all"
                >
                  <span>Inspecionar /var/log</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Package Manager Cache Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-primary">Cache de Pacotes (APT / npm / pip)</h3>
                    <span className="text-[11px] text-violet-400 font-mono">Liberação média: 1 a 4 GB</span>
                  </div>
                </div>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  O gerenciador de pacotes retém arquivos <code className="text-violet-300">.deb</code> baixados em <code className="text-zinc-400">/var/cache/apt/archives</code>.
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono">apt clean / apt autoclean</span>
                <button
                  onClick={() => handleNavigate('/var/cache')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 border border-border hover:bg-neutral-800 text-primary text-xs font-semibold transition-all"
                >
                  <span>Inspecionar /var/cache</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Trash & Temporary Files Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-primary">Lixeira do Sistema & Temporários</h3>
                    <span className="text-[11px] text-rose-400 font-mono">Esvaziamento Permanente</span>
                  </div>
                </div>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  Itens apagados pelo Gerenciador de Arquivos ficam na lixeira segura. Esvazie para recuperar o espaço físico permanentemente.
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono">DELETE /api/files/trash</span>
                <button
                  onClick={handleEmptyTrash}
                  disabled={isCleaningTrash}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${isCleaningTrash ? 'animate-spin' : ''}`} />
                  <span>{isCleaningTrash ? 'Esvaziando...' : 'Esvaziar Lixeira'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FILESYSTEM SAFETY GUIDE */}
      {activeTab === 'safety' && (
        <div className="space-y-4">
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-300">Diretrizes de Proteção do Sistema de Arquivos Linux</h3>
              <p className="text-xs text-rose-200/80 leading-relaxed">
                O Orbit bloqueia a exclusão de diretórios críticos essenciais. Abaixo está a lista detalhada do que <strong>NUNCA</strong> deve ser apagado manualmente via terminal ou scripts para evitar corrupção irreversível do host.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card/60 border border-border/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Pastas Críticas (Perigo Máximo 🔴)</span>
              </div>
              <ul className="space-y-2.5 text-xs text-secondary">
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-primary font-mono block">/boot</strong>
                  Contém os kernels do Linux, Initramfs e Grub. Se apagado, o servidor não inicializará.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-primary font-mono block">/var/lib/docker/overlay2</strong>
                  Camadas internas do Docker. Nunca use <code className="text-rose-400">rm -rf</code> diretamente aqui. Use sempre <code className="text-sky-400">docker system prune</code>.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-primary font-mono block">/etc</strong>
                  Configurações globais do sistema operacional (<code className="text-zinc-300">fstab</code>, <code className="text-zinc-300">passwd</code>, rede, etc.).
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-primary font-mono block">/lib e /usr/lib</strong>
                  Bibliotecas compartilhadas (.so) necessárias para a execução de praticamente todos os binários do sistema.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-primary font-mono block">/proc e /sys</strong>
                  Sistemas de arquivos virtuais gerados em memória RAM pelo kernel. Não ocupam espaço real em disco.
                </li>
              </ul>
            </div>

            <div className="bg-card/60 border border-border/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Pastas de Atenção & Limpeza Segura (🟡 / 🟢)</span>
              </div>
              <ul className="space-y-2.5 text-xs text-secondary">
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-emerald-400 font-mono block">/tmp e /var/tmp (🟢 Seguro)</strong>
                  Arquivos temporários de sessões e processos. Podem ser limpos com segurança.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-emerald-400 font-mono block">~/.cache (🟢 Seguro)</strong>
                  Caches de navegadores e ferramentas CLI. Podem ser excluídos sem perda de dados permanentes.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-amber-400 font-mono block">/var/lib (🟡 Atenção)</strong>
                  Contém dados de bancos de dados ativos (Postgres, MySQL, Redis) e volumes de aplicações.
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-900/80 border border-border/60">
                  <strong className="text-amber-400 font-mono block">~/.config (🟡 Atenção)</strong>
                  Preferências de usuário e chaves de configurações de aplicativos.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiskAnalyzer;
