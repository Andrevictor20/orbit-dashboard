import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  FolderPlus, 
  FilePlus, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  Check 
} from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

export type OperationType = 'new_folder' | 'new_file' | 'rename' | 'delete';

interface FileOperationsModalProps {
  type: OperationType | null;
  currentPath: string;
  targetItem?: FileItem | null;
  selectedItems?: FileItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FileOperationsModal({
  type,
  currentPath,
  targetItem,
  selectedItems = [],
  isOpen,
  onClose,
  onSuccess,
}: FileOperationsModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setError(null);
      return;
    }

    if (type === 'rename' && targetItem) {
      setName(targetItem.name);
    } else {
      setName('');
    }
  }, [isOpen, type, targetItem]);

  if (!isOpen || !type) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (type === 'new_folder') {
        const fullPath = `${currentPath === '/' ? '' : currentPath}/${name.trim()}`;
        const res = await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
        });
        if (!res.ok) throw new Error('Não foi possível criar a pasta');
      } else if (type === 'new_file') {
        const fullPath = `${currentPath === '/' ? '' : currentPath}/${name.trim()}`;
        const res = await fetch('/api/files/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
        });
        if (!res.ok) throw new Error('Não foi possível criar o arquivo');
      } else if (type === 'rename' && targetItem) {
        const parent = targetItem.path.substring(0, targetItem.path.lastIndexOf('/')) || '/';
        const newPath = `${parent === '/' ? '' : parent}/${name.trim()}`;
        const res = await fetch('/api/files/rename', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_path: targetItem.path,
            new_path: newPath,
          }),
        });
        if (!res.ok) throw new Error('Não foi possível renomear');
      } else if (type === 'delete') {
        const pathsToDelete = selectedItems.length > 0
          ? selectedItems.map(i => i.path)
          : targetItem
          ? [targetItem.path]
          : [];

        const res = await fetch('/api/files/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: pathsToDelete }),
        });
        if (!res.ok) throw new Error('Não foi possível excluir os itens');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar operação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'new_folder': return 'Nova Pasta';
      case 'new_file': return 'Novo Arquivo';
      case 'rename': return 'Renomear Item';
      case 'delete': return 'Excluir Item(s)';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'new_folder':
        return <FolderPlus className="w-5 h-5 text-orbit-400" />;
      case 'new_file':
        return <FilePlus className="w-5 h-5 text-orbit-400" />;
      case 'rename':
        return <Edit3 className="w-5 h-5 text-orbit-400" />;
      case 'delete':
        return <Trash2 className="w-5 h-5 text-rose-400" />;
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${type === 'delete' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-orbit-500/10 border-orbit-500/20'}`}>
              {getIcon()}
            </div>
            <h3 className="font-semibold text-primary text-base">{getTitle()}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'delete' ? (
            <div className="space-y-2 py-1">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>
                  Esta ação não pode ser desfeita. Todos os arquivos e subpastas selecionados serão permanentemente removidos.
                </p>
              </div>
              <p className="text-sm text-secondary px-1">
                Tem certeza que deseja excluir <strong>{selectedItems.length > 0 ? `${selectedItems.length} itens` : targetItem?.name}</strong>?
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                {type === 'new_folder' ? 'Nome da Pasta' : type === 'new_file' ? 'Nome do Arquivo' : 'Novo Nome'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'new_file' ? 'exemplo.txt' : 'Nome do item'}
                autoFocus
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (type !== 'delete' && !name.trim())}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white transition-all active:scale-95 shadow-md disabled:opacity-50 ${
                type === 'delete'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                  : 'bg-orbit-500 hover:bg-orbit-600 shadow-orbit-500/25'
              }`}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{type === 'delete' ? 'Excluir' : 'Confirmar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}
