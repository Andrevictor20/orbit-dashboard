import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Folder, 
  File, 
  FileText, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Archive, 
  HardDrive, 
  Cloud, 
  Home, 
  Download, 
  Upload, 
  Plus, 
  Grid, 
  List, 
  Search, 
  ChevronRight, 
  Trash2, 
  Edit3, 
  Copy, 
  Scissors, 
  Clipboard, 
  Eye, 
  EyeOff, 
  FilePlus, 
  FolderPlus, 
  Loader2, 
  ChevronDown, 
  X, 
  RefreshCw, 
  Code, 
  ArrowUpDown, 
  CheckSquare, 
  Square,
  Check,
  PieChart,
  Share2,
  Terminal,
  RotateCcw,
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AudioPlayerModal } from '../components/files/AudioPlayerModal';
import type { FileItem } from '../components/files/AudioPlayerModal';
export type { FileItem };
import { VideoPlayerModal } from '../components/files/VideoPlayerModal';
import { TextEditorModal } from '../components/files/TextEditorModal';
import { PdfViewerModal } from '../components/files/PdfViewerModal';
import { ImageGalleryModal } from '../components/files/ImageGalleryModal';
import { DiskAnalyzerModal } from '../components/files/DiskAnalyzerModal';
import { ShareModal } from '../components/files/ShareModal';
import { CloudConnectModal } from '../components/files/CloudConnectModal';
import { FileOperationsModal } from '../components/files/FileOperationsModal';
import type { OperationType } from '../components/files/FileOperationsModal';
import { useTasks } from '../contexts/InstallContext';
import { isPhysicalStorage, getFriendlyDiskName, formatBytes, formatStorage } from '../utils/format';

