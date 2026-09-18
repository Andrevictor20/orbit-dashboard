import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  FileSidebar,
  FileToolbar,
  FileBreadcrumbs,
  FileModalsContainer,
  FileContentArea,
  useFileManagerOperations,
  useFileManagerNavigation,
  useFileManagerShortcuts,
  useFileManagerSelection,
} from '../components/files';
import type { OperationType } from '../components/files/FileOperationsModal';
import type { FileItem, MountItem, ShortcutPlace, TrashItem } from '../types/fileManager';
export type { FileItem, MountItem, ShortcutPlace, TrashItem };
export { IMAGE_EXTENSIONS, ARCHIVE_EXTENSIONS, CODE_EXTENSIONS } from '../types/fileManager';
import { isPhysicalStorage } from '../utils/format';
import { getAuthHeaders } from '../utils/auth';

export function FileManager() {
  const { t } = useTranslation();
  const nav = useFileManagerNavigation();
  const {
    urlPath,
    isTrashView,
    currentPath,
    setCurrentPath,
    history,
    historyIndex,
    isEditingPath,
    setIsEditingPath,
    manualPathInput,
    setManualPathInput,
    navigateTo,
    navigateToTrash,
    handleGoBack,
    handleGoForward,
    handleManualPathSubmit,
    currentFolderName,
    breadcrumbSegments,
  } = nav;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);

  // Clipboard for Copy / Cut
  const [clipboard, setClipboard] = useState<{
    action: 'copy' | 'cut';
    items: FileItem[];
  } | null>(null);

  // Storage drawer (mobile responsive)
  const [isStorageDrawerOpen, setIsStorageDrawerOpen] = useState<boolean>(false);

  // Dropdown menus
  const [showCreateMenu, setShowCreateMenu] = useState<boolean>(false);
  const [showSortMenu, setShowSortMenu] = useState<boolean>(false);

  // Shortcuts & Disks
  const [places, setPlaces] = useState<ShortcutPlace[]>([]);
  const [storages, setStorages] = useState<MountItem[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  // Modals & Preview States
  const [activeImageFile, setActiveImageFile] = useState<FileItem | null>(null);
  const [activeAudioFile, setActiveAudioFile] = useState<FileItem | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<FileItem | null>(null);
  const [activeTextFile, setActiveTextFile] = useState<FileItem | null>(null);
  const [activePdfFile, setActivePdfFile] = useState<FileItem | null>(null);
  const [isDiskAnalyzerOpen, setIsDiskAnalyzerOpen] = useState<boolean>(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [sambaModalOpen, setSambaModalOpen] = useState<boolean>(false);
  const [sambaTargetFolder, setSambaTargetFolder] = useState<FileItem | null>(null);

  // File Operations Modal (Rename, New File, New Folder, Delete)
  const [opModalType, setOpModalType] = useState<OperationType | null>(null);
  const [opTargetItem, setOpTargetItem] = useState<FileItem | null>(null);

  // File Upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Filter & Sort files
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        if (!showHiddenFiles && file.is_hidden) return false;
        if (!searchQuery) return true;
        return file.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        if (a.is_dir !== b.is_dir) return b.is_dir ? 1 : -1;
        let ord = 0;
        if (sortBy === 'size') {
          ord = a.size - b.size;
        } else if (sortBy === 'modified') {
          ord = (a.modified || '').localeCompare(b.modified || '');
        } else {
          ord = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        return sortAsc ? ord : -ord;
      });
  }, [files, showHiddenFiles, searchQuery, sortBy, sortAsc]);

  const { selectedItems, setSelectedItems, isSelected, toggleSelect, selectAll } =
    useFileManagerSelection(filteredFiles);

  const loadStorages = () => {
    fetch('/api/files/storages', {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.mounts && Array.isArray(data.mounts)) {
          const filtered = data.mounts.filter((m: MountItem) =>
            isPhysicalStorage(m.name, m.mount_point, m.fs_type, m.total_bytes)
          );
          setStorages(filtered);
        }
      })
      .catch(() => {});
  };

  const loadTrash = () => {
    setIsLoading(true);
    setLoadError(null);
    setSelectedItems([]);
    fetch('/api/files/trash', {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        setTrashItems(data.items || []);
        setIsLoading(false);
      })
      .catch(() => {
        setTrashItems([]);
        setIsLoading(false);
      });
  };

  // Fetch current folder files
  const loadFiles = (path: string) => {
    if (isTrashView) {
      loadTrash();
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    setSelectedItems([]);
    fetch(`/api/files/list?path=${encodeURIComponent(path)}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 404) {
          toast.error(t('files.dir_not_found', { path, defaultValue: `Diretório ${path} não encontrado.` }));
          const parent = path === '/' ? '/' : (path.substring(0, path.lastIndexOf('/')) || '/');
          navigateTo(parent);
          return null;
        }
        if (res.status === 401) {
          const msg = t('auth.session_expired', 'Sessão expirada. Faça login novamente.');
          toast.error(msg);
          setLoadError(msg);
          setIsLoading(false);
          return null;
        }
        if (!res.ok) {
          throw new Error(t('files.failed_list_files', 'Não foi possível listar arquivos'));
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setFiles(data.items || []);
        if (data.current_path && data.current_path !== currentPath) {
          setCurrentPath(data.current_path);
        }
        setLoadError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        const msg = err?.message || t('files.network_load_error', 'Erro ao carregar arquivos da pasta.');
        toast.error(msg);
        setLoadError(msg);
        setIsLoading(false);
      });
  };

  const ops = useFileManagerOperations({
    currentPath,
    loadFiles,
    loadTrash,
    navigateTo,
    fileInputRef,
    folderInputRef,
    selectedItems,
    setSelectedItems,
    clipboard,
    setClipboard,
    setActiveImageFile,
    setActiveAudioFile,
    setActiveVideoFile,
    setActivePdfFile,
    setActiveTextFile,
    setIsDraggingOver,
  });

  // Sync with URL query parameter
  useEffect(() => {
    if (urlPath === '__trash__' || isTrashView) {
      loadTrash();
    }
  }, [urlPath, isTrashView]);

  // Load shortcuts and storages once
  useEffect(() => {
    fetch('/api/files/shortcuts', {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (Array.isArray(data.places) && data.places.length > 0) {
            setPlaces(data.places);
          }
          if (Array.isArray(data.mounts)) {
            const filtered = data.mounts.filter((m: MountItem) =>
              isPhysicalStorage(m.name, m.mount_point, m.fs_type, m.total_bytes)
            );
            setStorages(filtered);
          }
        }
      })
      .catch(() => {});

    loadStorages();
  }, []);

  // Reload files when path changes
  useEffect(() => {
    if (isTrashView) {
      loadTrash();
    } else {
      loadFiles(currentPath);
    }
  }, [currentPath, isTrashView]);


  // Listen for upload completion events to refresh folder listing
  useEffect(() => {
    const handleFilesChanged = (e: any) => {
      if (e?.detail?.path === currentPath || !e?.detail?.path) {
        loadFiles(currentPath);
      }
    };
    window.addEventListener('saturn:files_changed', handleFilesChanged);
    return () => window.removeEventListener('saturn:files_changed', handleFilesChanged);
  }, [currentPath]);


  const hasActiveModal = Boolean(
    activeImageFile ||
    activeAudioFile ||
    activeVideoFile ||
    activeTextFile ||
    activePdfFile ||
    isDiskAnalyzerOpen ||
    shareFile ||
    sambaModalOpen ||
    opModalType
  );

  useFileManagerShortcuts({
    currentPath,
    selectedItems,
    hasActiveModal,
    handleGoBack,
    handleGoForward,
    loadFiles,
    selectAll,
    handleMoveToTrash: ops.handleMoveToTrash,
  });

  // Primary Storage Capacity calculation
  const primaryStorage = useMemo(() => {
    if (storages.length === 0) return null;
    return storages.find(s => s.mount_point === '/' || currentPath.startsWith(s.mount_point)) || storages[0];
  }, [storages, currentPath]);

  return (
    <div 
      className="flex flex-col h-[calc(100vh-5.5rem)] w-full rounded-3xl overflow-hidden border border-border/80 bg-card text-primary shadow-2xl relative"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={ops.handleDrop}
    >
      {/* Hidden file & folder inputs for uploads */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={ops.handleFileUpload}
        className="hidden"
      />
      <input
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory=""
        directory=""
        ref={folderInputRef}
        onChange={ops.handleFolderUpload}
        className="hidden"
      />

      {/* MOBILE BACKDROP DRAWER OVERLAY */}
      {isStorageDrawerOpen && (
        <div 
          onClick={() => setIsStorageDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* BODY SPLIT: SIDEBAR + MAIN AREA */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* SIDEBAR */}
        <FileSidebar
          isStorageDrawerOpen={isStorageDrawerOpen}
          setIsStorageDrawerOpen={setIsStorageDrawerOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          places={places}
          currentPath={currentPath}
          isTrashView={isTrashView}
          navigateTo={navigateTo}
          navigateToTrash={navigateToTrash}
          handleInternalDrop={ops.handleInternalDrop}
          trashItems={trashItems}
          storages={storages}
          showHiddenFiles={showHiddenFiles}
          setShowHiddenFiles={setShowHiddenFiles}
          loadFiles={loadFiles}
        />

        {/* MAIN VIEWPORT */}
        <main className="flex-1 flex flex-col min-w-0 bg-background/30 overflow-hidden relative">
          {/* Top Navigation Bar & Batch Actions */}
          <FileToolbar
            setIsStorageDrawerOpen={setIsStorageDrawerOpen}
            handleGoBack={handleGoBack}
            historyIndex={historyIndex}
            handleGoForward={handleGoForward}
            historyLength={history.length}
            currentFolderName={currentFolderName}
            isTrashView={isTrashView}
            filteredFilesCount={filteredFiles.length}
            showCreateMenu={showCreateMenu}
            setShowCreateMenu={setShowCreateMenu}
            setOpTargetItem={setOpTargetItem}
            setOpModalType={setOpModalType}
            currentPath={currentPath}
            loadFiles={loadFiles}
            fileInputRef={fileInputRef}
            clipboard={clipboard}
            handlePaste={ops.handlePaste}
            showSortMenu={showSortMenu}
            setShowSortMenu={setShowSortMenu}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortAsc={sortAsc}
            setSortAsc={setSortAsc}
            viewMode={viewMode}
            setViewMode={setViewMode}
            handleEmptyTrash={ops.handleEmptyTrash}
            trashItemsCount={trashItems.length}
            selectedItems={selectedItems}
            selectAll={selectAll}
            handleCompressSelection={ops.handleCompressSelection}
            handleCopy={ops.handleCopy}
            handleCut={ops.handleCut}
            handleMoveToTrash={ops.handleMoveToTrash}
            setSelectedItems={setSelectedItems}
            onOpenSamba={() => {
              setSambaTargetFolder(null);
              setSambaModalOpen(true);
            }}
          />

          {/* Drag & Drop Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-4 z-40 border-2 border-dashed border-saturn-500 bg-saturn-500/10 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none animate-in fade-in">
              <div className="w-12 h-12 text-saturn-400 animate-bounce" />
              <p className="font-semibold text-primary text-base">{t('files.drop_files_here', 'Solte os arquivos aqui para carregar')}</p>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative scrollbar-thin">
            <FileContentArea
              isLoading={isLoading}
              loadError={loadError}
              onRetry={() => loadFiles(currentPath)}
              isTrashView={isTrashView}
              filteredFiles={filteredFiles}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              fileInputRef={fileInputRef}
              trashItems={trashItems}
              handleRestoreTrash={ops.handleRestoreTrash}
              viewMode={viewMode}
              selectedItems={selectedItems}
              isSelected={isSelected}
              toggleSelect={toggleSelect}
              selectAll={selectAll}
              handleItemClick={ops.handleItemClick}
              handleInternalDrop={ops.handleInternalDrop}
              setShareFile={setShareFile}
              handleExtractArchive={ops.handleExtractArchive}
              handleDownload={ops.handleDownload}
              setOpTargetItem={setOpTargetItem}
              setOpModalType={setOpModalType}
              onShareSamba={(folder) => {
                setSambaTargetFolder(folder);
                setSambaModalOpen(true);
              }}
            />
          </div>

          {/* BOTTOM BAR: PATH BREADCRUMB & CAPACITY VIEW */}
          <FileBreadcrumbs
            manualPathInput={manualPathInput}
            setManualPathInput={setManualPathInput}
            isEditingPath={isEditingPath}
            setIsEditingPath={setIsEditingPath}
            handleManualPathSubmit={handleManualPathSubmit}
            currentPath={currentPath}
            breadcrumbs={breadcrumbSegments()}
            navigateTo={navigateTo}
            navigateToTrash={navigateToTrash}
            primaryStorage={primaryStorage}
          />
        </main>
      </div>

      {/* MODALS */}
      <FileModalsContainer
        activeImageFile={activeImageFile}
        setActiveImageFile={setActiveImageFile}
        files={files}
        activeAudioFile={activeAudioFile}
        setActiveAudioFile={setActiveAudioFile}
        activeVideoFile={activeVideoFile}
        setActiveVideoFile={setActiveVideoFile}
        activeTextFile={activeTextFile}
        setActiveTextFile={setActiveTextFile}
        activePdfFile={activePdfFile}
        setActivePdfFile={setActivePdfFile}
        isDiskAnalyzerOpen={isDiskAnalyzerOpen}
        setIsDiskAnalyzerOpen={setIsDiskAnalyzerOpen}
        shareFile={shareFile}
        setShareFile={setShareFile}
        sambaModalOpen={sambaModalOpen}
        setSambaModalOpen={setSambaModalOpen}
        sambaTargetFolder={sambaTargetFolder}
        setSambaTargetFolder={setSambaTargetFolder}
        opModalType={opModalType}
        setOpModalType={setOpModalType}
        opTargetItem={opTargetItem}
        setOpTargetItem={setOpTargetItem}
        selectedItems={selectedItems}
        currentPath={currentPath}
        loadFiles={loadFiles}
        navigateTo={navigateTo}
      />
    </div>
  );
}

export default FileManager;
