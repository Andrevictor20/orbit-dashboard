import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2,
  Unlink,
  Search,
  Check,
  X,
  Loader2,
  Server,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { IngressRule } from '../../types/cloudflare';

interface DockerContainerSummary {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports?: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
}

interface LinkRouteContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: IngressRule | null;
  onSuccess: () => void;
}

export function LinkRouteContainerModal({
  isOpen,
  onClose,
  rule,
  onSuccess,
}: LinkRouteContainerModalProps) {
  const { t } = useTranslation();
  const [containers, setContainers] = useState<DockerContainerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('orbit_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!isOpen || !rule) return;

    setSelectedId(rule.matched_container_id || null);
    setSearch('');
    setLoading(true);

    const fetchContainers = async () => {
      try {
        const res = await fetch('/api/docker/containers', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const data: DockerContainerSummary[] = await res.json();
          setContainers(data);

          // If no matched_container_id was set, try pre-selecting container with matching name
          if (!rule.matched_container_id && rule.matched_container_name) {
            const targetName = rule.matched_container_name.toLowerCase().replace(/^\//, '');
            const found = data.find(c => {
              const cn = (c.names?.[0] || '').toLowerCase().replace(/^\//, '');
              return cn === targetName;
            });
            if (found) {
              setSelectedId(found.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch containers for linking', err);
        toast.error(t('docker.fetch_error', 'Falha ao buscar contêineres Docker'));
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
  }, [isOpen, rule]);

  if (!isOpen || !rule) return null;

  const handleSave = async () => {
    if (!selectedId) {
      toast.error(t('cloudflare.select_container_first', 'Selecione um contêiner para vincular'));
      return;
    }

    setSaving(true);
    try {
      // If there was previously a different container matched, clear its link
      if (rule.matched_container_id && rule.matched_container_id !== selectedId) {
        await fetch(`/api/docker/links/${rule.matched_container_id}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({ url: '' }),
        }).catch(() => {});
      }

      // Link selected container to public_url
      const res = await fetch(`/api/docker/links/${selectedId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ url: rule.public_url }),
      });

      if (res.ok) {
        toast.success(t('cloudflare.link_success', 'Contêiner vinculado à rota com sucesso!'));
        onSuccess();
        onClose();
      } else {
        toast.error(t('cloudflare.link_failed', 'Falha ao salvar vínculo do contêiner'));
      }
    } catch {
      toast.error(t('common.network_error', 'Erro de conexão ao salvar vínculo'));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    const targetId = rule.matched_container_id || selectedId;
    if (!targetId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/docker/links/${targetId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ url: '' }),
      });

      if (res.ok) {
        toast.success(t('cloudflare.unlink_success', 'Vínculo removido com sucesso!'));
        onSuccess();
        onClose();
      } else {
        toast.error(t('cloudflare.unlink_failed', 'Falha ao desvincular contêiner'));
      }
    } catch {
      toast.error(t('common.network_error', 'Erro de conexão ao desvincular'));
    } finally {
      setSaving(false);
    }
  };

  const filteredContainers = containers.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = (c.names?.[0] || '').toLowerCase();
    const img = (c.image || '').toLowerCase();
    const portsStr = (c.ports || [])
      .map(p => `${p.PublicPort || ''}:${p.PrivatePort}`)
      .join(' ');
    return name.includes(q) || img.includes(q) || portsStr.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orbit-500/10 border border-orbit-500/20 flex items-center justify-center text-orbit-500">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">
                {t('cloudflare.link_modal_title', 'Vincular Contêiner à Rota')}
              </h3>
              <p className="text-[11px] text-secondary font-mono">
                {rule.hostname} → {rule.service}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('cloudflare.search_container_placeholder', 'Buscar por nome, imagem ou porta...')}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-accent/40 border border-border/60 text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500/50"
          />
        </div>

        {/* Container List */}
        <div className="mt-3 overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar min-h-[220px]">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-secondary gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-orbit-500" />
              <span>{t('common.loading', 'Carregando contêineres...')}</span>
            </div>
          ) : filteredContainers.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-secondary/60 text-xs">
              <Server className="w-8 h-8 opacity-30 mb-2" />
              <span>{t('cloudflare.no_containers_found', 'Nenhum contêiner correspondente')}</span>
            </div>
          ) : (
            filteredContainers.map(c => {
              const name = (c.names?.[0] || c.id).replace(/^\//, '');
              const isSelected = selectedId === c.id || (selectedId?.length === 12 && c.id.startsWith(selectedId));
              const portsList = (c.ports || [])
                .filter(p => p.PublicPort || p.PrivatePort)
                .map(p => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`));

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-orbit-500/60 bg-orbit-500/10 shadow-sm'
                      : 'border-border/60 bg-accent/20 hover:bg-accent/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${c.state === 'running' ? 'bg-emerald-500' : 'bg-secondary/40'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary font-mono truncate">
                        {name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-secondary mt-0.5 truncate">
                        <span className="truncate max-w-[150px]">{c.image}</span>
                        {portsList.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-accent border border-border/40 font-mono text-[9px]">
                            {portsList.slice(0, 3).join(', ')}
                            {portsList.length > 3 && ` +${portsList.length - 3}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-orbit-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-border/80" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between shrink-0">
          <div>
            {(rule.matched_container_id || rule.matched_container_name) && (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{t('cloudflare.unlink_button', 'Desvincular')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent text-secondary hover:text-primary text-xs font-semibold transition-all"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedId}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('cloudflare.save_link', 'Salvar Vínculo')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
