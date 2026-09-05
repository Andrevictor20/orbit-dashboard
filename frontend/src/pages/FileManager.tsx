import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Folder, 
  Upload, 
  Search, 
  Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  FileSidebar,
  FileToolbar,
  FileBreadcrumbs,
  FileGridView,
  FileTableView,
  FileTrashView,
  AudioPlayerModal,
  VideoPlayerModal,
  TextEditorModal,
  PdfViewerModal,
  ImageGalleryModal,
  DiskAnalyzerModal,
  ShareModal,
  CloudConnectModal,
  FileOperationsModal,
} from '../components/files';
import type { OperationType } from '../components/files/FileOperationsModal';
import type { FileItem, MountItem, CloudAccount, ShortcutPlace, TrashItem } from '../types/fileManager';
export type { FileItem, MountItem, CloudAccount, ShortcutPlace, TrashItem };
export { IMAGE_EXTENSIONS, ARCHIVE_EXTENSIONS, CODE_EXTENSIONS } from '../types/fileManager';
import { useTasks } from '../contexts/InstallContext';
import { isPhysicalStorage, formatBytes } from '../utils/format';

export function FileManager() {
  const { t } = useTranslation();
  const { startTask } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPath = searchParams.get('path');
  const isTrashView = urlPath === '__trash__';
  const [currentPath, setCurrentPath] = useState<string>(isTrashView ? '/' : (urlPath || '/'));
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);

  // History navigation stack
  const [history, setHistory] = useState<string[]>([currentPath]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

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
  const [showLocationMenu, setShowLocationMenu] = useState<boolean>(false);

  // Manual path editing
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [manualPathInput, setManualPathInput] = useState<string>(currentPath);

  // Shortcuts & Disks
  const [places, setPlaces] = useState<ShortcutPlace[]>([]);
  const [storages, setStorages] = useState<MountItem[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  // Modals & Preview States
  const [activeImageFile, setActiveImageFile] = useState<FileItem | null>(null);
  const [activeAudioFile, setActiveAudioFile] = useState<FileItem | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<FileItem | null>(null);
  const [activeTextFile, setActiveTextFile] = useState<FileItem | null>(null);
  const [activePdfFile, setActivePdfFile] = useState<FileItem | null>(null);
  const [isDiskAnalyzerOpen, setIsDiskAnalyzerOpen] = useState<boolean>(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);

  // File Operations Modal (Rename, New File, New Folder, Delete)
  const [opModalType, setOpModalType] = useState<OperationType | null>(null);
  const [opTargetItem, setOpTargetItem] = useState<FileItem | null>(null);

  // File Upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const loadStoragesAndCloud = () => {
    fetch('/api/files/storages')
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

    fetch('/api/files/cloud/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.accounts && Array.isArray(data.accounts)) setCloudAccounts(data.accounts);
      })
      .catch(() => {});
  };

  const loadTrash = () => {
    setIsLoading(true);
    setSelectedItems([]);
    fetch('/api/files/trash')
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
    setSelectedItems([]);
    fetch(`/api/files/list?path=${encodeURIComponent(path)}`)
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível listar arquivos');
        return res.json();
      })
      .then(data => {
        setFiles(data.items || []);
        if (data.current_path && data.current_path !== currentPath) {
          setCurrentPath(data.current_path);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (path !== '/') {
          toast.error(`Diretório ${path} não encontrado. Retornando para a raiz.`);
          navigateTo('/');
        } else {
          setFiles([]);
          setIsLoading(false);
        }
      });
  };

  const handleDisconnectCloud = async (id: string, name: string) => {
    if (!window.confirm(`Deseja desconectar "${name}"?`)) return;
    try {
      const res = await fetch(`/api/files/cloud/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${name}" desconectado com sucesso.`);
        loadStoragesAndCloud();
        if (currentPath.includes(id)) {
          navigateTo(places[0]?.path || '/');
        }
      }
    } catch {
      toast.error('Erro ao desconectar conta');
    }
  };

  // Sync with URL query parameter
  useEffect(() => {
    if (urlPath === '__trash__' || isTrashView) {
      loadTrash();
    } else if (urlPath && urlPath !== currentPath) {
      setCurrentPath(urlPath);
    }
  }, [urlPath]);

  // Load shortcuts, storages and cloud accounts once
  useEffect(() => {
    fetch('/api/files/shortcuts')
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

    loadStoragesAndCloud();
  }, []);

  // Reload files when path changes
  useEffect(() => {
    if (isTrashView) {
      loadTrash();
    } else {
      loadFiles(currentPath);
    }
  }, [currentPath, isTrashView]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input or modal
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        handleGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        handleGoForward();
      } else if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        loadFiles(currentPath);
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        handleMoveToTrash(selectedItems);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, currentPath, selectedItems, files]);

  // Upload handler via Task System
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const formData = new FormData();
    filesArray.forEach((f) => formData.append('files', f));

    startTask({
      type: 'file_upload',
      title: `Upload de ${filesArray.length} arquivo(s)`,
      destinationUrl: `/files?path=${encodeURIComponent(currentPath)}`,
      initialLogs: [
        `[INFO] Iniciando upload de ${filesArray.length} arquivo(s) para ${currentPath}...`,
        ...filesArray.map(f => `[FILE] Preparando: ${f.name} (${formatBytes(f.size)})`)
      ],
      runner: async (helpers) => {
        helpers.setProgress(30);
        helpers.setStatus('running');
        const token = localStorage.getItem('orbit_token');
        const res = await fetch(`/api/files/upload?destination=${encodeURIComponent(currentPath)}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        helpers.setProgress(85);
        if (!res.ok) {
          throw new Error('Falha no upload dos arquivos.');
        }
        filesArray.forEach(f => helpers.addLog(`[SUCCESS] Enviado: ${f.name}`));
        helpers.setDone(`Upload concluído com sucesso em ${currentPath}!`);
        toast.success(`${filesArray.length} arquivo(s) enviado(s)!`);
        loadFiles(currentPath);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Folder upload handler via Task System
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const formData = new FormData();
    filesArray.forEach((f) => {
      const relativePath = (f as any).webkitRelativePath || f.name;
      formData.append('files', f, relativePath);
    });

    startTask({
      type: 'file_upload',
      title: `Upload de Pasta (${filesArray.length} itens)`,
      destinationUrl: `/files?path=${encodeURIComponent(currentPath)}`,
      initialLogs: [
        `[INFO] Iniciando upload de pasta com ${filesArray.length} itens para ${currentPath}...`,
      ],
      runner: async (helpers) => {
        helpers.setProgress(40);
        helpers.setStatus('running');
        const token = localStorage.getItem('orbit_token');
        const res = await fetch(`/api/files/upload?destination=${encodeURIComponent(currentPath)}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        helpers.setProgress(90);
        if (!res.ok) throw new Error('Falha no upload da pasta.');
        helpers.setDone(`Upload de pasta concluído com sucesso!`);
        toast.success(`Pasta enviada com sucesso!`);
        loadFiles(currentPath);
      }
    });

    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // External Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      const formData = new FormData();
      filesArray.forEach((f) => formData.append('files', f));

      startTask({
        type: 'file_upload',
        title: `Upload de ${filesArray.length} arquivo(s)`,
        destinationUrl: `/files?path=${encodeURIComponent(currentPath)}`,
        initialLogs: [
          `[INFO] Iniciando upload via arrastar e soltar para ${currentPath}...`,
          ...filesArray.map(f => `[FILE] Preparando: ${f.name} (${formatBytes(f.size)})`)
        ],
        runner: async (helpers) => {
          helpers.setProgress(30);
          helpers.setStatus('running');
          const token = localStorage.getItem('orbit_token');
          const res = await fetch(`/api/files/upload?destination=${encodeURIComponent(currentPath)}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
          helpers.setProgress(85);
          if (!res.ok) {
            throw new Error('Falha no upload via arrastar e soltar.');
          }
          filesArray.forEach(f => helpers.addLog(`[SUCCESS] Enviado: ${f.name}`));
          helpers.setDone(`Upload concluído com sucesso!`);
          toast.success(`${filesArray.length} arquivo(s) enviado(s)!`);
          loadFiles(currentPath);
        }
      });
    }
  };

  // Internal Drag & Drop (Move items)
  const handleInternalDrop = async (e: React.DragEvent, targetDestination: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    try {
      const paths: string[] = JSON.parse(rawData);
      if (!Array.isArray(paths) || paths.length === 0) return;

      for (const p of paths) {
        if (p === targetDestination) continue;
        const fileName = p.split('/').pop() || '';
        const destPath = targetDestination === '/' ? `/${fileName}` : `${targetDestination}/${fileName}`;
        
        await fetch('/api/files/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: p, destination: destPath }),
        });
      }

      toast.success(`${paths.length} item(s) movido(s)!`);
      loadFiles(currentPath);
    } catch {
      // Ignored
    }
  };

  // Click on File or Folder
  const handleItemClick = (item: FileItem) => {
    if (item.is_dir) {
      navigateTo(item.path);
      return;
    }

    const ext = item.extension.toLowerCase();

    // Image viewer
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
      setActiveImageFile(item);
      return;
    }

    // Audio player
    if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
      setActiveAudioFile(item);
      return;
    }

    // Video player
    if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
      setActiveVideoFile(item);
      return;
    }

    // PDF viewer
    if (ext === 'pdf') {
      setActivePdfFile(item);
      return;
    }

    // Code & Text Editor
    const textExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'c', 'cpp',
      'h', 'html', 'css', 'scss', 'yml', 'yaml', 'toml', 'xml', 'sql', 'sh', 'env',
      'dockerfile', 'gitignore', 'conf', 'ini', 'log', 'csv'
    ];
    if (textExtensions.includes(ext) || item.size < 500 * 1024) {
      setActiveTextFile(item);
      return;
    }

    // Fallback: Direct download
    handleDownload(item);
  };

  // Archive Extraction
  const handleExtractArchive = async (item: FileItem) => {
    const toastId = toast.loading(`Extraindo ${item.name}...`);
    try {
      const res = await fetch('/api/files/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path, destination: currentPath }),
      });
      if (res.ok) {
        toast.success(`Arquivo ${item.name} extraído com sucesso!`, { id: toastId });
        loadFiles(currentPath);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao extrair arquivo', { id: toastId });
      }
    } catch {
      toast.error('Falha ao comunicar com o servidor', { id: toastId });
    }
  };

  // Trash Operations
  const handleRestoreTrash = async (ids: string[]) => {
    const toastId = toast.loading('Restaurando itens da lixeira...');
    try {
      const res = await fetch('/api/files/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        toast.success('Itens restaurados com sucesso!', { id: toastId });
        loadTrash();
      } else {
        toast.error('Erro ao restaurar itens', { id: toastId });
      }
    } catch {
      toast.error('Falha de conexão', { id: toastId });
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Tem certeza que deseja esvaziar permanentemente toda a lixeira?')) return;
    const toastId = toast.loading('Esvaziando lixeira...');
    try {
      const res = await fetch('/api/files/trash/empty', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Lixeira esvaziada com sucesso!', { id: toastId });
        loadTrash();
      } else {
        toast.error('Erro ao esvaziar lixeira', { id: toastId });
      }
    } catch {
      toast.error('Falha de conexão', { id: toastId });
    }
  };

  const handleMoveToTrash = async (items: FileItem[]) => {
    const paths = items.map(i => i.path);
    const count = paths.length;
    const toastId = toast.loading(`Movendo ${count} item(s) para a lixeira...`);
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, permanent: false }),
      });
      if (res.ok) {
        toast.success(`${count} item(s) movido(s) para a lixeira!`, { id: toastId });
        loadFiles(currentPath);
        setSelectedItems([]);
      } else {
        toast.error('Erro ao mover itens para a lixeira', { id: toastId });
      }
    } catch {
      toast.error('Falha na requisição', { id: toastId });
    }
  };

  // Copy & Cut Operations
  const handleCopy = (items: FileItem[]) => {
    setClipboard({ action: 'copy', items });
    toast.success(`${items.length} item(s) copiado(s)`);
  };

  const handleCut = (items: FileItem[]) => {
    setClipboard({ action: 'cut', items });
    toast.success(`${items.length} item(s) recortado(s)`);
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    const toastId = toast.loading(`${clipboard.action === 'cut' ? 'Movendo' : 'Copiando'} ${clipboard.items.length} item(s)...`);

    try {
      for (const item of clipboard.items) {
        const fileName = item.name;
        const destPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;

        if (clipboard.action === 'cut') {
          await fetch('/api/files/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: item.path, destination: destPath }),
          });
        } else {
          await fetch('/api/files/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: item.path, destination: destPath }),
          });
        }
      }

      toast.success('Operação concluída com sucesso!', { id: toastId });
      if (clipboard.action === 'cut') setClipboard(null);
      loadFiles(currentPath);
    } catch {
      toast.error('Erro ao colar itens', { id: toastId });
    }
  };

  // Compression
  const handleCompressSelection = async () => {
    if (selectedItems.length === 0) return;
    const toastId = toast.loading('Compactando itens...');
    try {
      const paths = selectedItems.map(i => i.path);
      const res = await fetch('/api/files/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, destination: currentPath }),
      });
      if (res.ok) {
        toast.success('Itens compactados com sucesso!', { id: toastId });
        loadFiles(currentPath);
        setSelectedItems([]);
      } else {
        toast.error('Erro ao compactar itens', { id: toastId });
      }
    } catch {
      toast.error('Falha de conexão', { id: toastId });
    }
  };

  // Navigation functions
  const navigateTo = (newPath: string) => {
    if (newPath === currentPath) return;
    const cleanPath = newPath.replace(/\/+/g, '/') || '/';
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(cleanPath);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentPath(cleanPath);
    setSearchParams({ path: cleanPath });
  };

  const navigateToTrash = () => {
    setSearchParams({ path: '__trash__' });
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevPath = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(prevPath);
      setSearchParams({ path: prevPath });
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextPath = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(nextPath);
      setSearchParams({ path: nextPath });
    }
  };

  const handleDownload = (item: FileItem) => {
    if (item.is_dir) {
      window.location.href = `/api/files/archive?path=${encodeURIComponent(item.path)}`;
    } else {
      window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    }
  };

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

  // Current folder name & item count
  const currentFolderName = useMemo(() => {
    if (isTrashView) return t('files.trash') || 'Lixeira';
    if (currentPath === '/' || !currentPath) return 'Raiz (/)';
    const parts = currentPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Arquivos';
  }, [currentPath, isTrashView, t]);

  // Primary Storage Capacity calculation
  const primaryStorage = useMemo(() => {
    if (storages.length === 0) return null;
    const match = storages.find(s => s.mount_point === '/' || currentPath.startsWith(s.mount_point)) || storages[0];
    return match;
  }, [storages, currentPath]);

  // Breadcrumbs calculation
  const breadcrumbSegments = () => {
    if (isTrashView) {
      return [{ label: 'Lixeira do Sistema', path: '__trash__' }];
    }
    if (currentPath === '/' || !currentPath) {
      return [{ label: 'Raiz', path: '/' }];
    }
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: 'Raiz', path: '/' }];
    let accum = '';
    parts.forEach((p) => {
      accum += `/${p}`;
      crumbs.push({ label: p, path: accum });
    });
    return crumbs;
  };

  const isSelected = (item: FileItem) => selectedItems.some(i => i.path === item.path);

  const toggleSelect = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    if (isSelected(item)) {
      setSelectedItems(selectedItems.filter(i => i.path !== item.path));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const selectAll = () => {
    if (selectedItems.length === filteredFiles.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...filteredFiles]);
    }
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPathInput.trim()) {
      navigateTo(manualPathInput.trim());
    }
  };

  return (
    <div 
      className="flex flex-col h-[calc(100vh-5.5rem)] w-full rounded-3xl overflow-hidden border border-border/80 bg-card text-primary shadow-2xl relative"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {/* Hidden file & folder inputs for uploads */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory=""
        directory=""
        ref={folderInputRef}
        onChange={handleFolderUpload}
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
          setIsCloudModalOpen={setIsCloudModalOpen}
          places={places}
          currentPath={currentPath}
          isTrashView={isTrashView}
          navigateTo={navigateTo}
          navigateToTrash={navigateToTrash}
          handleInternalDrop={handleInternalDrop}
          trashItems={trashItems}
          showLocationMenu={showLocationMenu}
          setShowLocationMenu={setShowLocationMenu}
          storages={storages}
          cloudAccounts={cloudAccounts}
          handleDisconnectCloud={handleDisconnectCloud}
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
            handlePaste={handlePaste}
            showSortMenu={showSortMenu}
            setShowSortMenu={setShowSortMenu}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortAsc={sortAsc}
            setSortAsc={setSortAsc}
            viewMode={viewMode}
            setViewMode={setViewMode}
            handleEmptyTrash={handleEmptyTrash}
            trashItemsCount={trashItems.length}
            selectedItems={selectedItems}
            selectAll={selectAll}
            handleCompressSelection={handleCompressSelection}
            handleCopy={handleCopy}
            handleCut={handleCut}
            handleMoveToTrash={handleMoveToTrash}
            setSelectedItems={setSelectedItems}
          />

          {/* Drag & Drop Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-4 z-40 border-2 border-dashed border-orbit-500 bg-orbit-500/10 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none animate-in fade-in">
              <Upload className="w-12 h-12 text-orbit-400 animate-bounce" />
              <p className="font-semibold text-primary text-base">Solte os arquivos aqui para carregar</p>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative scrollbar-thin">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
                <Loader2 className="w-9 h-9 animate-spin text-orbit-400" />
                <span className="text-xs font-medium">Carregando arquivos...</span>
              </div>
            ) : isTrashView ? (
              <FileTrashView
                trashItems={trashItems}
                handleRestoreTrash={handleRestoreTrash}
              />
            ) : filteredFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
                {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 stroke-[1.5] text-zinc-600" />
                    <p className="text-sm font-semibold text-primary">Nenhum arquivo encontrado para "{searchQuery}"</p>
                    <button
                      data-testid="clear-search-btn"
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1.5 rounded-xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 text-xs font-semibold hover:bg-orbit-500/25 transition-colors"
                    >
                      Limpar pesquisa
                    </button>
                  </>
                ) : (
                  <>
                    <Folder className="w-14 h-14 stroke-[1.5] text-zinc-600" />
                    <p className="text-base font-semibold text-primary">Esta pasta está vazia</p>
                    <p className="text-xs text-secondary max-w-sm text-center">
                      Arraste e solte arquivos aqui ou use o botão Importar para começar.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-4 py-2 rounded-xl bg-orbit-500 text-white text-xs font-semibold hover:bg-orbit-600 transition-colors shadow-md shadow-orbit-500/20"
                    >
                      Carregar arquivos
                    </button>
                  </>
                )}
              </div>
            ) : viewMode === 'grid' ? (
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
              />
            ) : (
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
              />
            )}
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
      {activeImageFile && (
        <ImageGalleryModal
          currentFile={activeImageFile}
          files={files}
          isOpen={activeImageFile !== null}
          onClose={() => setActiveImageFile(null)}
        />
      )}

      {activeAudioFile && (
        <AudioPlayerModal
          file={activeAudioFile}
          onClose={() => setActiveAudioFile(null)}
        />
      )}

      {activeVideoFile && (
        <VideoPlayerModal
          file={activeVideoFile}
          onClose={() => setActiveVideoFile(null)}
        />
      )}

      {activeTextFile && (
        <TextEditorModal
          file={activeTextFile}
          onClose={() => setActiveTextFile(null)}
          onSaved={() => loadFiles(currentPath)}
        />
      )}

      {activePdfFile && (
        <PdfViewerModal
          file={activePdfFile}
          onClose={() => setActivePdfFile(null)}
        />
      )}

      {isDiskAnalyzerOpen && (
        <DiskAnalyzerModal
          currentPath={currentPath}
          isOpen={isDiskAnalyzerOpen}
          onClose={() => setIsDiskAnalyzerOpen(false)}
          onNavigateTo={(target) => navigateTo(target)}
        />
      )}

      {shareFile && (
        <ShareModal
          file={shareFile}
          isOpen={shareFile !== null}
          onClose={() => setShareFile(null)}
        />
      )}

      <CloudConnectModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        onConnected={loadStoragesAndCloud}
      />

      <FileOperationsModal
        isOpen={opModalType !== null}
        type={opModalType}
        currentPath={currentPath}
        targetItem={opTargetItem}
        selectedItems={selectedItems}
        onClose={() => {
          setOpModalType(null);
          setOpTargetItem(null);
        }}
        onSuccess={() => loadFiles(currentPath)}
      />
    </div>
  );
}

export default FileManager;
