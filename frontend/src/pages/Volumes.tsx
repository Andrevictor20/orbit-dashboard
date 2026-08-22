import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface VolumeData {
  name: string;
  driver: string;
  mountpoint: string;
}

export function Volumes() {
  const { t } = useTranslation();
  const [volumes, setVolumes] = useState<VolumeData[]>([]);
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
      message: 'Tem certeza que deseja remover todos os volumes não utilizados? Esta ação é irreversível.',
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
            toast.error('Erro ao excluir volume. Ele pode estar em uso.', { id: loadingToast });
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
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">{t('sidebar.volumes')}</h2>
          <p className="text-sm text-secondary mt-1">Gerenciamento de persistência de dados</p>
        </div>
        <div>
          <button 
            onClick={confirmPrune}
            className="glass-button px-4 py-2 rounded-md flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <ShieldAlert className="w-4 h-4" />
            Limpar Não Utilizados (Prune)
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando volumes...</div>
        ) : volumes.length === 0 ? (
          <div className="p-8 text-center text-secondary">Nenhum volume encontrado.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="p-4 text-sm font-semibold text-secondary">Nome do Volume</th>
                <th className="p-4 text-sm font-semibold text-secondary">Driver</th>
                <th className="p-4 text-sm font-semibold text-secondary">Ponto de Montagem</th>
                <th className="p-4 text-sm font-semibold text-secondary text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {volumes.map((vol) => (
                <tr key={vol.name} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-orbit-500" />
                      <span className="font-medium text-primary">{vol.name.substring(0, 24)}{vol.name.length > 24 ? '...' : ''}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-white/10 text-secondary">
                      {vol.driver}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-mono text-secondary truncate max-w-[300px] block" title={vol.mountpoint}>
                      {vol.mountpoint}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => confirmDelete(vol.name)}
                      className="p-2 text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Excluir Volume"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
        confirmText="Sim, excluir"
      />
    </div>
  );
}
