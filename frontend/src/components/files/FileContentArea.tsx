import React from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  FileGridView,
  FileTableView,
  FileTrashView,
} from './';
import type { FileItem, TrashItem } from '../../types/fileManager';
import type { OperationType } from './FileOperationsModal';

interface FileContentAreaProps {
  isLoading: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  isTrashView: boolean;
  filteredFiles: FileItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  trashItems: TrashItem[];
  handleRestoreTrash: (ids: string[]) => void;
  viewMode: 'grid' | 'list';
  selectedItems: FileItem[];
  isSelected: (item: FileItem) => boolean;
  toggleSelect: (e: React.MouseEvent, item: FileItem) => void;
  selectAll: () => void;
  handleItemClick: (item: FileItem) => void;
  handleInternalDrop: (e: React.DragEvent, targetDestination: string) => void;
  setShareFile: (item: FileItem | null) => void;
  handleExtractArchive: (item: FileItem) => void;
  handleDownload: (item: FileItem) => void;
  setOpTargetItem: (item: FileItem | null) => void;
  setOpModalType: (type: OperationType | null) => void;
  onShareSamba: (folder: FileItem) => void;
}

export function FileContentArea({
  isLoading,
  loadError,
  onRetry,
  isTrashView,
  filteredFiles,
  searchQuery,
  setSearchQuery,
  fileInputRef,
  trashItems,
  handleRestoreTrash,
  viewMode,
  selectedItems,
  isSelected,
  toggleSelect,
  selectAll,
  handleItemClick,
  handleInternalDrop,
  setShareFile,
  handleExtractArchive,
  handleDownload,
  setOpTargetItem,
  setOpModalType,
  onShareSamba,
}: FileContentAreaProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
        <Loader2 className="w-9 h-9 animate-spin text-saturn-400" />
        <span className="text-xs font-medium">{t('files.loading_content', 'Carregando arquivos...')}</span>
      </div>
    );
  }

  if (isTrashView) {
    return (
      <FileTrashView
        trashItems={trashItems}
        handleRestoreTrash={handleRestoreTrash}
      />
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20 animate-in fade-in">
        <AlertCircle className="w-14 h-14 stroke-[1.5] text-rose-500" />
        <p className="text-base font-semibold text-primary">{t('files.error_loading_dir', 'Erro ao carregar pasta')}</p>
        <p className="text-xs text-secondary max-w-sm text-center">
          {loadError}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-saturn-500 hover:bg-saturn-600 text-white text-xs font-semibold transition-colors shadow-md shadow-saturn-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry', 'Tentar novamente')}
          </button>
        )}
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
        {searchQuery ? (
          <>
            <Search className="w-12 h-12 stroke-[1.5] text-zinc-600" />
            <p className="text-sm font-semibold text-primary">{t('files.no_files_found_query', 'Nenhum arquivo encontrado para "{{query}}"', { query: searchQuery })}</p>
            <button
              data-testid="clear-search-btn"
              onClick={() => setSearchQuery('')}
              className="px-3 py-1.5 rounded-xl bg-saturn-500/15 text-saturn-400 border border-saturn-500/30 text-xs font-semibold hover:bg-saturn-500/25 transition-colors"
            >
              {t('files.clear_search', 'Limpar pesquisa')}
            </button>
          </>
        ) : (
          <>
            <Folder className="w-14 h-14 stroke-[1.5] text-zinc-600" />
            <p className="text-base font-semibold text-primary">{t('files.folder_empty', 'Esta pasta está vazia')}</p>
            <p className="text-xs text-secondary max-w-sm text-center">
              {t('files.drag_drop_import_hint', 'Arraste e solte arquivos aqui ou use o botão Importar para começar.')}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-4 py-2 rounded-xl bg-saturn-500 text-white text-xs font-semibold hover:bg-saturn-600 transition-colors shadow-md shadow-saturn-500/20"
            >
              {t('files.upload_file', 'Carregar arquivos')}
            </button>
          </>
        )}
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <FileGridView
        files={filteredFiles}
        selectedItems={selectedItems}
        isSelected={isSelected}
        toggleSelect={toggleSelect}
        handleItemClick={handleItemClick}
        handleInternalDrop={handleInternalDrop}
        setShareFile={setShareFile}
        handleExtractArchive={handleExtractArchive}
        handleDownload={handleDownload}
        setOpTargetItem={setOpTargetItem}
        setOpModalType={setOpModalType}
        onShareSamba={onShareSamba}
      />
    );
  }

  return (
    <FileTableView
      files={filteredFiles}
      selectedItems={selectedItems}
      selectAll={selectAll}
      isSelected={isSelected}
      toggleSelect={toggleSelect}
      handleItemClick={handleItemClick}
      handleInternalDrop={handleInternalDrop}
      setShareFile={setShareFile}
      handleExtractArchive={handleExtractArchive}
      handleDownload={handleDownload}
      setOpTargetItem={setOpTargetItem}
      setOpModalType={setOpModalType}
      onShareSamba={onShareSamba}
    />
  );
}
