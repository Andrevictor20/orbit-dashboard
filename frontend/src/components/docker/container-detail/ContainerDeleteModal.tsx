import { ConfirmModal } from '../../ui/ConfirmModal';

interface DeleteOptions {
  volumes: boolean;
  image: boolean;
  network: boolean;
}

interface ContainerDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  containerName: string;
  deleteOptions: DeleteOptions;
  setDeleteOptions: React.Dispatch<React.SetStateAction<DeleteOptions>>;
  onConfirm: () => void;
}

export function ContainerDeleteModal({
  isOpen,
  onClose,
  containerName,
  deleteOptions,
  setDeleteOptions,
  onConfirm,
}: ContainerDeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      title="Excluir Container"
      message={`Tem certeza que deseja excluir permanentemente o container ${containerName}?`}
      onConfirm={onConfirm}
      isDestructive={true}
      confirmText="Sim, excluir"
    >
      <div className="bg-black/20 p-4 rounded-lg border border-border/50">
        <p className="text-sm text-primary font-medium mb-3">Opções de exclusão em cascata:</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer pb-2 mb-2 border-b border-border/50">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
              checked={deleteOptions.volumes && deleteOptions.image && deleteOptions.network}
              onChange={(e) => {
                const checked = e.target.checked;
                setDeleteOptions({ volumes: checked, image: checked, network: checked });
              }}
            />
            <span className="text-sm font-semibold text-primary">Selecionar tudo</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
              checked={deleteOptions.volumes}
              onChange={(e) => setDeleteOptions(prev => ({ ...prev, volumes: e.target.checked }))}
            />
            <span className="text-sm text-secondary">Excluir volumes anônimos associados</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
              checked={deleteOptions.image}
              onChange={(e) => setDeleteOptions(prev => ({ ...prev, image: e.target.checked }))}
            />
            <span className="text-sm text-secondary">Excluir imagem do container</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
              checked={deleteOptions.network}
              onChange={(e) => setDeleteOptions(prev => ({ ...prev, network: e.target.checked }))}
            />
            <span className="text-sm text-secondary">Excluir redes exclusivas do container</span>
          </label>
        </div>
      </div>
    </ConfirmModal>
  );
}
