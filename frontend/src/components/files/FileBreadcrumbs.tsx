import React from 'react';
import { Edit3, X } from 'lucide-react';
import type { MountItem } from '../../types/fileManager';
import { formatStorage } from '../../utils/format';

export interface FileBreadcrumbsProps {
  manualPathInput: string;
  setManualPathInput: (path: string) => void;
  isEditingPath: boolean;
  setIsEditingPath: React.Dispatch<React.SetStateAction<boolean>>;
  handleManualPathSubmit: (e: React.FormEvent) => void;
  currentPath: string;
  breadcrumbs: Array<{ label: string; path: string }>;
  navigateTo: (path: string) => void;
  navigateToTrash: () => void;
  primaryStorage: MountItem | null;
}

export const FileBreadcrumbs: React.FC<FileBreadcrumbsProps> = ({
  manualPathInput,
  setManualPathInput,
  isEditingPath,
  setIsEditingPath,
  handleManualPathSubmit,
  currentPath,
  breadcrumbs,
  navigateTo,
  navigateToTrash,
  primaryStorage,
}) => {
  return (
    <footer className="py-2 px-4 sm:px-6 border-t border-border/70 bg-card/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
      {/* Left: Path View & Edit */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={() => {
            setManualPathInput(currentPath);
            setIsEditingPath((prev) => !prev);
          }}
          className={`p-1 rounded-md transition-colors ${
            isEditingPath ? 'bg-orbit-500 text-white' : 'text-secondary hover:text-primary hover:bg-accent'
          }`}
          title="Editar caminho manualmente"
        >
          <Edit3 className="w-3 h-3" />
        </button>

        {isEditingPath ? (
          <form onSubmit={handleManualPathSubmit} className="flex-1 max-w-md flex items-center gap-1.5">
            <input
              type="text"
              value={manualPathInput}
              onChange={(e) => setManualPathInput(e.target.value)}
              className="w-full px-2.5 py-1 rounded-lg bg-background border border-orbit-500 text-xs text-primary focus:outline-none shadow-sm"
              autoFocus
            />
            <button type="submit" className="px-2 py-1 rounded-lg bg-orbit-500 text-white text-xs font-semibold shadow-sm">
              Ir
            </button>
            <button 
              type="button" 
              onClick={() => setIsEditingPath(false)}
              className="p-1 rounded-lg text-secondary hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto text-xs text-secondary font-mono scrollbar-none truncate">
            {breadcrumbs.map((crumb, idx, arr) => (
              <React.Fragment key={crumb.path}>
                <button
                  onClick={() => (crumb.path === '__trash__' ? navigateToTrash() : navigateTo(crumb.path))}
                  className={`hover:text-orbit-400 transition-colors truncate ${
                    idx === arr.length - 1 ? 'text-primary font-bold' : ''
                  }`}
                >
                  {crumb.label}
                </button>
                {idx < arr.length - 1 && (
                  <span className="text-secondary/50">/</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right: Storage Capacity View */}
      {primaryStorage && primaryStorage.total_bytes > 0 && (
        <div className="flex items-center gap-2.5 text-secondary font-mono text-[11px] shrink-0 bg-accent/60 px-3 py-1 rounded-xl border border-border/70 shadow-sm">
          <div className="w-16 sm:w-24 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-orbit-500 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  Math.round((primaryStorage.used_bytes / primaryStorage.total_bytes) * 100),
                  100
                )}%`
              }}
            />
          </div>
          <span>
            <strong className="text-primary">
              {formatStorage(primaryStorage.available_bytes || (primaryStorage.total_bytes - primaryStorage.used_bytes), 1)}
            </strong>
            {' '}Disponível / {formatStorage(primaryStorage.total_bytes, 1)}
          </span>
        </div>
      )}
    </footer>
  );
};
