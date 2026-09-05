import React from 'react';
import { Trash2, Folder, File, RotateCcw } from 'lucide-react';
import type { TrashItem } from '../../types/fileManager';
import { formatBytes } from '../../utils/format';

export interface FileTrashViewProps {
  trashItems: TrashItem[];
  handleRestoreTrash: (ids: string[]) => void;
}

export const FileTrashView: React.FC<FileTrashViewProps> = ({
  trashItems,
  handleRestoreTrash,
}) => {
  if (trashItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
        <Trash2 className="w-14 h-14 stroke-[1.5] text-zinc-600" />
        <p className="text-base font-semibold text-primary">A Lixeira está vazia</p>
        <p className="text-xs text-secondary max-w-sm text-center">
          Os itens excluídos aparecerão aqui e poderão ser restaurados a qualquer momento.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card/60 border border-border rounded-2xl overflow-hidden shadow-md">
      <table className="w-full text-left text-xs">
        <thead className="bg-accent/40 text-secondary border-b border-border select-none font-semibold">
          <tr>
            <th className="py-3 px-4 font-bold">Nome</th>
            <th className="py-3 px-4 font-bold">Local Original</th>
            <th className="py-3 px-4 font-bold">Tamanho</th>
            <th className="py-3 px-4 font-bold text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trashItems.map((item) => (
            <tr key={item.id} className="hover:bg-accent/50 transition-colors">
              <td className="py-2.5 px-4 flex items-center gap-2.5">
                {item.is_dir ? <Folder className="w-4 h-4 text-sky-400" /> : <File className="w-4 h-4 text-zinc-400" />}
                <span className="font-semibold text-primary truncate max-w-xs">{item.name}</span>
              </td>
              <td className="py-2.5 px-4 text-secondary font-mono truncate max-w-xs">{item.original_path}</td>
              <td className="py-2.5 px-4 text-secondary font-mono">{formatBytes(item.size)}</td>
              <td className="py-2.5 px-4 text-right">
                <button
                  onClick={() => handleRestoreTrash([item.id])}
                  className="px-3 py-1.5 rounded-lg bg-orbit-500/15 text-orbit-400 hover:bg-orbit-500/25 border border-orbit-500/30 transition-colors font-medium flex items-center gap-1.5 ml-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
