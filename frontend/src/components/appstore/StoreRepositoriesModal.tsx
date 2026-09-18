import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FolderGit2, 
  X, 
  Plus, 
  Trash2, 
  Globe, 
  ShieldCheck, 
  Loader2, 
  ExternalLink 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  useStoreRepositoriesQuery, 
  useStoreRepositoryMutations, 
  type StoreRepository 
} from '../../queries/useStoreAppsQuery';

export interface StoreRepositoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function StoreRepositoriesModal({
  isOpen,
  onClose,
  onSyncTriggered,
}: StoreRepositoriesModalProps) {
  const { t } = useTranslation();
  const { data: repositories = [], isLoading } = useStoreRepositoriesQuery();
  const { addMutation, removeMutation, toggleMutation } = useStoreRepositoryMutations();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName || !trimmedUrl) {
      toast.error(t('store.repo_fields_required', 'Nome e URL são obrigatórios.'));
      return;
    }

    try {
      setIsAdding(true);
      await addMutation.mutateAsync({ name: trimmedName, url: trimmedUrl });
      toast.success(t('store.repo_added', 'Repositório adicionado com sucesso! Sincronizando...'));
      setName('');
      setUrl('');
      onSyncTriggered?.();
    } catch (err: any) {
      toast.error(err.message || t('store.repo_add_error', 'Erro ao adicionar repositório.'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (repo: StoreRepository) => {
    if (repo.is_official || repo.id === 'official') {
      toast.error(t('store.repo_cannot_remove_official', 'Não é possível remover o repositório oficial.'));
      return;
    }

    try {
      await removeMutation.mutateAsync(repo.id);
      toast.success(t('store.repo_removed', 'Repositório removido com sucesso.'));
      onSyncTriggered?.();
    } catch (err: any) {
      toast.error(err.message || t('store.repo_remove_error', 'Erro ao remover repositório.'));
    }
  };

  const handleToggle = async (repo: StoreRepository) => {
    try {
      const newState = await toggleMutation.mutateAsync(repo.id);
      toast.success(
        newState 
          ? t('store.repo_enabled', 'Repositório ativado.') 
          : t('store.repo_disabled', 'Repositório desativado.')
      );
      onSyncTriggered?.();
    } catch (err: any) {
      toast.error(err.message || t('store.repo_toggle_error', 'Erro ao alterar estado do repositório.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saturn-500/10 border border-saturn-500/20 flex items-center justify-center text-saturn-500">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-primary">
                {t('store.repositories_title', 'Repositórios da Loja')}
              </h2>
              <p className="text-xs text-secondary/80">
                {t('store.repositories_subtitle', 'Gerencie fontes oficiais e lojas comunitárias de aplicativos')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary p-2 rounded-xl hover:bg-accent transition-colors"
            title={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Repositories List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('store.active_repositories', 'Fontes de Catálogo')} ({repositories.length})
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-secondary gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando repositórios...</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {repositories.map((repo) => (
                  <div
                    key={repo.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      repo.enabled
                        ? 'bg-accent/30 border-border/70 hover:border-border'
                        : 'bg-accent/10 border-border/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        {repo.is_official ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-saturn-500/10 border border-saturn-500/20 text-saturn-400 flex items-center justify-center">
                            <Globe className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary truncate">
                            {repo.name}
                          </span>
                          {repo.is_official ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {t('store.official_badge', 'Oficial')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-saturn-500/10 text-saturn-400 border border-saturn-500/20">
                              {t('store.community_badge', 'Comunidade')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary/70 truncate mt-0.5" title={repo.url}>
                          {repo.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Enabled */}
                      <button
                        type="button"
                        onClick={() => handleToggle(repo)}
                        disabled={toggleMutation.isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          repo.enabled ? 'bg-saturn-500' : 'bg-accent border border-border'
                        }`}
                        title={repo.enabled ? 'Desativar repositório' : 'Ativar repositório'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            repo.enabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>

                      {/* Delete (only community) */}
                      {!repo.is_official && repo.id !== 'official' && (
                        <button
                          type="button"
                          onClick={() => handleRemove(repo)}
                          disabled={removeMutation.isPending}
                          className="p-1.5 text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title={t('common.remove', 'Remover')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Repository Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-xl bg-accent/20 border border-border/70 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary">
              <Plus className="w-3.5 h-3.5 text-saturn-500" />
              <span>{t('store.add_repo_title', 'Adicionar Repositório da Comunidade')}</span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('store.repo_name_label', 'Nome do Repositório')}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Minha Loja Homelab / Repositório Comunitário"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-background/80 border border-border rounded-xl text-xs text-primary placeholder:text-secondary/50 focus:outline-none focus:border-saturn-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('store.repo_url_label', 'URL do Catálogo (catalog.json)')}
                </label>
                <input
                  type="url"
                  placeholder="https://raw.githubusercontent.com/user/repo/main/catalog.json"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-background/80 border border-border rounded-xl text-xs text-primary placeholder:text-secondary/50 focus:outline-none focus:border-saturn-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-secondary/60">
                Deve apontar para um arquivo <code className="text-primary font-mono text-[10px] bg-accent px-1 py-0.5 rounded">catalog.json</code> válido.
              </p>
              <button
                type="submit"
                disabled={isAdding || !name.trim() || !url.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-saturn-500 text-white hover:bg-saturn-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adicionando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('store.add_repo_button', 'Adicionar Fonte')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/70 bg-accent/20 flex items-center justify-between">
          <a
            href="https://github.com/Andrevictor20/saturn-apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-saturn-400 hover:text-saturn-300 flex items-center gap-1.5 transition-colors"
          >
            <span>Ver repositório oficial saturn-apps</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent text-secondary hover:text-primary hover:bg-accent/80 text-xs font-medium transition-colors"
          >
            {t('common.done', 'Concluído')}
          </button>
        </div>
      </div>
    </div>
  );
}
