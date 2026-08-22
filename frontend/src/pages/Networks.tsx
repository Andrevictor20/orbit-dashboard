import { useState, useEffect } from 'react';
import { Network, Server, Trash2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
}

export function Networks() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-secondary" />
            Redes Docker
          </h2>
          <p className="text-secondary">Listagem de redes virtuais gerenciadas pelo Docker</p>
        </div>
        <button
          onClick={confirmPruneNetworks}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md transition-colors text-sm font-medium"
        >
          <AlertCircle className="h-4 w-4" />
          Limpar Não Utilizadas
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando redes...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border text-secondary text-sm">
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Driver</th>
                <th className="p-4 font-medium">ID (Curto)</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((net) => (
                <tr key={net.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="p-4 font-medium text-primary flex items-center gap-2">
                    <Server className="h-4 w-4 text-orbit-500" />
                    {net.name}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-accent rounded text-xs font-medium text-secondary border border-border">
                      {net.driver}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-sm text-secondary">{net.id}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => confirmDeleteNetwork(net.id, net.name)}
                      className="p-2 text-secondary hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Remover Rede"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {networks.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-secondary">Nenhuma rede encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
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
