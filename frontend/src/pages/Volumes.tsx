import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, ShieldAlert, Search, ArrowUpDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface VolumeData {
  name: string;
  driver: string;
  mountpoint: string;
  in_use?: boolean;
  containers_count?: number;
  size?: number;
}

type StatusFilter = 'all' | 'used' | 'unused';
type SortOption = 'name' | 'status' | 'driver';

export function Volumes() {
  const { t } = useTranslation();
  const [volumes, setVolumes] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  
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

  const fetchVolumes = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/volumes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVolumes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolumes();
  }, []);

  const confirmPrune = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Limpar Volumes Não Utilizados',
      message: 'Tem certeza que deseja remover todos os volumes não utilizados? Esta ação é irreversível e liberará espaço em disco.',
      onConfirm: async () => {
        const loadingToast = toast.loading('Removendo volumes...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch('/api/docker/volumes/prune', { 
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Volumes não utilizados removidos!', { id: loadingToast });
            fetchVolumes();
          } else {
            toast.error('Erro ao remover volumes.', { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const confirmDelete = (name: string) => {
    setConfirmAction({
      isOpen: true,
      title: 'Excluir Volume',
      message: `Tem certeza que deseja excluir o volume ${name}? Dados contidos nele serão perdidos permanentemente.`,
      onConfirm: async () => {
        const loadingToast = toast.loading('Excluindo volume...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch(`/api/docker/volumes/${name}`, { 
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Volume excluído com sucesso!', { id: loadingToast });
            fetchVolumes();
          } else {
            const err = await res.text();
            toast.error(`Erro ao excluir: ${err || 'Volume em uso'}`, { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredAndSortedVolumes = [...volumes]
    .filter(vol => {
      if (statusFilter === 'used' && !vol.in_use) return false;
      if (statusFilter === 'unused' && vol.in_use) return false;

      if (!query) return true;
      return (
        vol.name.toLowerCase().includes(query) ||
        vol.mountpoint.toLowerCase().includes(query) ||
        vol.driver.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return (b.in_use ? 1 : 0) - (a.in_use ? 1 : 0);
        case 'driver':
          return a.driver.localeCompare(b.driver);
        default:
          return 0;
      }
    });

  const usedCount = volumes.filter(v => v.in_use).length;
  const unusedCount = volumes.filter(v => !v.in_use).length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-orbit-500" />
            {t('sidebar.volumes')}
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-1">Gerencie a persistência de dados e volumes montados pelos containers</p>
        </div>
        <div>
          <button 
            onClick={confirmPrune}
            className="glass-button px-3.5 py-2 rounded-lg flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs sm:text-sm font-medium transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Limpar Não Utilizados (Prune)
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
            placeholder="Buscar por nome, ponto de montagem ou driver..."
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
              Todos ({volumes.length})
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
              Não usados ({unusedCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-secondary" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar volumes por"
              className="bg-transparent text-primary focus:outline-none cursor-pointer text-xs"
            >
              <option value="status" className="bg-card text-primary">Em uso primeiro</option>
              <option value="name" className="bg-card text-primary">Nome (A-Z)</option>
              <option value="driver" className="bg-card text-primary">Driver</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando volumes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-white/5 text-secondary text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Nome do Volume</th>
                  <th className="p-4 font-medium">Driver</th>
                  <th className="p-4 font-medium">Ponto de Montagem</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedVolumes.map((vol) => (
                  <tr key={vol.name} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      {vol.in_use ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Em uso {vol.containers_count && vol.containers_count > 1 ? `(${vol.containers_count})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <AlertCircle className="w-3 h-3 text-zinc-400" />
                          Não utilizado
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <HardDrive className="w-4 h-4 text-orbit-500 flex-shrink-0" />
                        <span className="font-mono text-sm font-medium text-primary" title={vol.name}>
                          {vol.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-white/10 text-secondary border border-border">
                        {vol.driver}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-mono text-secondary truncate max-w-[320px] block" title={vol.mountpoint}>
                        {vol.mountpoint}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => confirmDelete(vol.name)}
                        className="p-2 text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Excluir Volume"
                        aria-label={`Excluir Volume ${vol.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAndSortedVolumes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-secondary">
                      Nenhum volume encontrado com os filtros selecionados.
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
