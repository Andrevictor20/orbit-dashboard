import { useState, useEffect } from 'react';
import { Package, Trash2, HardDrive, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
}

export function Images() {
  const [images, setImages] = useState<ImageInfo[]>([]);
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
      message: `Tem certeza que deseja excluir permanentemente a imagem ${id}? Se houver containers rodando com ela, a ação falhará.`,
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
            toast.error('Erro ao excluir imagem.', { id: loadingToast });
          }
        } catch (e) {
          console.error(e);
          toast.error('Erro de conexão.', { id: loadingToast });
        }
      }
    });
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Package className="h-6 w-6 text-secondary" />
            Inventário de Imagens
          </h2>
          <p className="text-secondary mt-1">Gerencie as imagens Docker no host</p>
        </div>
        <div>
          <button 
            onClick={confirmPrune}
            className="glass-button px-4 py-2 rounded-md flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <ShieldAlert className="w-4 h-4" />
            Limpar Não Utilizadas (Prune)
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando imagens...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-border text-secondary text-sm">
                <th className="p-4 font-medium">ID (Curto)</th>
                <th className="p-4 font-medium">Tags</th>
                <th className="p-4 font-medium">Tamanho</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {images.map((img) => (
                <tr key={img.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-sm text-primary">{img.id}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {img.tags && img.tags.length > 0 ? (
                        img.tags.map(t => (
                          <span key={t} className="px-2 py-1 bg-white/10 rounded text-xs font-medium text-primary">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-secondary italic">&lt;none&gt;</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-primary">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-orbit-500" />
                      {formatSize(img.size)}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => confirmDelete(img.id)}
                      className="p-2 text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Excluir Imagem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {images.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-secondary">Nenhuma imagem encontrada.</td>
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
        confirmText="Sim, excluir"
      />
    </div>
  );
}
