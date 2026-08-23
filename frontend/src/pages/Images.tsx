import { useState, useEffect } from 'react';
import { Package, Trash2, HardDrive, ShieldAlert, Search, ArrowUpDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
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
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('size_desc');
  
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
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
    setConfirmAction({
      isOpen: true,
      title: 'Limpar Imagens Não Utilizadas',
      message: 'Tem certeza que deseja remover TODAS as imagens não utilizadas (dangling)? Esta ação não pode ser desfeita e liberará espaço em disco.',
      onConfirm: async () => {
        const loadingToast = toast.loading('Removendo imagens...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch('/api/docker/images/prune', { 
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Imagens limpas com sucesso!', { id: loadingToast });
            fetchImages();
          } else {
            toast.error('Erro ao limpar imagens.', { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/60 p-3 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            placeholder="Buscar por tag ou ID da imagem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 transition-colors font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex bg-background p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'all' ? 'bg-accent text-white shadow-sm font-medium' : 'text-secondary hover:text-primary'}`}
            >
              Todas ({images.length})
            </button>
            <button
              onClick={() => setStatusFilter('used')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${statusFilter === 'used' ? 'bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30' : 'text-secondary hover:text-primary'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Em uso ({usedCount})
            </button>
            <button
              onClick={() => setStatusFilter('unused')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${statusFilter === 'unused' ? 'bg-amber-500/20 text-amber-400 font-medium border border-amber-500/30' : 'text-secondary hover:text-primary'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Não usadas ({unusedCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-secondary" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar imagens por"
              className="bg-transparent text-primary focus:outline-none cursor-pointer text-xs"
            >
              <option value="size_desc" className="bg-card text-primary">Tamanho (Maior)</option>
              <option value="size_asc" className="bg-card text-primary">Tamanho (Menor)</option>
              <option value="name" className="bg-card text-primary">Nome (A-Z)</option>
              <option value="status" className="bg-card text-primary">Em uso primeiro</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando imagens...</div>
        ) : (
          <div className="overflow-x-auto">
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
                    {/* Status Tag (Portainer style) */}
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
                {filteredAndSortedImages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-secondary">
                      Nenhuma imagem encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
      />
    </div>
  );
}
