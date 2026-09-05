import { useState, useEffect } from 'react';
import { 
  X, 
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
  RefreshCw
} from 'lucide-react';

interface DiskItemStat {
  name: String;
  path: String;
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

interface DiskAnalyzerModalProps {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTo: (path: string) => void;
}

export function DiskAnalyzerModal({ currentPath, isOpen, onClose, onNavigateTo }: DiskAnalyzerModalProps) {
  const [data, setData] = useState<DiskAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/analyze?path=${encodeURIComponent(currentPath)}`);
      if (!res.ok) throw new Error('Falha ao analisar o diretório');
      const json: DiskAnalysisResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalysis();
    }
  }, [isOpen, currentPath]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getItemIcon = (name: string, is_dir: boolean) => {
    if (is_dir) return <Folder className="text-violet-400" size={18} />;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'mkv', 'webm', 'mov'].includes(ext)) return <Film className="text-emerald-400" size={18} />;
    if (['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return <Music className="text-amber-400" size={18} />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return <ImageIcon className="text-pink-400" size={18} />;
    if (['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext)) return <Archive className="text-orange-400" size={18} />;
    return <FileText className="text-blue-400" size={18} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-primary animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
              <PieChart size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                Analisador de Espaço em Disco
              </h2>
              <p className="text-xs text-slate-600 dark:text-secondary font-mono max-w-lg truncate">
                {currentPath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalysis}
              disabled={loading}
              className="p-2 rounded-xl bg-accent/60 hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary transition-colors border border-border disabled:opacity-50"
              title="Recarregar Análise"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-accent/60 hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary transition-colors border border-border"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600 dark:text-secondary">
              <Loader2 className="animate-spin text-violet-600 dark:text-violet-400" size={32} />
              <p className="text-sm font-medium">Calculando tamanhos recursivos de arquivos...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-sm text-center font-medium">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-accent/30 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-600 dark:text-secondary font-medium">Espaço Total Ocupado</span>
                    <h3 className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1 font-mono">
                      {formatBytes(data.total_size)}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                    <HardDrive size={24} />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-accent/30 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-600 dark:text-secondary font-medium">Total de Itens</span>
                    <h3 className="text-2xl font-bold text-primary mt-1 font-mono">
                      {data.item_count}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-accent text-slate-700 dark:text-secondary border border-border">
                    <Folder size={24} />
                  </div>
                </div>
              </div>

              {/* Items List Ranking */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-secondary">
                  Ranking de Consumo por Item
                </h4>

                {data.items.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-600 dark:text-secondary rounded-xl bg-accent/20 border border-border">
                    Esta pasta está vazia.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.items.map((item) => (
                      <div
                        key={String(item.path)}
                        className="p-3.5 rounded-xl bg-card hover:bg-accent/30 border border-border transition-all flex flex-col gap-2 group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getItemIcon(String(item.name), item.is_dir)}
                            <span className="text-sm font-semibold text-primary truncate group-hover:text-violet-600 dark:group-hover:text-violet-300">
                              {String(item.name)}
                            </span>
                            {item.is_dir && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-bold">
                                Pasta
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs font-mono font-bold text-primary">
                              {formatBytes(item.size)}
                            </span>
                            <span className="text-xs font-mono text-slate-700 dark:text-secondary font-medium w-12 text-right">
                              {item.percentage.toFixed(1)}%
                            </span>
                            {item.is_dir && (
                              <button
                                onClick={() => {
                                  onNavigateTo(String(item.path));
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-accent hover:bg-violet-600 text-slate-700 dark:text-secondary hover:text-white transition-colors"
                                title="Abrir esta pasta"
                              >
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.is_dir ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            }`}
                            style={{ width: `${Math.min(Math.max(item.percentage, 1), 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
