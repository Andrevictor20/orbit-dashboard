import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { IngressRule, DeleteRouteResponse } from '../../types/cloudflare';

interface CloudflareRoutesTableProps {
  rules: IngressRule[];
  isConfigured: boolean;
  onAddRouteClick: () => void;
  onRouteDeleted: (hostname: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  copiedHost: string | null;
}

export function CloudflareRoutesTable({
  rules,
  isConfigured,
  onAddRouteClick,
  onRouteDeleted,
  copyToClipboard,
  copiedHost,
}: CloudflareRoutesTableProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingHost, setDeletingHost] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<IngressRule | null>(null);

  const getAuthHeaders = () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('orbit_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const filteredRules = rules.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.hostname.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      (r.matched_container_name && r.matched_container_name.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (rule: IngressRule) => {
    setDeletingHost(rule.hostname);
    try {
      const res = await fetch('/api/cloudflare/routes', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          hostname: rule.hostname,
          path: rule.path || undefined,
        }),
      });

      const data: DeleteRouteResponse = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || t('cloudflare.route_deleted_success', 'Rota removida com sucesso!'));
        onRouteDeleted(rule.hostname);
        setConfirmDeleteRule(null);
      } else {
        toast.error((data as any).error || t('cloudflare.route_delete_error', 'Falha ao remover rota'));
      }
    } catch {
      toast.error(t('cloudflare.route_delete_error', 'Falha na comunicação com o servidor'));
    } finally {
      setDeletingHost(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm backdrop-blur-md">
      {/* Top bar */}
      <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-primary">
            {t('cloudflare.ingress_table_title', 'Rotas Ingress e Mapeamento de Contêineres')}
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            {t(
              'cloudflare.ingress_table_desc',
              'Regras de roteamento público configuradas no túnel e correspondência automática com contêineres Docker.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder={t('common.search_placeholder', 'Filtrar rotas ou contêineres...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-accent/50 border border-border text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 w-full sm:w-56"
          />

          {isConfigured && (
            <button
              onClick={onAddRouteClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-400 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('cloudflare.btn_new_route', 'Nova Rota')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Rules content */}
      {filteredRules.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <Globe className="w-10 h-10 text-secondary/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-primary">
            {isConfigured
              ? t('cloudflare.no_rules_found', 'Nenhuma rota pública encontrada')
              : t('cloudflare.not_configured_title', 'Túnel ainda não configurado')}
          </h3>
          <p className="text-xs text-secondary max-w-md mx-auto mt-1 mb-4">
            {isConfigured
              ? t('cloudflare.no_rules_desc', 'Crie sua primeira rota clicando no botão "Nova Rota" acima.')
              : t('cloudflare.not_configured_desc', 'Configure seu token Cloudflare para começar a gerenciar rotas.')}
          </p>
          {isConfigured && (
            <button
              onClick={onAddRouteClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-400 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('cloudflare.btn_new_route', 'Nova Rota')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-accent/40 text-secondary uppercase font-mono text-[10px] border-b border-border/60">
              <tr>
                <th className="py-3 px-4 font-bold">{t('cloudflare.col_hostname', 'Hostname Público')}</th>
                <th className="py-3 px-4 font-bold">{t('cloudflare.col_service', 'Serviço Interno')}</th>
                <th className="py-3 px-4 font-bold">{t('cloudflare.col_container', 'Contêiner Docker')}</th>
                <th className="py-3 px-4 font-bold text-right">{t('common.actions', 'Ações')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredRules.map((rule, idx) => {
                const isCopied = copiedHost === rule.hostname;
                const isMatched = Boolean(rule.matched_container_id);

                return (
                  <tr key={`${rule.hostname}-${idx}`} className="hover:bg-accent/30 transition-colors">
                    {/* Public Hostname */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-orbit-500 shrink-0" />
                        <a
                          href={rule.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:text-orbit-500 flex items-center gap-1 group font-mono transition-colors"
                        >
                          <span>{rule.hostname}</span>
                          {rule.path && (
                            <span className="text-secondary font-normal">{rule.path}</span>
                          )}
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>
                    </td>

                    {/* Internal Service */}
                    <td className="py-3.5 px-4 font-mono text-secondary">
                      <span className="px-2 py-0.5 rounded-md bg-accent/60 border border-border/60 text-[11px]">
                        {rule.service}
                      </span>
                    </td>

                    {/* Matched Container */}
                    <td className="py-3.5 px-4">
                      {isMatched ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-primary font-mono text-xs">
                            {rule.matched_container_name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            {t('cloudflare.link_synced', 'Vinculado')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-secondary/60 text-[11px] italic">
                          {t('cloudflare.no_container_matched', 'Sem contêiner detectado')}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => copyToClipboard(rule.public_url, rule.hostname)}
                          className="p-1.5 rounded-lg border border-border/60 bg-accent/40 hover:bg-accent text-secondary hover:text-primary active:scale-[0.98] transition-all"
                          title={t('common.copy_url', 'Copiar URL')}
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <a
                          href={rule.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border/60 bg-accent/40 hover:bg-accent text-secondary hover:text-primary active:scale-[0.98] transition-all"
                          title={t('common.open_link', 'Abrir Link')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => setConfirmDeleteRule(rule)}
                          className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-500 hover:text-rose-600 active:scale-[0.98] transition-all"
                          title={t('cloudflare.delete_route', 'Excluir Rota')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Confirmation Modal for Deletion */}
      {confirmDeleteRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">
                  {t('cloudflare.confirm_delete_title', 'Remover Rota Ingress?')}
                </h3>
                <p className="text-xs text-secondary mt-1">
                  {t('cloudflare.confirm_delete_desc', 'Tem certeza que deseja remover a rota para')} <span className="font-mono text-primary font-bold">{confirmDeleteRule.hostname}</span>? {t('cloudflare.confirm_delete_warning', 'O tráfego externo para este domínio será interrompido.')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                onClick={() => setConfirmDeleteRule(null)}
                disabled={deletingHost !== null}
                className="px-4 py-2 rounded-xl border border-border/70 bg-card hover:bg-accent text-secondary hover:text-primary text-xs font-semibold transition-all"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteRule)}
                disabled={deletingHost !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {deletingHost === confirmDeleteRule.hostname ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{t('common.delete', 'Excluir')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
