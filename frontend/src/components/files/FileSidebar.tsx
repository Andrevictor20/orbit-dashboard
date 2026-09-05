import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderGit2,
  X,
  Search,
  Share,
  ChevronRight,
  Sparkles,
  Trash2,
  Plus,
  Cloud,
  HardDrive,
  Eye,
  EyeOff,
  RefreshCw,
  Home,
  FileText,
  Download,
  Image as ImageIcon,
  Music,
  Film,
  Folder,
} from 'lucide-react';
import type { MountItem, CloudAccount, ShortcutPlace, TrashItem } from '../../types/fileManager';
import { formatStorage, getFriendlyDiskName } from '../../utils/format';

export const getPlaceIcon = (iconName: string) => {
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

export const getPlaceColorClass = (iconName: string, isActive: boolean) => {
  if (isActive) return 'text-orbit-400';
  switch (iconName.toLowerCase()) {
    case 'documents':
    case 'file-text': return 'text-amber-400';
    case 'downloads':
    case 'download': return 'text-sky-400';
    case 'pictures':
    case 'image': return 'text-violet-400';
    case 'videos':
    case 'film': return 'text-rose-400';
    case 'music': return 'text-emerald-400';
    default: return 'text-secondary';
  }
};

export interface FileSidebarProps {
  isStorageDrawerOpen: boolean;
  setIsStorageDrawerOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setIsCloudModalOpen: (open: boolean) => void;
  places: ShortcutPlace[];
  currentPath: string;
  isTrashView: boolean;
  navigateTo: (path: string) => void;
  navigateToTrash: () => void;
  handleInternalDrop: (e: React.DragEvent, targetPath: string) => void;
  trashItems: TrashItem[];
  showLocationMenu: boolean;
  setShowLocationMenu: React.Dispatch<React.SetStateAction<boolean>>;
  storages: MountItem[];
  cloudAccounts: CloudAccount[];
  handleDisconnectCloud: (id: string, name: string) => void;
  showHiddenFiles: boolean;
  setShowHiddenFiles: React.Dispatch<React.SetStateAction<boolean>>;
  loadFiles: (path: string) => void;
}

export const FileSidebar: React.FC<FileSidebarProps> = ({
  isStorageDrawerOpen,
  setIsStorageDrawerOpen,
  searchQuery,
  setSearchQuery,
  setIsCloudModalOpen,
  places,
  currentPath,
  isTrashView,
  navigateTo,
  navigateToTrash,
  handleInternalDrop,
  trashItems,
  showLocationMenu,
  setShowLocationMenu,
  storages,
  cloudAccounts,
  handleDisconnectCloud,
  showHiddenFiles,
  setShowHiddenFiles,
  loadFiles,
}) => {
  const { t } = useTranslation();

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 w-64 sm:w-72 bg-card border-r border-border/80 flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out ${
        isStorageDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin">
        {/* Sidebar Top: Logo & Instant Search */}
        <div className="space-y-3 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orbit-500/15 border border-orbit-500/30 flex items-center justify-center text-orbit-400 shadow-inner">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-primary">Arquivos</h2>
                <p className="text-[10px] text-secondary">Orbit Storage</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsStorageDrawerOpen(false)}
              className="lg:hidden p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
              aria-label="Fechar gaveta de locais"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary/70 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-background border border-border text-xs text-primary placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500/80 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                data-testid="clear-search-input-btn"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-0.5"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Section: Compartilhamento / Shared */}
        <div>
          <div className="space-y-0.5">
            <button
              onClick={() => {
                setIsCloudModalOpen(true);
                setIsStorageDrawerOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary hover:bg-accent transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Share className="w-4 h-4 text-violet-400 group-hover:scale-105 transition-transform" />
                <span>Compartilhado via Link/Samba</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-secondary/40 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

        {/* Section: Favoritos / Starred Folders */}
        <div>
          <h3 className="text-[11px] font-bold text-secondary uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
            <span>{t('files.favorites')}</span>
            <Sparkles className="w-3 h-3 text-amber-400/70" />
          </h3>
          <div className="space-y-0.5">
            {places.map((place) => {
              const Icon = getPlaceIcon(place.icon);
              const isActive = !isTrashView && currentPath === place.path;
              const colorClass = getPlaceColorClass(place.icon, isActive);
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-orbit-500 text-white font-semibold shadow-md shadow-orbit-500/25'
                      : 'text-secondary hover:text-primary hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : colorClass}`} />
                    <span className="truncate">{place.labelKey ? t(place.labelKey) : (place.label || place.id)}</span>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                </button>
              );
            })}

            {/* Lixeira / Trash Shortcut */}
            <button
              onClick={() => {
                navigateToTrash();
                setIsStorageDrawerOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isTrashView
                  ? 'bg-rose-500 text-white font-semibold shadow-md shadow-rose-500/25'
                  : 'text-secondary hover:text-primary hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Trash2 className={`w-4 h-4 shrink-0 ${isTrashView ? 'text-white' : 'text-rose-400'}`} />
                <span className="truncate">{t('files.trash')}</span>
              </div>
              {trashItems.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isTrashView ? 'bg-white/20 text-white' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {trashItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Section: Unidades de Armazenamento / Storage */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              {t('files.units')}
            </h3>
            <button
              onClick={() => setShowLocationMenu((prev) => !prev)}
              className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
              title="Conectar Nuvem / LAN"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Location Dropdown Menu */}
          {showLocationMenu && (
            <div className="mb-2 p-1 bg-card border border-border/80 rounded-xl shadow-xl text-xs space-y-0.5 animate-in fade-in">
              <button
                onClick={() => { setShowLocationMenu(false); setIsCloudModalOpen(true); }}
                className="w-full text-left px-3 py-2 rounded-lg text-primary hover:bg-accent transition-colors font-medium flex items-center gap-2"
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
                      : 'bg-card border-border/70 hover:bg-accent text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <HardDrive className="w-4 h-4 shrink-0 text-orbit-400" />
                    <span className="text-xs truncate font-medium">{friendlyName}</span>
                  </div>
                  {st.total_bytes > 0 && (
                    <>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1">
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
                      : 'border-border/70 bg-card hover:bg-accent text-primary'
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
                      <span className="text-xs truncate block font-medium">{acc.name}</span>
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

            {/* Add Cloud / LAN Button */}
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-border/70 hover:border-orbit-500/50 hover:bg-accent/60 text-xs text-secondary hover:text-primary transition-all group"
            >
              <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-orbit-400" />
              <span>+ Cloud, LAN ou USB</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Bottom Controls */}
      <div className="pt-3 border-t border-border/60 space-y-1">
        <button
          data-testid="toggle-hidden-btn"
          onClick={() => setShowHiddenFiles((prev) => !prev)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors font-medium ${
            showHiddenFiles
              ? 'bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 font-semibold'
              : 'text-secondary hover:text-primary hover:bg-accent'
          }`}
        >
          <div className="flex items-center gap-2">
            {showHiddenFiles ? <Eye className="w-3.5 h-3.5 text-orbit-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Arquivos ocultos</span>
          </div>
          <span className="text-[10px] text-secondary font-mono">{showHiddenFiles ? 'Visíveis' : 'Ocultos'}</span>
        </button>
        
        <button
          onClick={() => loadFiles(currentPath)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-secondary hover:text-primary hover:bg-accent transition-colors font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar lista</span>
        </button>
      </div>
    </aside>
  );
};
