import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  FileText, 
  Film, 
  Music, 
  Image, 
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
  FilePlus, 
  FolderPlus, 
  Disc, 
  Loader2, 
  ChevronDown,
  X
} from 'lucide-react';
import { AudioPlayerModal } from '../components/files/AudioPlayerModal';
import type { FileItem } from '../components/files/AudioPlayerModal';
import { VideoPlayerModal } from '../components/files/VideoPlayerModal';
import { TextEditorModal } from '../components/files/TextEditorModal';
import { PdfViewerModal } from '../components/files/PdfViewerModal';
import { CloudConnectModal } from '../components/files/CloudConnectModal';
import { FileOperationsModal } from '../components/files/FileOperationsModal';
import type { OperationType } from '../components/files/FileOperationsModal';

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

export function FileManager() {
  const [currentPath, setCurrentPath] = useState<string>('/DATA');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [storages, setStorages] = useState<MountItem[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({
    root: '/',
    data: '/DATA',
    documents: '/DATA/Documents',
    downloads: '/DATA/Downloads',
    gallery: '/DATA/Gallery',
    media: '/DATA/Media',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [clipboard, setClipboard] = useState<{ items: FileItem[]; action: 'copy' | 'cut' } | null>(null);

  // Dropdown states
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isStorageDrawerOpen, setIsStorageDrawerOpen] = useState(false);

  // Modals state
  const [activeAudioFile, setActiveAudioFile] = useState<FileItem | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<FileItem | null>(null);
  const [activeTextFile, setActiveTextFile] = useState<FileItem | null>(null);
  const [activePdfFile, setActivePdfFile] = useState<FileItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [opModalType, setOpModalType] = useState<OperationType | null>(null);
  const [opTargetItem, setOpTargetItem] = useState<FileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load shortcuts, storages and cloud accounts once
  useEffect(() => {
    fetch('/api/files/shortcuts')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') setShortcuts(data);
      })
      .catch(() => {});

    loadStoragesAndCloud();
  }, []);

  const loadStoragesAndCloud = () => {
    fetch('/api/files/storages')
      .then(res => res.json())
      .then(data => {
        if (data.mounts && Array.isArray(data.mounts)) setStorages(data.mounts);
      })
      .catch(() => {});

    fetch('/api/files/cloud/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.accounts && Array.isArray(data.accounts)) setCloudAccounts(data.accounts);
      })
      .catch(() => {});
  };

  // Fetch current folder files
  const loadFiles = (path: string) => {
    setIsLoading(true);
    setSelectedItems([]);
    fetch(`/api/files/list?path=${encodeURIComponent(path)}`)
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível listar arquivos');
        return res.json();
      })
      .then(data => {
        setFiles(data.items || []);
        if (data.current_path) setCurrentPath(data.current_path);
        setIsLoading(false);
      })
      .catch(() => {
        setFiles([]);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  // File click handler
  const handleItemClick = (item: FileItem) => {
    if (item.is_dir) {
      setCurrentPath(item.path);
      return;
    }

    const ext = item.extension.toLowerCase();
    if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
      setActiveAudioFile(item);
    } else if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
      setActiveVideoFile(item);
    } else if (['txt', 'log', 'json', 'yaml', 'yml', 'md', 'sh', 'js', 'ts', 'rs', 'toml', 'env', 'xml', 'html', 'css'].includes(ext)) {
      setActiveTextFile(item);
    } else if (ext === 'pdf') {
      setActivePdfFile(item);
    } else {
      // Direct download
      window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    }
  };

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      await fetch(`/api/files/upload?destination=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        body: formData,
      });
      loadFiles(currentPath);
    } catch {}
  };

  // Drag & drop upload handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      formData.append('files', e.dataTransfer.files[i]);
    }

    try {
      await fetch(`/api/files/upload?destination=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        body: formData,
      });
      loadFiles(currentPath);
    } catch {}
  };

  // Clipboard operations (Copy, Cut, Paste)
  const handleCopy = (items: FileItem[]) => {
    setClipboard({ items, action: 'copy' });
  };

  const handleCut = (items: FileItem[]) => {
    setClipboard({ items, action: 'cut' });
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.items.length === 0) return;

    for (const item of clipboard.items) {
      const dest = `${currentPath === '/' ? '' : currentPath}/${item.name}`;
      const endpoint = clipboard.action === 'copy' ? '/api/files/copy' : '/api/files/move';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: item.path,
          destination: dest,
        }),
      });
    }

    if (clipboard.action === 'cut') setClipboard(null);
    loadFiles(currentPath);
  };

  // Download handler
  const handleDownload = (item: FileItem) => {
    if (item.is_dir) {
      window.location.href = `/api/files/archive?path=${encodeURIComponent(item.path)}`;
    } else {
      window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatStorageSpace = (used: number, total: number) => {
    const usedGB = (used / (1024 * 1024 * 1024)).toFixed(1);
    const totalGB = (total / (1024 * 1024 * 1024)).toFixed(1);
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return { usedGB, totalGB, pct };
  };

  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) {
      return <Folder className="w-8 h-8 md:w-10 md:h-10 text-sky-400 fill-sky-400/20" />;
    }
    const ext = item.extension.toLowerCase();
    if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
      return <Music className="w-8 h-8 md:w-10 md:h-10 text-amber-400 fill-amber-400/20" />;
    }
    if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
      return <Film className="w-8 h-8 md:w-10 md:h-10 text-purple-400 fill-purple-400/20" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return <Image className="w-8 h-8 md:w-10 md:h-10 text-emerald-400 fill-emerald-400/20" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return <Archive className="w-8 h-8 md:w-10 md:h-10 text-orange-400 fill-orange-400/20" />;
    }
    if (ext === 'pdf') {
      return <FileText className="w-8 h-8 md:w-10 md:h-10 text-rose-400 fill-rose-400/20" />;
    }
    return <File className="w-8 h-8 md:w-10 md:h-10 text-zinc-400 fill-zinc-400/10" />;
  };

  // Breadcrumbs generator
  const breadcrumbSegments = () => {
    const segments = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: 'Root', path: '/' }];
    let accum = '';
    for (const seg of segments) {
      accum += `/${seg}`;
      crumbs.push({ label: seg, path: accum });
    }
    return crumbs;
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="flex h-[calc(100vh-4rem)] bg-background text-primary overflow-hidden select-none"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      {/* Mobile Storage Drawer Backdrop */}
      {isStorageDrawerOpen && (
        <div 
          onClick={() => setIsStorageDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* LEFT SIDEBAR (Mobile Drawer / Desktop Static Sidebar) */}
      <aside className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto w-72 lg:w-64 border-r border-border bg-card lg:bg-card/60 backdrop-blur-md flex flex-col justify-between p-4 overflow-y-auto shrink-0 space-y-6 transition-transform duration-300 ${
        isStorageDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="space-y-6">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-border">
            <span className="text-sm font-bold text-primary flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-orbit-400" />
              Locais & Discos
            </span>
            <button
              onClick={() => setIsStorageDrawerOpen(false)}
              className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-accent"
              aria-label="Fechar gaveta de locais"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcuts Group */}
          <div>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider px-3 mb-2">
              Arquivos
            </h3>
            <div className="space-y-0.5">
              {[
                { label: 'Root', path: shortcuts.root || '/', icon: Home },
                { label: 'DATA', path: shortcuts.data || '/DATA', icon: Disc },
                { label: 'Documents', path: shortcuts.documents || '/DATA/Documents', icon: FileText },
                { label: 'Downloads', path: shortcuts.downloads || '/DATA/Downloads', icon: Download },
                { label: 'Gallery', path: shortcuts.gallery || '/DATA/Gallery', icon: Image },
                { label: 'Media', path: shortcuts.media || '/DATA/Media', icon: Film },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setCurrentPath(item.path);
                      setIsStorageDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-orbit-500/15 text-orbit-400 border border-orbit-500/30'
                        : 'text-secondary hover:text-primary hover:bg-accent/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Localização / Storage Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Localização
              </h3>
              <div className="relative">
                <button
                  onClick={() => setShowLocationMenu(!showLocationMenu)}
                  className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                  title="Adicionar armazenamento"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Location Dropdown Menu */}
                {showLocationMenu && (
                  <div className="absolute left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-30 p-1 space-y-0.5 text-xs animate-in fade-in">
                    <button
                      onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors font-medium"
                    >
                      Novo armazenamento local
                    </button>
                    <button
                      onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                    >
                      Conectar ao Google Drive
                    </button>
                    <button
                      onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                    >
                      Conectar Dropbox
                    </button>
                    <button
                      onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                    >
                      Conectar ao OneDrive
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent/80 transition-colors"
                    >
                      Conectar armazenamento de rede
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mounted Disks List */}
            <div className="space-y-1.5">
              {storages.map((st, idx) => {
                const { usedGB, totalGB, pct } = formatStorageSpace(st.used_bytes, st.total_bytes);
                const isActive = currentPath.startsWith(st.mount_point);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentPath(st.mount_point);
                      setIsStorageDrawerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-orbit-500/10 border-orbit-500/30 text-orbit-400'
                        : 'bg-accent/20 border-border hover:bg-accent/50 text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <HardDrive className="w-4 h-4 shrink-0 text-orbit-400" />
                      <span className="text-xs font-semibold truncate">{st.name}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 85 ? 'bg-rose-500' : 'bg-orbit-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-secondary font-mono">
                      <span>{usedGB} GB / {totalGB} GB</span>
                      <span>{pct}%</span>
                    </div>
                  </button>
                );
              })}

              {/* Connected Cloud Accounts */}
              {cloudAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    if (acc.mount_point) setCurrentPath(acc.mount_point);
                    setIsStorageDrawerOpen(false);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-border bg-accent/20 hover:bg-accent/50 text-primary transition-all flex items-center gap-2.5"
                >
                  <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs font-medium truncate">{acc.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Shortcuts */}
        <div className="pt-4 border-t border-border space-y-1">
          <button
            onClick={() => {
              setCurrentPath(shortcuts.root || '/');
              setIsStorageDrawerOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-accent/60 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Sistema Raiz</span>
          </button>
        </div>
      </aside>

      {/* MAIN BROWSER AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/50 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 sm:h-16 px-3 sm:px-6 border-b border-border bg-card/40 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile Toggle Locations Button */}
            <button
              onClick={() => setIsStorageDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-accent/50 text-secondary hover:text-primary transition-colors flex items-center gap-1 text-xs shrink-0 border border-border"
              aria-label="Abrir locais de armazenamento"
            >
              <HardDrive className="w-4 h-4 text-orbit-400" />
              <span className="hidden sm:inline">Locais</span>
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 text-xs sm:text-sm scrollbar-none font-medium min-w-0">
              {breadcrumbSegments().map((crumb, idx, arr) => (
                <React.Fragment key={crumb.path}>
                  <button
                    onClick={() => setCurrentPath(crumb.path)}
                    className={`hover:text-orbit-400 transition-colors px-1 py-0.5 sm:px-1.5 sm:py-1 rounded-lg truncate max-w-[100px] sm:max-w-[160px] ${
                      idx === arr.length - 1 ? 'text-primary font-semibold' : 'text-secondary'
                    }`}
                  >
                    {crumb.label}
                  </button>
                  {idx < arr.length - 1 && (
                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-600 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Search, Action Toolbar, View Mode Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative w-28 xs:w-36 sm:w-44 md:w-56">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3.5 py-1.5 rounded-xl bg-accent/40 border border-border text-xs text-primary placeholder-zinc-500 focus:outline-none focus:border-orbit-500 transition-colors"
              />
            </div>

            {/* Clipboard Paste button */}
            {clipboard && (
              <button
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 hover:bg-orbit-500/20 text-xs font-medium transition-colors animate-in fade-in"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Colar ({clipboard.items.length})</span>
              </button>
            )}

            {/* Carregar ou Criar Button with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCreateMenu(!showCreateMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-500 text-white hover:bg-orbit-600 active:scale-95 shadow-md shadow-orbit-500/20 text-xs font-medium transition-all"
              >
                <span>Carregar ou criar</span>
                <ChevronDown className="w-3.5 h-3.5" />
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
                    <span>Carregar arquivo</span>
                  </button>
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

            {/* View Mode Toggle */}
            <button
              data-testid="view-mode-toggle"
              onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
              className="p-2 rounded-xl border border-border bg-card text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              title={viewMode === 'grid' ? 'Modo Lista' : 'Modo Grade'}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Selected Batch Action Bar */}
        {selectedItems.length > 0 && (
          <div className="px-6 py-2 bg-orbit-500/10 border-b border-orbit-500/20 flex items-center justify-between text-xs text-orbit-400 animate-in fade-in">
            <span>{selectedItems.length} item(s) selecionado(s)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(selectedItems)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-primary hover:bg-accent transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> <span>Copiar</span>
              </button>
              <button
                onClick={() => handleCut(selectedItems)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-primary hover:bg-accent transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" /> <span>Cortar</span>
              </button>
              <button
                onClick={() => {
                  setOpTargetItem(null);
                  setOpModalType('delete');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span>Excluir</span>
              </button>
            </div>
          </div>
        )}

        {/* File Browser Body */}
        <div className="flex-1 p-6 overflow-y-auto relative">
          {isDraggingOver && (
            <div className="absolute inset-4 z-40 border-2 border-dashed border-orbit-500 bg-orbit-500/10 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none animate-in fade-in">
              <Upload className="w-12 h-12 text-orbit-400 animate-bounce" />
              <p className="font-semibold text-primary text-base">Solte os arquivos aqui para carregar</p>
            </div>
          )}

          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-400" />
              <span className="text-sm">Carregando diretório...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary py-16">
              <Folder className="w-12 h-12 stroke-[1.5] text-zinc-600" />
              <p className="text-sm font-medium">Pasta vazia</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-orbit-400 hover:underline"
              >
                Carregar arquivos para esta pasta
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {filteredFiles.map((item) => {
                const isSelected = selectedItems.some(i => i.path === item.path);
                return (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (selectedItems.some(i => i.path === item.path)) {
                        setSelectedItems(selectedItems.filter(i => i.path !== item.path));
                      } else {
                        setSelectedItems([...selectedItems, item]);
                      }
                    }}
                    onDoubleClick={() => handleItemClick(item)}
                    className={`group relative flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orbit-500/15 border-orbit-500/40 ring-2 ring-orbit-500/30'
                        : 'bg-card/70 border-border hover:bg-card hover:border-zinc-700 hover:shadow-lg'
                    }`}
                  >
                    {/* Item Icon */}
                    <div className="mb-2 p-2 rounded-xl transition-transform group-hover:scale-105">
                      {getFileIcon(item)}
                    </div>

                    {/* Item Name */}
                    <span 
                      className="w-full text-center text-xs font-medium text-primary truncate px-1"
                      title={item.name}
                    >
                      {item.name}
                    </span>

                    {/* Item Size / Subtitle */}
                    <span className="text-[10px] text-secondary mt-0.5">
                      {item.is_dir ? 'Pasta' : formatSize(item.size)}
                    </span>

                    {/* Quick Hover Actions Menu */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-card/90 rounded-lg p-0.5 shadow-sm border border-border">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        className="p-1 rounded text-secondary hover:text-primary hover:bg-accent/80"
                        title="Abrir"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
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
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-accent/40 text-secondary border-b border-border select-none">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Nome</th>
                    <th className="py-3 px-4 font-semibold">Tamanho</th>
                    <th className="py-3 px-4 font-semibold">Modificado</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFiles.map((item) => {
                    const isSelected = selectedItems.some(i => i.path === item.path);
                    return (
                      <tr
                        key={item.path}
                        onClick={() => {
                          if (selectedItems.some(i => i.path === item.path)) {
                            setSelectedItems(selectedItems.filter(i => i.path !== item.path));
                          } else {
                            setSelectedItems([...selectedItems, item]);
                          }
                        }}
                        onDoubleClick={() => handleItemClick(item)}
                        className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-orbit-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 flex items-center gap-3">
                          <div className="shrink-0">{getFileIcon(item)}</div>
                          <span className="font-medium text-primary truncate max-w-xs md:max-w-md">
                            {item.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-secondary font-mono">
                          {item.is_dir ? '-' : formatSize(item.size)}
                        </td>
                        <td className="py-2.5 px-4 text-secondary font-mono">
                          {item.modified ? new Date(item.modified).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              className="p-1 rounded text-secondary hover:text-primary hover:bg-accent"
                              title="Abrir"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item);
                              }}
                              className="p-1 rounded text-secondary hover:text-primary hover:bg-accent"
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
                              className="p-1 rounded text-secondary hover:text-primary hover:bg-accent"
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
          )}
        </div>
      </main>

      {/* MODALS */}
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
