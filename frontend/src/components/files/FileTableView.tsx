import React from 'react';
import { CheckSquare, Square, Share2, Archive, Download, Edit3 } from 'lucide-react';
import type { FileItem } from '../../types/fileManager';
import { ARCHIVE_EXTENSIONS } from '../../types/fileManager';
import { formatBytes } from '../../utils/format';
import { FileBadgeVisual } from './FileBadgeVisual';
import type { OperationType } from './FileOperationsModal';

export interface FileTableViewProps {
  files: FileItem[];
  selectedItems: FileItem[];
  selectAll: () => void;
  isSelected: (item: FileItem) => boolean;
  toggleSelect: (e: React.MouseEvent, item: FileItem) => void;
  handleItemClick: (item: FileItem) => void;
  handleInternalDrop: (e: React.DragEvent, targetPath: string) => void;
  setShareFile: (item: FileItem | null) => void;
  handleExtractArchive: (item: FileItem) => void;
  handleDownload: (item: FileItem) => void;
  setOpTargetItem: (item: FileItem | null) => void;
  setOpModalType: (type: OperationType | null) => void;
}

export const FileTableView: React.FC<FileTableViewProps> = ({
  files,
  selectedItems,
  selectAll,
  isSelected,
  toggleSelect,
  handleItemClick,
  handleInternalDrop,
  setShareFile,
  handleExtractArchive,
  handleDownload,
  setOpTargetItem,
  setOpModalType,
}) => {
  return (
    <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 text-secondary border-b border-border/80 select-none font-semibold">
            <tr>
              <th className="py-3 px-4 w-8">
                <button onClick={selectAll} className="p-0.5 rounded hover:bg-accent">
                  {selectedItems.length === files.length && files.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-orbit-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-secondary" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 font-bold">Nome</th>
              <th className="py-3 px-4 font-bold">Tamanho</th>
              <th className="py-3 px-4 font-bold hidden sm:table-cell">Modificado</th>
              <th className="py-3 px-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {files.map((item) => {
              const selected = isSelected(item);
              const isArchive = ARCHIVE_EXTENSIONS.includes(item.extension.toLowerCase());
              return (
                <tr
                  key={item.path}
                  draggable={true}
                  onDragStart={(e) => {
                    const list = selectedItems.length > 0 ? selectedItems.map(i => i.path) : [item.path];
                    e.dataTransfer.setData('text/plain', JSON.stringify(list));
                  }}
                  onDragOver={(e) => {
                    if (item.is_dir) {
                      e.preventDefault();
                      e.currentTarget.classList.add('bg-orbit-500/10');
                    }
                  }}
                  onDragLeave={(e) => {
                    if (item.is_dir) e.currentTarget.classList.remove('bg-orbit-500/10');
                  }}
                  onDrop={(e) => {
                    if (item.is_dir) {
                      e.currentTarget.classList.remove('bg-orbit-500/10');
                      handleInternalDrop(e, item.path);
                    }
                  }}
                  onClick={() => handleItemClick(item)}
                  className={`hover:bg-accent/60 transition-colors cursor-pointer ${
                    selected ? 'bg-orbit-500/10' : ''
                  } ${item.is_hidden ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  <td className="py-2.5 px-4" onClick={(e) => toggleSelect(e, item)}>
                    <button className="p-0.5 rounded">
                      {selected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-orbit-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-secondary opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </td>
                  <td className="py-2.5 px-4 flex items-center gap-2.5">
                    <div className="shrink-0 scale-75 origin-left">
                      <FileBadgeVisual item={item} />
                    </div>
                    <span className="font-semibold text-primary truncate max-w-[180px] xs:max-w-xs md:max-w-md">
                      {item.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-secondary font-mono whitespace-nowrap">
                    {item.is_dir ? '-' : formatBytes(item.size)}
                  </td>
                  <td className="py-2.5 px-4 text-secondary font-mono whitespace-nowrap hidden sm:table-cell">
                    {item.modified ? new Date(item.modified).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareFile(item);
                        }}
                        className="p-1 rounded-lg text-secondary hover:text-violet-400 hover:bg-accent"
                        title="Compartilhar"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      {isArchive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExtractArchive(item);
                          }}
                          className="p-1 rounded-lg text-secondary hover:text-amber-400 hover:bg-accent"
                          title="Extrair"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpTargetItem(item);
                          setOpModalType('rename');
                        }}
                        className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent"
                        title="Renomear"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
