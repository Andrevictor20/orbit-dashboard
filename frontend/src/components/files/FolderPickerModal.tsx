import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Folder, 
  FolderOpen, 
  FolderPlus, 
  ChevronRight, 
  ArrowUp, 
  Check, 
  X, 
  Loader2, 
  HardDrive, 
  AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  initialPath?: string;
  title?: string;
}

interface DirItem {
  name: string;
  path: string;
  is_dir: boolean;
}

export function FolderPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialPath = '/app/data',
  title
}: FolderPickerModalProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '/');
  const [folders, setFolders] = useState<DirItem[]>([]);
  const [storages, setStorages] = useState<{ name: string; mount_point: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const getAuthHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem('orbit_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const loadDirectories = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(t('folder_picker.load_error', 'Não foi possível acessar este diretório'));
      }

      const data = await res.json();
      const rawItems: any[] = data.items || [];
      const dirOnly = rawItems
        .filter((item) => item.is_dir)
        .map((item) => ({
          name: item.name,
          path: item.path || (path.endsWith('/') ? `${path}${item.name}` : `${path}/${item.name}`),
          is_dir: true
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setFolders(dirOnly);
      if (data.current_path) {
        setCurrentPath(data.current_path);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar diretórios');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, t]);

  // Load mount points / storages once
  useEffect(() => {
    if (!isOpen) return;
    const fetchStorages = async () => {
      try {
        const res = await fetch('/api/files/storages', {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.mounts)) {
            const mapped = data.mounts.map((m: any) => ({
              name: m.name || m.mount_point,
              mount_point: m.mount_point
            }));
            setStorages(mapped);
          }
        }
      } catch {
        // Ignored
      }
    };
    fetchStorages();
  }, [isOpen, getAuthHeaders]);

  // Load initial path on open
  useEffect(() => {
    if (isOpen) {
      const start = initialPath && initialPath.trim().startsWith('/') ? initialPath.trim() : '/';
      setCurrentPath(start);
      loadDirectories(start);
      setCreatingFolder(false);
      setNewFolderName('');
    }
  }, [isOpen, initialPath, loadDirectories]);

  const handleNavigateUp = () => {
    if (currentPath === '/' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parent = '/' + parts.join('/');
    setCurrentPath(parent || '/');
    loadDirectories(parent || '/');
  };

  const handleNavigateTo = (targetPath: string) => {
    const clean = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    setCurrentPath(clean);
    loadDirectories(clean);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    try {
      setLoading(true);
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          path: currentPath,
          name
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao criar diretório');
      }

      toast.success(t('folder_picker.folder_created', 'Pasta criada com sucesso!'));
      setNewFolderName('');
      setCreatingFolder(false);
      loadDirectories(currentPath);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar pasta');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  if (!isOpen) return null;

  // Breadcrumb path segments
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-picker-title"
      >
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-500 border border-orbit-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="folder-picker-title" className="text-base font-bold text-primary tracking-tight">
                {title || t('folder_picker.title', 'Selecionar Pasta no Servidor')}
              </h2>
              <p className="text-xs text-secondary">
                {t('folder_picker.subtitle', 'Navegue pelas pastas do host para mapear o volume de armazenamento.')}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent text-secondary hover:text-primary transition-colors"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Storage Drives */}
        {storages.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 bg-accent/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider mr-1 shrink-0">
              {t('folder_picker.roots', 'Discos')}:
            </span>
            <button
              type="button"
              onClick={() => handleNavigateTo('/')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                currentPath === '/' 
                  ? 'bg-orbit-500 text-white shadow-sm font-bold' 
                  : 'bg-card border border-border/70 text-secondary hover:text-primary hover:bg-accent'
              }`}
            >
              <HardDrive className="w-3 h-3" />
              <span>/ (Raiz)</span>
            </button>
            {storages.map((storage) => (
              <button
                key={storage.mount_point}
                type="button"
                onClick={() => handleNavigateTo(storage.mount_point)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                  currentPath === storage.mount_point || currentPath.startsWith(storage.mount_point + '/')
                    ? 'bg-orbit-500/20 text-orbit-400 border border-orbit-500/40 font-bold' 
                    : 'bg-card border border-border/70 text-secondary hover:text-primary hover:bg-accent'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>{storage.mount_point}</span>
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb Navigation Bar & Actions */}
        <div className="p-3 sm:px-4 border-b border-border bg-accent/30 flex items-center justify-between gap-2">
          {/* Breadcrumb row */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-mono flex-1 py-0.5">
            <button
              type="button"
              onClick={() => handleNavigateTo('/')}
              className="p-1 rounded hover:bg-accent text-secondary hover:text-primary font-bold shrink-0"
              title="Raiz (/)"
            >
              /
            </button>
            {pathParts.map((part, idx) => {
              const fullSegmentPath = '/' + pathParts.slice(0, idx + 1).join('/');
              const isLast = idx === pathParts.length - 1;
              return (
                <div key={idx} className="flex items-center gap-1 shrink-0">
                  <ChevronRight className="w-3 h-3 text-secondary/50 shrink-0" />
                  <button
                    type="button"
                    onClick={() => handleNavigateTo(fullSegmentPath)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      isLast 
                        ? 'bg-card border border-border text-orbit-500 font-bold shadow-xs' 
                        : 'text-secondary hover:text-primary hover:bg-accent'
                    }`}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action buttons: Up & New Folder */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNavigateUp}
              disabled={currentPath === '/' || loading}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-secondary hover:text-primary transition-all disabled:opacity-40"
              title={t('folder_picker.up_dir', 'Subir um nível')}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCreatingFolder(!creatingFolder)}
              className="px-2 py-1 rounded-lg border border-border bg-card hover:bg-accent text-secondary hover:text-primary text-xs font-medium transition-all flex items-center gap-1"
              title={t('folder_picker.new_folder', 'Nova Pasta')}
            >
              <FolderPlus className="w-3.5 h-3.5 text-orbit-500" />
              <span className="hidden sm:inline">{t('folder_picker.new_folder', 'Nova Pasta')}</span>
            </button>
          </div>
        </div>

        {/* Inline Create Folder Form */}
        {creatingFolder && (
          <form onSubmit={handleCreateFolder} className="p-3 border-b border-border bg-orbit-500/5 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder={t('folder_picker.folder_name_placeholder', 'Nome da nova pasta...')}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
            />
            <button
              type="submit"
              disabled={!newFolderName.trim() || loading}
              className="px-3 py-1.5 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('common.create', 'Criar')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
              className="p-1.5 text-secondary hover:text-primary rounded-xl hover:bg-accent transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Folder List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-[260px] max-h-[380px] space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-orbit-500" />
              <span className="text-xs">{t('common.loading', 'Carregando pastas...')}</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-xs text-rose-500 font-medium">{error}</p>
              <button
                type="button"
                onClick={() => handleNavigateTo('/')}
                className="mt-2 text-xs text-orbit-500 hover:underline"
              >
                {t('folder_picker.return_to_root', 'Voltar para a raiz (/)?')}
              </button>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-secondary">
              <Folder className="w-8 h-8 opacity-40" />
              <span className="text-xs">
                {t('folder_picker.empty_folder', 'Nenhuma subpasta encontrada neste diretório.')}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => handleNavigateTo(folder.path)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-accent/70 border border-transparent hover:border-border transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-4 h-4 text-orbit-500 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-mono font-medium text-primary truncate">
                      {folder.name}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-secondary group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Selected Path & Confirmation */}
        <div className="p-4 sm:px-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary shrink-0">
              {t('folder_picker.selected', 'Caminho')}:
            </span>
            <code className="text-xs font-mono bg-card px-2.5 py-1 rounded-lg border border-border text-orbit-500 font-bold truncate max-w-full sm:max-w-xs">
              {currentPath}
            </code>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>

            <button
              type="button"
              onClick={handleConfirmSelect}
              className="px-4 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-orbit-500/20 flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{t('folder_picker.select_this_folder', 'Selecionar Esta Pasta')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
