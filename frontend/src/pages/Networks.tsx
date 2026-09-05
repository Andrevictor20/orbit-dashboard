import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Server, Trash2, AlertCircle, Search, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useTasks } from '../contexts/InstallContext';
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
  const { t } = useTranslation();
  const { startTask } = useTasks();
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  
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
    const unusedNetworks = networks.filter(n => !n.in_use);

    if (unusedNetworks.length === 0) {
      setConfirmAction({
        isOpen: true,
        title: 'Nenhuma Rede Não Utilizada',
        message: 'Todas as redes Docker existentes estão em uso por containers. Nenhuma rede será removida.',
        children: (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            Dica: Redes padrão como bridge e host não são removidas pelo comando de limpeza.
          </div>
        ),
        onConfirm: () => {}
      });
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: 'Limpar Redes Não Utilizadas',
      message: `Tem certeza que deseja remover as ${unusedNetworks.length} redes não utilizadas abaixo? Esta ação não pode ser desfeita.`,
      children: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-secondary font-medium">
            <span>Redes que serão removidas:</span>
            <span className="font-bold text-rose-400">{unusedNetworks.length} rede(s)</span>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl bg-background/60 border border-border">
            {unusedNetworks.map(net => (
              <div key={net.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card/80 border border-border/50 text-xs font-mono text-primary">
                <div className="flex items-center gap-2 min-w-0">
                  <Network className="w-3.5 h-3.5 text-orbit-400 shrink-0" />
                  <span className="truncate font-semibold" title={net.name}>{net.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-secondary px-1.5 py-0.5 rounded bg-accent">{net.driver}</span>
                  <span className="text-[10px] text-secondary font-mono">({net.id.substring(0, 10)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      onConfirm: () => {
        startTask({
          type: 'prune_networks',
          title: 'Limpeza de Redes Docker',
          destinationUrl: '/networks',
          initialLogs: [
            `[INFO] Iniciando limpeza de ${unusedNetworks.length} rede(s) não utilizada(s)...`,
            ...unusedNetworks.map(n => `[PRUNE] Marcada para remoção: ${n.name} (${n.driver})`)
          ],
          runner: async (helpers) => {
            helpers.setProgress(20);
            helpers.setStatus('running');
            const token = localStorage.getItem('orbit_token');
            const res = await fetch('/api/docker/networks/prune', {
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

            helpers.addLog(`[INFO] Redes removidas pelo Docker: ${deleted.length}`);
            deleted.forEach(name => helpers.addLog(`[SUCCESS] Rede removida: ${name}`));
            helpers.setDone(`Limpeza concluída! ${deleted.length} rede(s) removida(s).`);
            if (deleted.length > 0) {
              toast.success('Redes não utilizadas removidas com sucesso!');
            } else {
              toast('Nenhuma rede removida pelo Docker.', { icon: 'ℹ️' });
            }
            fetchNetworks();
          }
        });
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
            {t('networks.title')}
          </h2>
          <p className="text-xs sm:text-sm text-secondary mt-1">{t('networks.subtitle')}</p>
        </div>
        <div>
          <button
            onClick={confirmPruneNetworks}
            className="glass-button px-3.5 py-2 rounded-lg flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs sm:text-sm font-medium transition-colors"
          >
            <AlertCircle className="h-4 w-4" />
            {t('networks.prune_unused')}
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
            placeholder={t('networks.search_placeholder')}
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
              {t('common.all')} ({networks.length})
            </button>
            <button
              onClick={() => setStatusFilter('used')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${statusFilter === 'used' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30' : 'text-secondary hover:text-primary font-medium'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t('networks.in_use')} ({usedCount})
            </button>
            <button
              onClick={() => setStatusFilter('unused')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${statusFilter === 'unused' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30' : 'text-secondary hover:text-primary font-medium'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {t('networks.unused')} ({unusedCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-secondary shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar redes por"
              className="bg-transparent text-primary focus:outline-none cursor-pointer text-xs w-full"
            >
              <option value="status" className="bg-card text-primary">Em uso primeiro</option>
              <option value="name" className="bg-card text-primary">Nome (A-Z)</option>
              <option value="driver" className="bg-card text-primary">Driver</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content: Mobile Cards + Desktop Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 sm:p-12 text-center text-secondary flex flex-col items-center justify-center gap-2">
            <Network className="w-8 h-8 animate-pulse text-orbit-500" />
            <span>Carregando redes...</span>
          </div>
        ) : filteredAndSortedNetworks.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-secondary">
            Nenhuma rede encontrada com os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border">
              {filteredAndSortedNetworks.map((net) => (
                <div key={net.id} className="p-4 space-y-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-600 dark:text-orbit-400 shrink-0">
                        <Server className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-primary text-sm truncate" title={net.name}>
                        {net.name}
                      </span>
                    </div>
                    {net.in_use ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Em uso {net.containers_count && net.containers_count > 0 ? `(${net.containers_count})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent text-slate-700 dark:text-zinc-300 border border-border shrink-0">
                        <AlertCircle className="w-3 h-3 text-slate-600 dark:text-zinc-400" />
                        Não utilizada
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-secondary bg-background/50 p-2.5 rounded-xl border border-border/50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-secondary/70">Driver:</span>
                      <span className="font-mono text-primary px-1.5 py-0.5 rounded bg-accent text-[11px]">
                        {net.driver}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-secondary">
                      ID: {net.id}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => confirmDeleteNetwork(net.id, net.name)}
                      className="w-full py-2.5 px-3 rounded-xl border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-2 min-h-[40px]"
                      aria-label={`Remover Rede ${net.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remover Rede</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Em uso {net.containers_count && net.containers_count > 0 ? `(${net.containers_count})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent text-slate-700 dark:text-zinc-300 border border-border">
                            <AlertCircle className="w-3 h-3 text-slate-600 dark:text-zinc-400" />
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
        confirmText="Sim, continuar"
        children={confirmAction.children}
      />
    </div>
  );
}
