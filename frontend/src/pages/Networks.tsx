import { useState, useEffect } from 'react';
import { Network, Server, Trash2, AlertCircle, Search, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  in_use?: boolean;
  containers_count?: number;
}

type StatusFilter = 'all' | 'used' | 'unused';
type SortOption = 'status' | 'name' | 'driver';

export function Networks() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
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

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/networks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNetworks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteNetwork = (id: string, name: string) => {
    setConfirmAction({
      isOpen: true,
      title: 'Remover Rede',
      message: `Tem certeza que deseja remover a rede ${name}? Containers atrelados a ela podem perder comunicação.`,
      onConfirm: async () => {
        const loadingToast = toast.loading('Removendo rede...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch(`/api/docker/networks/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Rede removida com sucesso!', { id: loadingToast });
            fetchNetworks();
          } else {
            const err = await res.text();
            toast.error(`Erro ao remover rede: ${err}`, { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const confirmPruneNetworks = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Limpar Redes Não Utilizadas',
      message: 'Tem certeza que deseja remover TODAS as redes não utilizadas? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        const loadingToast = toast.loading('Limpando redes...');
        try {
          const token = localStorage.getItem('orbit_token');
          const res = await fetch('/api/docker/networks/prune', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success('Redes não utilizadas foram removidas!', { id: loadingToast });
            fetchNetworks();
          } else {
            const err = await res.text();
            toast.error(`Erro ao limpar redes: ${err}`, { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredAndSortedNetworks = [...networks]
    .filter(net => {
      if (statusFilter === 'used' && !net.in_use) return false;
      if (statusFilter === 'unused' && net.in_use) return false;

      if (!query) return true;
      return (
        net.name.toLowerCase().includes(query) ||
        net.id.toLowerCase().includes(query) ||
        net.driver.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'status':
          return (b.in_use ? 1 : 0) - (a.in_use ? 1 : 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'driver':
          return a.driver.localeCompare(b.driver);
        default:
          return 0;
      }
    });

  const usedCount = networks.filter(n => n.in_use).length;
  const unusedCount = networks.filter(n => !n.in_use).length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-primary">
            <Network className="h-6 w-6 text-orbit-500" />
            Redes Docker
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-1">Listagem de redes virtuais gerenciadas pelo Docker e isolamento de tráfego</p>
        </div>
        <div>
          <button
            onClick={confirmPruneNetworks}
            className="glass-button px-3.5 py-2 rounded-lg flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs sm:text-sm font-medium transition-colors"
          >
            <AlertCircle className="h-4 w-4" />
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
            placeholder="Buscar por nome da rede, ID ou driver..."
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
              Todas ({networks.length})
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
              aria-label="Ordenar redes por"
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
          <div className="p-8 text-center text-secondary">Carregando redes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-border text-secondary text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">Driver</th>
                  <th className="p-4 font-medium">ID (Curto)</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedNetworks.map((net) => (
                  <tr key={net.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      {net.in_use ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Em uso {net.containers_count && net.containers_count > 0 ? `(${net.containers_count})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <AlertCircle className="w-3 h-3 text-zinc-400" />
                          Não utilizada
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-primary flex items-center gap-2">
                      <Server className="h-4 w-4 text-orbit-500" />
                      {net.name}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-accent rounded text-xs font-medium text-secondary border border-border">
                        {net.driver}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-secondary">{net.id}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => confirmDeleteNetwork(net.id, net.name)}
                        className="p-2 text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Remover Rede"
                        aria-label={`Remover Rede ${net.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAndSortedNetworks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-secondary">
                      Nenhuma rede encontrada com os filtros selecionados.
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
        confirmText="Sim, continuar"
      />
    </div>
  );
}
