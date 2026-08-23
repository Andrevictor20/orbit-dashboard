import { useState, useEffect } from 'react';
import { Package, Trash2, HardDrive, ShieldAlert, Search, ArrowUpDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useTasks } from '../contexts/InstallContext';
import { formatBytes } from '../utils/format';
import toast from 'react-hot-toast';

interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  in_use?: boolean;
  containers_count?: number;
}

type StatusFilter = 'all' | 'used' | 'unused';
type SortOption = 'size_desc' | 'size_asc' | 'name' | 'status';

export function Images() {
  const { startTask } = useTasks();
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('size_desc');
  
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    children?: React.ReactNode;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/images', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const confirmPrune = () => {
    const unusedImages = images.filter(img => !img.in_use);

    if (unusedImages.length === 0) {
      setConfirmAction({
        isOpen: true,
        title: 'Nenhuma Imagem Não Utilizada',
        message: 'Todas as imagens listadas estão vinculadas a containers existentes. Nenhuma imagem será removida.',
        children: (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            Dica: Para remover uma imagem, pare e remova os containers que utilizam essa imagem primeiro.
          </div>
        ),
        onConfirm: () => {}
      });
      return;
    }

    const totalUnusedSize = unusedImages.reduce((acc, img) => acc + (img.size || 0), 0);

    setConfirmAction({
      isOpen: true,
      title: 'Limpar Imagens Não Utilizadas',
      message: `Tem certeza que deseja remover permanentemente as ${unusedImages.length} imagens não utilizadas (dangling/órfãs)? Esta ação liberará aproximadamente ${formatBytes(totalUnusedSize)} de espaço em disco.`,
      children: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-secondary font-medium">
            <span>Imagens que serão excluídas:</span>
            <span className="font-bold text-rose-400">{unusedImages.length} imagem(ns) (~{formatBytes(totalUnusedSize)})</span>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl bg-background/60 border border-border">
            {unusedImages.map(img => {
              const primaryTag = img.tags && img.tags.length > 0 ? img.tags[0] : '<sem tag>';
              return (
                <div key={img.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card/80 border border-border/50 text-xs font-mono text-primary">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-3.5 h-3.5 text-orbit-400 shrink-0" />
                    <span className="truncate" title={primaryTag}>{primaryTag}</span>
                    <span className="text-[10px] text-secondary">({img.id})</span>
                  </div>
                  <span className="text-[11px] text-primary font-semibold shrink-0">{formatBytes(img.size)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ),
      onConfirm: () => {
        startTask({
          type: 'prune_images',
          title: 'Limpeza de Imagens Docker',
          destinationUrl: '/images',
          initialLogs: [
            `[INFO] Iniciando limpeza de ${unusedImages.length} imagem(ns) não utilizada(s)...`,
            ...unusedImages.map(img => `[PRUNE] Marcada para remoção: ${img.tags?.[0] || img.id} (${formatBytes(img.size)})`)
          ],
          runner: async (helpers) => {
            helpers.setProgress(25);
            helpers.setStatus('running');
            const token = localStorage.getItem('orbit_token');
            const res = await fetch('/api/docker/images/prune', { 
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            helpers.setProgress(80);
            if (!res.ok) {
              const err = await res.text();
              throw new Error(err || 'Falha ao comunicar com o Docker daemon para prune.');
            }
            const data = typeof res.json === 'function' ? await res.json().catch(() => null) : null;
            const deleted: string[] = data?.deleted || [];
            const spaceReclaimed: number = data?.space_reclaimed || 0;

            helpers.addLog(`[INFO] Camadas/Imagens removidas pelo Docker: ${deleted.length}`);
            deleted.slice(0, 15).forEach(id => helpers.addLog(`[SUCCESS] Imagem removida: ${id}`));
            if (deleted.length > 15) {
              helpers.addLog(`[INFO] ... e mais ${deleted.length - 15} imagens/camadas removidas.`);
            }
            if (spaceReclaimed > 0) {
              helpers.addLog(`[INFO] Espaço recuperado em disco: ${formatBytes(spaceReclaimed)}`);
            }
            helpers.setDone(`Limpeza concluída! ${deleted.length || unusedImages.length} imagem(ns) removida(s).`);
            toast.success('Imagens limpas com sucesso!');
            fetchImages();
          }
        });
      }
    });
  };

  const confirmDelete = (id: string) => {
    setConfirmAction({
      isOpen: true,
      title: 'Excluir Imagem',
      message: `Tem certeza que deseja excluir permanentemente a imagem ${id}? Se houver containers vinculados a ela, a ação falhará.`,
      onConfirm: async () => {
        const loadingToast = toast.loading('Excluindo imagem...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch(`/api/docker/images/${id}`, { 
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Imagem excluída com sucesso!', { id: loadingToast });
            fetchImages();
          } else {
            const err = await res.text();
            toast.error(`Erro ao excluir: ${err || 'Imagem em uso'}`, { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(2) + ' MB';
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredAndSortedImages = [...images]
    .filter(img => {
      // Status filter
      if (statusFilter === 'used' && !img.in_use) return false;
      if (statusFilter === 'unused' && img.in_use) return false;

      // Search query
      if (!query) return true;
      const idMatch = img.id.toLowerCase().includes(query);
      const tagsMatch = (img.tags || []).some(t => t.toLowerCase().includes(query));
      return idMatch || tagsMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'size_desc':
          return (b.size || 0) - (a.size || 0);
        case 'size_asc':
          return (a.size || 0) - (b.size || 0);
        case 'name': {
          const nameA = a.tags?.[0] || a.id;
          const nameB = b.tags?.[0] || b.id;
          return nameA.localeCompare(nameB);
        }
        case 'status':
          return (b.in_use ? 1 : 0) - (a.in_use ? 1 : 0);
        default:
          return 0;
      }
    });

  const usedCount = images.filter(img => img.in_use).length;
  const unusedCount = images.filter(img => !img.in_use).length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-primary">
            <Package className="h-6 w-6 text-orbit-500" />
            Inventário de Imagens
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-1">Gerencie as imagens Docker e visualize o consumo em disco</p>
        </div>
        <div>
          <button 
            onClick={confirmPrune}
            className="glass-button px-3.5 py-2 rounded-lg flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs sm:text-sm font-medium transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Limpar Não Utilizadas (Prune)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/60 p-3 sm:p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por tag ou ID da imagem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 transition-colors font-mono"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Status Tabs */}
          <div className="flex bg-background p-1 rounded-xl border border-border text-xs overflow-x-auto scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-center ${statusFilter === 'all' ? 'bg-orbit-500 text-white shadow-sm font-semibold' : 'text-secondary hover:text-primary'}`}
            >
              Todas ({images.length})
            </button>
            <button
              onClick={() => setStatusFilter('used')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${statusFilter === 'used' ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30' : 'text-secondary hover:text-primary'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Em uso ({usedCount})
            </button>
            <button
              onClick={() => setStatusFilter('unused')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${statusFilter === 'unused' ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30' : 'text-secondary hover:text-primary'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Não usadas ({unusedCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-secondary shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar imagens por"
              className="bg-transparent text-primary focus:outline-none cursor-pointer text-xs w-full"
            >
              <option value="size_desc" className="bg-card text-primary">Tamanho (Maior)</option>
              <option value="size_asc" className="bg-card text-primary">Tamanho (Menor)</option>
              <option value="name" className="bg-card text-primary">Nome (A-Z)</option>
              <option value="status" className="bg-card text-primary">Em uso primeiro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content: Mobile Cards + Desktop Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 sm:p-12 text-center text-secondary flex flex-col items-center justify-center gap-2">
            <Package className="w-8 h-8 animate-pulse text-orbit-500" />
            <span>Carregando imagens...</span>
          </div>
        ) : filteredAndSortedImages.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-secondary">
            Nenhuma imagem encontrada com os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border">
              {filteredAndSortedImages.map((img) => {
                const primaryTag = img.tags && img.tags.length > 0 ? img.tags[0] : '<none>';
                return (
                  <div key={img.id} className="p-4 space-y-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-400 shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-primary text-sm font-mono break-all" title={primaryTag}>
                          {primaryTag}
                        </span>
                      </div>
                      {img.in_use ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Em uso {img.containers_count && img.containers_count > 1 ? `(${img.containers_count})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 shrink-0">
                          <AlertCircle className="w-3 h-3 text-zinc-400" />
                          Não utilizada
                        </span>
                      )}
                    </div>

                    {img.tags && img.tags.length > 1 && (
                      <div className="flex flex-wrap gap-1">
                        {img.tags.slice(1).map(t => (
                          <span key={t} className="px-1.5 py-0.5 bg-accent/60 border border-border rounded text-[10px] font-mono text-secondary">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-secondary bg-background/50 p-2.5 rounded-xl border border-border/50">
                      <div className="flex items-center gap-1.5 font-mono text-primary text-xs font-semibold">
                        <HardDrive className="h-3.5 w-3.5 text-orbit-500" />
                        {formatSize(img.size)}
                      </div>
                      <div className="font-mono text-[11px] text-secondary">
                        ID: {img.id}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={() => confirmDelete(img.id)}
                        className="w-full py-2.5 px-3 rounded-xl border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-2 min-h-[40px]"
                        aria-label={`Excluir Imagem ${img.tags?.[0] || img.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Excluir Imagem</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-border text-secondary text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Tags / Imagem</th>
                    <th className="p-4 font-medium">ID</th>
                    <th className="p-4 font-medium">Tamanho</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAndSortedImages.map((img) => (
                    <tr key={img.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        {img.in_use ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Em uso {img.containers_count && img.containers_count > 1 ? `(${img.containers_count})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            <AlertCircle className="w-3 h-3 text-zinc-400" />
                            Não utilizada
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 max-w-lg">
                          {img.tags && img.tags.length > 0 ? (
                            img.tags.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-accent/60 border border-border rounded text-xs font-mono font-medium text-primary">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-secondary italic text-xs">&lt;none&gt;</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-secondary">{img.id}</td>
                      <td className="p-4 text-primary font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-orbit-500" />
                          {formatSize(img.size)}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => confirmDelete(img.id)}
                          className="p-2 text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Excluir Imagem"
                          aria-label={`Excluir Imagem ${img.tags?.[0] || img.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.onConfirm}
        isDestructive={true}
        confirmText="Sim, excluir"
        children={confirmAction.children}
      />
    </div>
  );
}