export interface MountItem {
  name: string;
  mount_point: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

interface CloudAccount {
  id: string;
  provider: string;
  name: string;
  mount_point?: string;
}

interface ShortcutPlace {
  id: string;
  label: string;
  path: string;
  icon: string;
}

interface TrashItem {
  id: string;
  name: string;
  original_path: string;
  trash_path: string;
  is_dir: boolean;
  size: number;
  deleted_at: string;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'tgz', 'rar', '7z'];

export function FileManager() {
  const { startTask } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPath = searchParams.get('path');
  const isTrashView = urlPath === '__trash__';
  const [currentPath, setCurrentPath] = useState<string>(isTrashView ? '/' : (urlPath || '/'));
  const [files, setFiles] = useState<FileItem[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [storages, setStorages] = useState<MountItem[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [places, setPlaces] = useState<ShortcutPlace[]>([
    { id: 'home', label: 'Início', path: '/', icon: 'home' },
    { id: 'documents', label: 'Documentos', path: '/Documents', icon: 'file-text' },
    { id: 'downloads', label: 'Downloads', path: '/Downloads', icon: 'download' },
    { id: 'pictures', label: 'Imagens', path: '/Pictures', icon: 'image' },
    { id: 'music', label: 'Músicas', path: '/Music', icon: 'music' },
    { id: 'videos', label: 'Vídeos', path: '/Videos', icon: 'film' },
    { id: 'root', label: 'Sistema (Raiz)', path: '/', icon: 'hard-drive' },
  ]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [clipboard, setClipboard] = useState<{ items: FileItem[]; action: 'copy' | 'cut' } | null>(null);

  // Dropdown states
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isStorageDrawerOpen, setIsStorageDrawerOpen] = useState(false);

  // Modals state
  const [activeAudioFile, setActiveAudioFile] = useState<FileItem | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<FileItem | null>(null);
  const [activeTextFile, setActiveTextFile] = useState<FileItem | null>(null);
  const [activePdfFile, setActivePdfFile] = useState<FileItem | null>(null);
  const [activeImageFile, setActiveImageFile] = useState<FileItem | null>(null);
  const [isDiskAnalyzerOpen, setIsDiskAnalyzerOpen] = useState(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [opModalType, setOpModalType] = useState<OperationType | null>(null);
  const [opTargetItem, setOpTargetItem] = useState<FileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Sync with URL query parameter
  useEffect(() => {
    if (urlPath === '__trash__') {
      loadTrash();
    } else if (urlPath && urlPath !== currentPath) {
      setCurrentPath(urlPath);
    }
  }, [urlPath]);

  const navigateTo = (newPath: string) => {
    const clean = newPath || '/';
    setSearchQuery('');
    setCurrentPath(clean);
    setSearchParams({ path: clean }, { replace: true });
  };

  const navigateToTrash = () => {
    setSearchQuery('');
    setSearchParams({ path: '__trash__' }, { replace: true });
  };

  // Load shortcuts, storages and cloud accounts once
  useEffect(() => {
    fetch('/api/files/shortcuts')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (Array.isArray(data.places) && data.places.length > 0) {
            setPlaces(data.places);
          } else {
            const newPlaces: ShortcutPlace[] = [];
            if (data.home) newPlaces.push({ id: 'home', label: 'Início', path: data.home, icon: 'home' });
            if (data.documents) newPlaces.push({ id: 'documents', label: 'Documentos', path: data.documents, icon: 'file-text' });
            if (data.downloads) newPlaces.push({ id: 'downloads', label: 'Downloads', path: data.downloads, icon: 'download' });
            if (data.pictures) newPlaces.push({ id: 'pictures', label: 'Imagens', path: data.pictures, icon: 'image' });
            if (data.music) newPlaces.push({ id: 'music', label: 'Músicas', path: data.music, icon: 'music' });
            if (data.videos) newPlaces.push({ id: 'videos', label: 'Vídeos', path: data.videos, icon: 'film' });
            newPlaces.push({ id: 'root', label: 'Sistema (Raiz)', path: data.root || '/', icon: 'hard-drive' });
            setPlaces(newPlaces);
          }

          if (!urlPath && data.home) {
            navigateTo(data.home);
          }
        }
      })
      .catch(() => {});

    loadStoragesAndCloud();
  }, []);

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

  useEffect(() => {
    if (isTrashView) {
      loadTrash();
    } else {
      loadFiles(currentPath);
    }
  }, [currentPath, isTrashView]);

  // File click handler
  const handleItemClick = (item: FileItem) => {
    if (item.is_dir) {
      navigateTo(item.path);
      return;
    }

    const ext = item.extension.toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) {
      setActiveImageFile(item);
    } else if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
      setActiveAudioFile(item);
    } else if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
      setActiveVideoFile(item);
    } else if (['txt', 'log', 'json', 'yaml', 'yml', 'md', 'sh', 'js', 'ts', 'rs', 'toml', 'env', 'xml', 'html', 'css', 'py'].includes(ext)) {
      setActiveTextFile(item);
    } else if (ext === 'pdf') {
      setActivePdfFile(item);
    } else {
      window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    }
  };

  // Quick Look with Spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          return;
        }

        const isViewerOpen = activeAudioFile || activeVideoFile || activeTextFile || activePdfFile || activeImageFile || isDiskAnalyzerOpen || shareFile;
        if (isViewerOpen) {
          e.preventDefault();
          setActiveAudioFile(null);
          setActiveVideoFile(null);
          setActiveTextFile(null);
          setActivePdfFile(null);
          setActiveImageFile(null);
          setIsDiskAnalyzerOpen(false);
          setShareFile(null);
          return;
        }

        if (selectedItems.length === 1 && !isTrashView) {
          e.preventDefault();
          handleItemClick(selectedItems[0]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, activeAudioFile, activeVideoFile, activeTextFile, activePdfFile, activeImageFile, isDiskAnalyzerOpen, shareFile, isTrashView]);

  // Upload handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    const formData = new FormData();
    filesArray.forEach(file => formData.append('files', file));

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
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    const formData = new FormData();
    filesArray.forEach(file => {
      formData.append('files', file);
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
  };

  // Drag & drop upload handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const filesArray = Array.from(e.dataTransfer.files);
    const formData = new FormData();
    filesArray.forEach(file => formData.append('files', file));

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
  };

  // Internal Move through Drag & Drop
  const handleInternalDrop = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const paths: string[] = JSON.parse(raw);
      if (!paths || paths.length === 0) return;

      for (const p of paths) {
        const fileName = p.split('/').pop() || '';
        const destination = targetDir === '/' ? `/${fileName}` : `${targetDir}/${fileName}`;
        if (p === destination) continue;
        await fetch('/api/files/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: p, destination }),
        });
      }
      toast.success(`${paths.length} item(s) movido(s) para ${targetDir}!`);
      loadFiles(currentPath);
    } catch {
      toast.error('Erro ao mover itens.');
    }
  };

  // Archive Extract & Compress Handlers
  const handleExtractArchive = async (item: FileItem) => {
    try {
      const res = await fetch('/api/files/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path, destination: currentPath }),
      });
      if (!res.ok) throw new Error('Falha ao descompactar');
      const json = await res.json();
      toast.success(`Descompactado com sucesso (${json.files_count} arquivos)!`);
      loadFiles(currentPath);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao extrair');
    }
  };

  const handleCompressSelection = async () => {
    if (selectedItems.length === 0) return;
    try {
      const zipName = selectedItems.length === 1 ? `${selectedItems[0].name}.zip` : 'arquivos_comprimidos.zip';
      const res = await fetch('/api/files/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: selectedItems.map(i => i.path),
          destination_name: zipName,
          destination_dir: currentPath,
        }),
      });
      if (!res.ok) throw new Error('Falha ao compactar');
      toast.success('Arquivo .zip criado com sucesso!');
      setSelectedItems([]);
      loadFiles(currentPath);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao compactar');
    }
  };

  // Trash Operations
  const handleMoveToTrash = async (items: FileItem[]) => {
    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: items.map(i => i.path) }),
      });
      if (!res.ok) throw new Error('Erro ao mover para a lixeira');
      toast.success(`${items.length} item(s) movido(s) para a lixeira!`);
      setSelectedItems([]);
      loadFiles(currentPath);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao mover para a lixeira');
    }
  };

  const handleRestoreTrash = async (ids: string[]) => {
    try {
      const res = await fetch('/api/files/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Erro ao restaurar');
      toast.success('Item(ns) restaurado(s) com sucesso!');
      loadTrash();
    } catch {
      toast.error('Erro ao restaurar item(ns).');
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Tem certeza que deseja esvaziar a lixeira permanentemente?')) return;
    try {
      const res = await fetch('/api/files/trash', { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao esvaziar');
      toast.success('Lixeira esvaziada!');
      loadTrash();
    } catch {
      toast.error('Erro ao esvaziar lixeira.');
    }
  };

  // Clipboard operations
  const handleCopy = (items: FileItem[]) => {
    setClipboard({ items, action: 'copy' });
    toast.success(`${items.length} item(s) copiado(s) para a área de transferência`);
  };

  const handleCut = (items: FileItem[]) => {
    setClipboard({ items, action: 'cut' });
    toast.success(`${items.length} item(s) recortado(s) para a área de transferência`);
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    const isCut = clipboard.action === 'cut';
    const endpoint = isCut ? '/api/files/move' : '/api/files/copy';

    try {
      for (const item of clipboard.items) {
        const dest = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: item.path, destination: dest }),
        });
      }
      toast.success(`${clipboard.items.length} item(s) ${isCut ? 'movido(s)' : 'copiado(s)'}!`);
      if (isCut) setClipboard(null);
      loadFiles(currentPath);
    } catch {
      toast.error('Erro ao colar itens.');
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

  // Breadcrumbs calculation
  const breadcrumbSegments = () => {
    if (isTrashView) {
      return [{ label: 'Lixeira do Sistema', path: '__trash__' }];
    }
    if (currentPath === '/' || !currentPath) {
      return [{ label: 'Raiz (/)', path: '/' }];
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

  const getPlaceIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'home': return Home;
      case 'file-text':
      case 'documents': return FileText;
      case 'download':
      case 'downloads': return Download;
      case 'image':
      case 'pictures': return ImageIcon;
      case 'music': return Music;
      case 'film':
      case 'videos': return Film;
      case 'hard-drive':
      case 'root': return HardDrive;
      case 'trash': return Trash2;
      default: return Folder;
    }
  };

  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) {
      return <Folder className="w-9 h-9 sm:w-11 sm:h-11 text-sky-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    const ext = item.extension.toLowerCase();
    if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
      return <Music className="w-9 h-9 sm:w-11 sm:h-11 text-violet-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
      return <Film className="w-9 h-9 sm:w-11 sm:h-11 text-rose-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return <ImageIcon className="w-9 h-9 sm:w-11 sm:h-11 text-amber-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    if (ARCHIVE_EXTENSIONS.includes(ext)) {
      return <Archive className="w-9 h-9 sm:w-11 sm:h-11 text-orange-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText className="w-9 h-9 sm:w-11 sm:h-11 text-red-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'rs', 'py', 'json', 'yaml', 'yml', 'sh', 'html', 'css', 'toml', 'env'].includes(ext)) {
      return <Code className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
    }
    return <File className="w-9 h-9 sm:w-11 sm:h-11 text-zinc-400 drop-shadow-sm transition-transform group-hover:scale-105" />;
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

  return (
    <div 
      className="flex h-[calc(100vh-5.5rem)] w-full rounded-2xl overflow-hidden border border-border bg-card/40 backdrop-blur-xl text-primary shadow-2xl"
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* SIDEBAR (NAUTILUS STYLE) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 md:w-72 bg-card/95 lg:bg-card/30 backdrop-blur-2xl border-r border-border flex flex-col justify-between p-3.5 transition-transform duration-300 ease-in-out ${
          isStorageDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-border">
            <span className="text-sm font-bold text-primary flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-orbit-400" />
              Locais & Discos
            </span>
            <button
              onClick={() => setIsStorageDrawerOpen(false)}
              className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
              aria-label="Fechar gaveta de locais"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section: Favoritos / Places */}
          <div>
            <h3 className="text-xs font-bold text-secondary uppercase tracking-wider px-3 mb-2">
              Favoritos
            </h3>
            <div className="space-y-0.5">
              {places.map((place) => {
                const Icon = getPlaceIcon(place.icon);
                const isActive = !isTrashView && currentPath === place.path;
                return (
                  <button
                    key={place.id}
                    onClick={() => {
                      navigateTo(place.path);
                      setIsStorageDrawerOpen(false);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-orbit-500/20'); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('bg-orbit-500/20')}
                    onDrop={(e) => { e.currentTarget.classList.remove('bg-orbit-500/20'); handleInternalDrop(e, place.path); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 font-semibold shadow-sm'
                        : 'text-secondary hover:text-primary hover:bg-accent/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{place.label}</span>
                  </button>
                );
              })}

              {/* Lixeira / Trash Shortcut */}
              <button
                onClick={() => {
                  navigateToTrash();
                  setIsStorageDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isTrashView
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-accent/60'
                }`}
              >
                <Trash2 className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="truncate">Lixeira</span>
              </button>
            </div>
          </div>

          {/* Section: Unidades de Armazenamento */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">
                Unidades
              </h3>
              <button
                onClick={() => setShowLocationMenu(!showLocationMenu)}
                className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                title="Adicionar armazenamento em nuvem"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Location Dropdown Menu */}
            {showLocationMenu && (
              <div className="mb-2 p-1 bg-card border border-border rounded-xl shadow-xl text-xs space-y-0.5 animate-in fade-in">
                <button
                  onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors font-medium flex items-center gap-2"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span>Conectar Nuvem / SMB</span>
                </button>
              </div>
            )}

            {/* Mounted Disks List */}
            <div className="space-y-1.5">
              {storages.map((st, idx) => {
                const usedFormatted = formatStorage(st.used_bytes, 1);
                const totalFormatted = formatStorage(st.total_bytes, 1);
                const pct = st.total_bytes > 0 ? Math.round((st.used_bytes / st.total_bytes) * 100) : 0;
                const isActive = !isTrashView && (currentPath === st.mount_point || currentPath.startsWith(`${st.mount_point}/`));
                const friendlyName = getFriendlyDiskName(st.name, st.mount_point);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      navigateTo(st.mount_point);
                      setIsStorageDrawerOpen(false);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-orbit-500'); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('ring-2', 'ring-orbit-500')}
                    onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-orbit-500'); handleInternalDrop(e, st.mount_point); }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-orbit-500/10 border-orbit-500/30 text-orbit-400 font-semibold shadow-sm'
                        : 'bg-accent/20 border-border hover:bg-accent/50 text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <HardDrive className="w-4 h-4 shrink-0 text-orbit-400" />
                      <span className="text-xs truncate font-medium">{friendlyName}</span>
                    </div>
                    {st.total_bytes > 0 && (
                      <>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct > 85 ? 'bg-rose-500' : 'bg-orbit-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-secondary font-mono">
                          <span>{usedFormatted} / {totalFormatted}</span>
                          <span>{pct}%</span>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}

              {/* Connected Cloud Accounts */}
              {cloudAccounts.map((acc) => {
                const isCurrent = acc.mount_point && currentPath.startsWith(acc.mount_point);
                const isGoogle = acc.provider === 'google_drive';
                const isOneDrive = acc.provider === 'onedrive';
                const isDropbox = acc.provider === 'dropbox';

                return (
                  <div
                    key={acc.id}
                    className={`group relative flex items-center justify-between p-2 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-orbit-500/10 border-orbit-500/30 text-orbit-400 font-semibold'
                        : 'border-border bg-accent/20 hover:bg-accent/50 text-primary'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (acc.mount_point) navigateTo(acc.mount_point);
                        setIsStorageDrawerOpen(false);
                      }}
                      className="flex-1 text-left flex items-center gap-2.5 min-w-0 pr-1"
                      title={acc.name}
                    >
                      <div className={`p-1.5 rounded-lg border shrink-0 ${
                        isGoogle ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        isOneDrive ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        isDropbox ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        <Cloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs truncate block">{acc.name}</span>
                        <span className="text-[10px] text-secondary capitalize block">{acc.provider.replace('_', ' ')}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnectCloud(acc.id, acc.name);
                      }}
                      className="p-1 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Desconectar ${acc.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="pt-3 border-t border-border space-y-1">
          <button
            data-testid="toggle-hidden-btn"
            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors font-medium ${
              showHiddenFiles
                ? 'bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 font-semibold'
                : 'text-secondary hover:text-primary hover:bg-accent/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {showHiddenFiles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Arquivos ocultos</span>
            </div>
            <span className="text-[10px] text-secondary font-mono">{showHiddenFiles ? 'Visíveis' : 'Ocultos'}</span>
          </button>
          
          <button
            onClick={() => loadFiles(currentPath)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-secondary hover:text-primary hover:bg-accent/60 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar lista</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/40 overflow-hidden relative">
        {/* Top Navbar */}
        <header className="py-2.5 px-4 sm:px-6 border-b border-border bg-card/30 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {/* Mobile Toggle Locations Button */}
            <button
              onClick={() => setIsStorageDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-accent/60 text-secondary hover:text-primary transition-colors flex items-center gap-1.5 text-xs shrink-0 border border-border"
              aria-label="Abrir locais de armazenamento"
            >
              <HardDrive className="w-4 h-4 text-orbit-400" />
              <span className="hidden xs:inline font-medium">Locais</span>
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 text-xs sm:text-sm scrollbar-none font-medium min-w-0">
              {breadcrumbSegments().map((crumb, idx, arr) => (
                <React.Fragment key={crumb.path}>
                  <button
                    onClick={() => crumb.path === '__trash__' ? navigateToTrash() : navigateTo(crumb.path)}
                    className={`hover:text-orbit-400 transition-colors px-2.5 py-1 rounded-lg truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] ${
                      idx === arr.length - 1 ? 'text-primary font-bold bg-accent/60 border border-border/50' : 'text-secondary hover:bg-accent/40'
                    }`}
                  >
                    {crumb.label}
                  </button>
                  {idx < arr.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isTrashView && (
              <>
                {/* Search Input */}
                <div className="relative w-28 xs:w-36 sm:w-48 md:w-56">
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-accent/40 border border-border text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      data-testid="clear-search-input-btn"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-0.5"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Disk Space Analyzer Button */}
                <button
                  onClick={() => setIsDiskAnalyzerOpen(true)}
                  className="p-2 rounded-xl border border-border bg-card text-secondary hover:text-violet-400 hover:bg-accent/80 transition-colors"
                  title="Analisador de Espaço em Disco"
                >
                  <PieChart className="w-4 h-4" />
                </button>

                {/* Open in Terminal Button */}
                <Link
                  to={`/terminal?cwd=${encodeURIComponent(currentPath)}`}
                  className="p-2 rounded-xl border border-border bg-card text-secondary hover:text-emerald-400 hover:bg-accent/80 transition-colors"
                  title="Abrir Terminal Aqui"
                >
                  <Terminal className="w-4 h-4" />
                </Link>

                {/* Clipboard Paste button */}
                {clipboard && (
                  <button
                    onClick={handlePaste}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/30 hover:bg-orbit-500/25 text-xs font-semibold transition-colors animate-in fade-in"
                    title={`Colar ${clipboard.items.length} item(s)`}
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Colar ({clipboard.items.length})</span>
                  </button>
                )}

                {/* Sort Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="p-2 rounded-xl border border-border bg-card text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                    title="Ordenar arquivos"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-card border border-border rounded-xl shadow-2xl z-30 p-1 space-y-0.5 text-xs animate-in fade-in">
                      <button
                        onClick={() => { setSortBy('name'); setSortAsc(sortBy === 'name' ? !sortAsc : true); setShowSortMenu(false); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-primary hover:bg-accent transition-colors"
                      >
                        <span>Nome</span>
                        {sortBy === 'name' && <span className="text-[10px] text-orbit-400">{sortAsc ? 'A-Z' : 'Z-A'}</span>}
                      </button>
                      <button
                        onClick={() => { setSortBy('size'); setSortAsc(sortBy === 'size' ? !sortAsc : true); setShowSortMenu(false); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-primary hover:bg-accent transition-colors"
                      >
                        <span>Tamanho</span>
                        {sortBy === 'size' && <span className="text-[10px] text-orbit-400">{sortAsc ? 'Menor' : 'Maior'}</span>}
                      </button>
                      <button
                        onClick={() => { setSortBy('modified'); setSortAsc(sortBy === 'modified' ? !sortAsc : true); setShowSortMenu(false); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-primary hover:bg-accent transition-colors"
                      >
                        <span>Modificado</span>
                        {sortBy === 'modified' && <span className="text-[10px] text-orbit-400">{sortAsc ? 'Antigo' : 'Recente'}</span>}
                      </button>
                    </div>
                  )}
                </div>

                {/* View Mode Toggle */}
                <button
                  data-testid="view-mode-toggle"
                  onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
                  className="p-2 rounded-xl border border-border bg-card text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                  title={viewMode === 'grid' ? 'Modo Lista' : 'Modo Grade'}
                >
                  {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                </button>

                {/* Create / Upload Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowCreateMenu(!showCreateMenu)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orbit-500 text-white hover:bg-orbit-600 active:scale-95 shadow-md shadow-orbit-500/25 text-xs font-semibold transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden xs:inline">Criar</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showCreateMenu && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-2xl z-30 p-1 space-y-0.5 text-xs animate-in fade-in">
                      <button
                        onClick={() => {
                          setShowCreateMenu(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                      >
                        <Upload className="w-4 h-4 text-orbit-400" />
                        <span>Carregar arquivos</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateMenu(false);
                          folderInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                      >
                        <Folder className="w-4 h-4 text-amber-400" />
                        <span>Carregar pasta</span>
                      </button>
                      <div className="w-full h-[1px] bg-border my-1" />
                      <button
                        onClick={() => {
                          setShowCreateMenu(false);
                          setOpTargetItem(null);
                          setOpModalType('new_folder');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                      >
                        <FolderPlus className="w-4 h-4 text-sky-400" />
                        <span>Nova pasta</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateMenu(false);
                          setOpTargetItem(null);
                          setOpModalType('new_file');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                      >
                        <FilePlus className="w-4 h-4 text-emerald-400" />
                        <span>Novo arquivo</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {isTrashView && (
              <button
                onClick={handleEmptyTrash}
                disabled={trashItems.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 active:scale-95 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Esvaziar Lixeira</span>
              </button>
            )}
          </div>
        </header>

        {/* Selected Batch Action Bar */}
        {selectedItems.length > 0 && !isTrashView && (
          <div className="px-4 sm:px-6 py-2 bg-orbit-500/10 border-b border-orbit-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-orbit-400 animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 font-semibold hover:underline text-primary"
              >
                {selectedItems.length === filteredFiles.length ? (
                  <CheckSquare className="w-4 h-4 text-orbit-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>{selectedItems.length} item(s) selecionado(s)</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleCompressSelection}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-primary hover:bg-accent transition-colors font-medium"
                title="Compactar itens selecionados em .zip"
              >
                <Package className="w-3.5 h-3.5 text-amber-400" /> <span className="hidden xs:inline">Compactar (.zip)</span>
              </button>
              <button
                onClick={() => handleCopy(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-primary hover:bg-accent transition-colors font-medium"
              >
                <Copy className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Copiar</span>
              </button>
              <button
                onClick={() => handleCut(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-primary hover:bg-accent transition-colors font-medium"
              >
                <Scissors className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Recortar</span>
              </button>
              <button
                onClick={() => handleMoveToTrash(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors font-medium"
                title="Mover itens para a lixeira"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span>Lixeira</span>
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent ml-1"
                title="Desmarcar todos"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
              <span className="text-sm font-medium">Carregando arquivos...</span>
            </div>
          ) : isTrashView ? (
            /* TRASH VIEW */
            <div>
              {trashItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-20">
                  <Trash2 className="w-14 h-14 stroke-[1.5] text-zinc-600" />
                  <p className="text-base font-semibold text-primary">A Lixeira está vazia</p>
                  <p className="text-xs text-secondary max-w-sm text-center">
                    Os itens excluídos aparecerão aqui e poderão ser restaurados a qualquer momento.
                  </p>
                </div>
              ) : (
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
              )}
            </div>
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
                    Arraste e solte arquivos aqui ou use o botão Criar para começar.
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
            /* GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
              {filteredFiles.map((item) => {
                const selected = isSelected(item);
                const isImage = IMAGE_EXTENSIONS.includes(item.extension.toLowerCase());
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
                        ? 'bg-orbit-500/15 border-orbit-500/40 ring-2 ring-orbit-500/30 shadow-lg'
                        : item.is_hidden
                        ? 'bg-card/40 border-border/60 opacity-60 hover:opacity-100 hover:bg-card hover:border-zinc-700'
                        : 'bg-card/60 border-border hover:bg-card hover:border-zinc-700 hover:shadow-xl hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <button
                      onClick={(e) => toggleSelect(e, item)}
                      className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                        selected
                          ? 'bg-orbit-500 border-orbit-500 text-white'
                          : 'border-border bg-card/90 opacity-0 group-hover:opacity-100 text-transparent hover:border-orbit-400'
                      }`}
                      title={selected ? 'Desmarcar' : 'Selecionar'}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>

                    {/* Item Visual (Real Thumbnail or Icon) */}
                    <div className="my-2 flex items-center justify-center">
                      {isImage ? (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black/20 flex items-center justify-center border border-border/50 shadow-inner">
                          <img
                            src={`/api/files/raw?path=${encodeURIComponent(item.path)}`}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-2 rounded-2xl">
                          {getFileIcon(item)}
                        </div>
                      )}
                    </div>

                    {/* Item Metadata */}
                    <div className="w-full text-center min-w-0">
                      <span 
                        className="block text-xs font-semibold text-primary truncate px-1"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="text-[10px] text-secondary font-mono block mt-0.5">
                        {item.is_dir ? 'Pasta' : formatBytes(item.size)}
                      </span>
                    </div>

                    {/* Quick Action Overlay on hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card/95 rounded-lg p-0.5 shadow-md border border-border z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareFile(item);
                        }}
                        className="p-1 rounded text-secondary hover:text-violet-400 hover:bg-accent/80"
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
                          className="p-1 rounded text-secondary hover:text-amber-400 hover:bg-accent/80"
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
                        className="p-1 rounded text-secondary hover:text-primary hover:bg-accent/80"
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
                        className="p-1 rounded text-secondary hover:text-primary hover:bg-accent/80"
                        title="Renomear"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-accent/40 text-secondary border-b border-border select-none font-semibold">
                    <tr>
                      <th className="py-3 px-4 w-8">
                        <button onClick={selectAll} className="p-0.5 rounded hover:bg-accent">
                          {selectedItems.length === filteredFiles.length && filteredFiles.length > 0 ? (
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
                  <tbody className="divide-y divide-border">
                    {filteredFiles.map((item) => {
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
                          className={`hover:bg-accent/50 transition-colors cursor-pointer ${
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
                            <div className="shrink-0">{getFileIcon(item)}</div>
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
          )}
        </div>
      </main>

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
