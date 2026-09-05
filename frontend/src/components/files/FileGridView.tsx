import React from 'react';
import { Check, Share2, Archive, Download, Edit3 } from 'lucide-react';
import type { FileItem } from '../../types/fileManager';
import { ARCHIVE_EXTENSIONS } from '../../types/fileManager';
import { formatBytes } from '../../utils/format';
import { FileBadgeVisual } from './FileBadgeVisual';
import type { OperationType } from './FileOperationsModal';

export interface FileGridViewProps {
  files: FileItem[];
  selectedItems: FileItem[];
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

export const FileGridView: React.FC<FileGridViewProps> = ({
  files,
  selectedItems,
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
      {files.map((item) => {
        const selected = isSelected(item);
        const isArchive = ARCHIVE_EXTENSIONS.includes(item.extension.toLowerCase());

        return (
          <div
            key={item.path}
            draggable={true}
            onDragStart={(e) => {
              const list = selectedItems.length > 0 ? selectedItems.map(i => i.path) : [item.path];
              e.dataTransfer.setData('text/plain', JSON.stringify(list));
            }}
            onDragOver={(e) => {
              if (item.is_dir) {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-orbit-500');
              }
            }}
            onDragLeave={(e) => {
              if (item.is_dir) e.currentTarget.classList.remove('ring-2', 'ring-orbit-500');
            }}
            onDrop={(e) => {
              if (item.is_dir) {
                e.currentTarget.classList.remove('ring-2', 'ring-orbit-500');
                handleInternalDrop(e, item.path);
              }
            }}
            onClick={() => handleItemClick(item)}
            className={`group relative flex flex-col items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              selected
                ? 'bg-orbit-500/15 border-orbit-500/50 ring-2 ring-orbit-500/30 shadow-lg'
                : item.is_hidden
                ? 'bg-card/70 border-border/60 opacity-60 hover:opacity-100 hover:bg-accent/60 hover:border-border'
                : 'bg-card border-border/70 hover:bg-accent/70 hover:border-orbit-500/40 hover:shadow-md hover:-translate-y-0.5 shadow-sm'
            }`}
          >
            {/* Selection Checkbox */}
            <button
              onClick={(e) => toggleSelect(e, item)}
              className={`absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                selected
                  ? 'bg-orbit-500 border-orbit-500 text-white'
                  : 'border-border bg-card/90 opacity-0 group-hover:opacity-100 text-transparent hover:border-orbit-400'
              }`}
              title={selected ? 'Desmarcar' : 'Selecionar'}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>

            {/* Item Visual Graphic */}
            <div className="my-2.5 flex items-center justify-center">
              <FileBadgeVisual item={item} />
            </div>

            {/* Item Metadata */}
            <div className="w-full text-center min-w-0">
              <span 
                className="block text-xs font-semibold text-primary truncate px-1 group-hover:text-orbit-400 transition-colors"
                title={item.name}
              >
                {item.name}
              </span>
              <span className="text-[10px] text-secondary font-mono block mt-0.5">
                {item.is_dir ? (
                  item.modified ? new Date(item.modified).toLocaleDateString() : 'Pasta'
                ) : (
                  formatBytes(item.size)
                )}
              </span>
            </div>

            {/* Quick Action Overlay on hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card/95 backdrop-blur-md rounded-lg p-0.5 shadow-md border border-border/80 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShareFile(item);
                }}
                className="p-1 rounded text-secondary hover:text-violet-400 hover:bg-accent"
                title="Compartilhar"
              >
                <Share2 className="w-3 h-3" />
              </button>
              {isArchive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExtractArchive(item);
                  }}
                  className="p-1 rounded text-secondary hover:text-amber-400 hover:bg-accent"
                  title="Extrair Arquivo"
                >
                  <Archive className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(item);
                }}
                className="p-1 rounded text-secondary hover:text-primary hover:bg-accent"
                title="Download"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpTargetItem(item);
                  setOpModalType('rename');
                }}
                className="p-1 rounded text-secondary hover:text-primary hover:bg-accent"
                title="Renomear"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
