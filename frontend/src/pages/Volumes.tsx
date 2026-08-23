import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, ShieldAlert, Search, ArrowUpDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useTasks } from '../contexts/InstallContext';
import { formatBytes } from '../utils/format';
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
  const { startTask } = useTasks();
  const [volumes, setVolumes] = useState<VolumeData[]>([]);
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
    const unusedVolumes = volumes.filter(v => !v.in_use);

    if (unusedVolumes.length === 0) {
      setConfirmAction({
        isOpen: true,
        title: 'Nenhum Volume Não Utilizado',
        message: 'Todos os volumes listados estão em uso por containers ativos. Nenhum volume será removido.',
        children: (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            Dica: Para remover um volume, pare e remova o container associado a ele primeiro.
          </div>
        ),
        onConfirm: () => {}
      });
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: 'Limpar Volumes Não Utilizados',
      message: `Tem certeza que deseja remover permanentemente os ${unusedVolumes.length} volumes não utilizados? Esta ação liberará espaço em disco.`,
      children: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-secondary font-medium">
            <span>Volumes que serão excluídos:</span>
            <span className="font-bold text-rose-400">{unusedVolumes.length} volume(s)</span>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl bg-background/60 border border-border">
            {unusedVolumes.map(v => (
              <div key={v.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-card/80 border border-border/50 text-xs font-mono text-primary">
                <HardDrive className="w-3.5 h-3.5 text-orbit-400 shrink-0" />
                <span className="truncate flex-1" title={v.name}>{v.name}</span>
                <span className="text-[10px] text-secondary px-1.5 py-0.5 rounded bg-accent shrink-0">{v.driver}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      onConfirm: () => {
        startTask({
          type: 'prune_volumes',
          title: 'Limpeza de Volumes Docker',
          destinationUrl: '/volumes',
          initialLogs: [
            `[INFO] Iniciando limpeza de ${unusedVolumes.length} volume(s) não utilizado(s)...`,
            ...unusedVolumes.map(v => `[PRUNE] Marcado para remoção: ${v.name}`)
          ],
          runner: async (helpers) => {
            helpers.setProgress(20);
            helpers.setStatus('running');
            const token = localStorage.getItem('orbit_token');
            const res = await fetch('/api/docker/volumes/prune', { 
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            helpers.setProgress(75);
            if (!res.ok) {
              const err = await res.text();
              throw new Error(err || 'Falha ao remover volumes no Docker daemon');
            }
            const data = typeof res.json === 'function' ? await res.json().catch(() => null) : null;
            const deleted: string[] = data?.deleted || [];
            const spaceReclaimed: number = data?.space_reclaimed || 0;
            
            helpers.addLog(`[INFO] Volumes removidos pelo Docker: ${deleted.length}`);
            deleted.forEach(name => helpers.addLog(`[SUCCESS] Volume removido: ${name}`));
            if (spaceReclaimed > 0) {
              helpers.addLog(`[INFO] Espaço recuperado em disco: ${formatBytes(spaceReclaimed)}`);
            }
            helpers.setDone(`Limpeza concluída! ${deleted.length} volume(s) removido(s).`);
            if (deleted.length > 0) {
              toast.success('Volumes não utilizados removidos com sucesso!');
            } else {
              toast('Nenhum volume removido pelo Docker.', { icon: 'ℹ️' });
            }
            fetchVolumes();
          }
        });
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/60 p-3 sm:p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, ponto de montagem ou driver..."
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
              Todos ({volumes.length})
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
              Não usados ({unusedCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-secondary shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar volumes por"
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
            <HardDrive className="w-8 h-8 animate-pulse text-orbit-500" />
            <span>Carregando volumes...</span>
          </div>
        ) : filteredAndSortedVolumes.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-secondary">
            Nenhum volume encontrado com os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border">
              {filteredAndSortedVolumes.map((vol) => (
                <div key={vol.name} className="p-4 space-y-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-400 shrink-0">
                        <HardDrive className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-primary text-sm font-mono break-all" title={vol.name}>
                        {vol.name}
                      </span>
                    </div>
                    {vol.in_use ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Em uso {vol.containers_count && vol.containers_count > 1 ? `(${vol.containers_count})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 shrink-0">
                        <AlertCircle className="w-3 h-3 text-zinc-400" />
                        Não utilizado
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-secondary bg-background/50 p-2.5 rounded-xl border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary/70">Driver:</span>
                      <span className="font-mono text-primary px-1.5 py-0.5 rounded bg-accent text-[11px]">
                        {vol.driver}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-secondary/70 block text-[10px]">Ponto de Montagem:</span>
                      <span className="font-mono text-primary text-[11px] break-all block">
                        {vol.mountpoint}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => confirmDelete(vol.name)}
                      className="w-full py-2.5 px-3 rounded-xl border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-2 min-h-[40px]"
                      aria-label={`Excluir Volume ${vol.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir Volume</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
