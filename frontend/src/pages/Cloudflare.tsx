import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cloud,
  Globe,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Settings,
  Key,
  Server,
  Zap,
  Sparkles,
  Trash2,
  Loader2,
  Box,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  CloudflareConfigResponse,
  CloudflareTunnelsResponse,
  SaveCloudflareConfigRequest,
} from '../types/cloudflare';

export function Cloudflare() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<CloudflareConfigResponse | null>(null);
  const [tunnelsData, setTunnelsData] = useState<CloudflareTunnelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copiedHost, setCopiedHost] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tunnelId, setTunnelId] = useState('');
  const [autoSync, setAutoSync] = useState(true);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [configRes, tunnelsRes] = await Promise.all([
        fetch('/api/cloudflare/config'),
        fetch('/api/cloudflare/tunnels'),
      ]);

      if (configRes.ok) {
        const cfg: CloudflareConfigResponse = await configRes.json();
        setConfig(cfg);
        setAccountId(cfg.account_id || '');
        setTunnelId(cfg.tunnel_id || '');
        setAutoSync(cfg.auto_sync_links ?? true);
        if (cfg.api_token) {
          setApiToken(cfg.api_token);
        }
      }

      if (tunnelsRes.ok) {
        const tun: CloudflareTunnelsResponse = await tunnelsRes.json();
        setTunnelsData(tun);
      }
    } catch {
      toast.error(t('cloudflare.fetch_error', 'Falha ao carregar dados do Cloudflare'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyDetected = () => {
    if (!config?.detected) return;
    if (config.detected.account_id) {
      setAccountId(config.detected.account_id);
    }
    if (config.detected.tunnel_id) {
      setTunnelId(config.detected.tunnel_id);
    }
    setShowConfig(true);
    toast.success(
      t(
        'cloudflare.detected_applied',
        'Credenciais detectadas do contêiner aplicadas aos campos!'
      )
    );
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: SaveCloudflareConfigRequest = {
        account_id: accountId.trim(),
        tunnel_id: tunnelId.trim(),
        auto_sync_links: autoSync,
        enabled: true,
      };

      // Only send api_token if user edited it (not masked placeholder)
      if (apiToken && !apiToken.includes('••••')) {
        payload.api_token = apiToken.trim();
      }

      const res = await fetch('/api/cloudflare/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t('cloudflare.config_saved', 'Configurações salvas com sucesso!'));
        setShowConfig(false);
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('cloudflare.save_failed', 'Erro ao salvar configuração'));
      }
    } catch {
      toast.error(t('cloudflare.save_failed', 'Erro ao salvar configuração'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!window.confirm(t('cloudflare.confirm_delete', 'Deseja remover as credenciais do Cloudflare salvas?'))) {
      return;
    }
    try {
      const res = await fetch('/api/cloudflare/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('cloudflare.config_deleted', 'Configuração removida'));
        setApiToken('');
        setAccountId('');
        setTunnelId('');
        await loadData();
      }
    } catch {
      toast.error(t('cloudflare.delete_failed', 'Falha ao remover configuração'));
    }
  };

  const handleSyncLinks = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/cloudflare/sync-links', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          t('cloudflare.synced_success', '{{count}} links de contêineres sincronizados com sucesso!', {
            count: data.synced_count,
          })
        );
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('cloudflare.sync_failed', 'Erro ao sincronizar links'));
      }
    } catch {
      toast.error(t('cloudflare.sync_failed', 'Erro ao sincronizar links'));
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string, host: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHost(host);
    toast.success(t('common.copied', 'Copiado para a área de transferência!'));
    setTimeout(() => setCopiedHost(null), 2000);
  };

  const rules = tunnelsData?.rules || [];
  const status = tunnelsData?.status;

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (r) =>
        r.hostname.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q) ||
        r.matched_container_name?.toLowerCase().includes(q)
    );
  }, [rules, searchQuery]);

  const matchedCount = useMemo(() => {
    return rules.filter((r) => r.matched_container_id).length;
  }, [rules]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
        <p className="text-sm text-secondary font-medium">
          {t('cloudflare.loading', 'Carregando túneis e rotas do Cloudflare...')}
        </p>
      </div>
    );
  }

  const isConfigured = config?.configured || Boolean(config?.detected?.account_id);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shadow-sm">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                Cloudflare Tunnels
              </h1>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('common.connected', 'Conectado')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-secondary border border-zinc-500/20">
                  {t('common.disconnected', 'Desconectado')}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-secondary mt-0.5">
              {t(
                'cloudflare.subtitle',
                'Acesso externo seguro Zero Trust com resolução e preenchimento automático de URLs para seus contêineres.'
              )}
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          {rules.length > 0 && (
            <button
              onClick={handleSyncLinks}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-400 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-sm focus:outline-none"
              title={t('cloudflare.sync_tooltip', 'Sincronizar links públicos com os cards de contêineres')}
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{t('cloudflare.sync_button', 'Sincronizar Links')}</span>
            </button>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/70 bg-card/60 hover:bg-card text-secondary hover:text-primary active:scale-[0.98] text-xs font-semibold transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t('common.settings', 'Configurar')}</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-border/70 bg-card/60 hover:bg-card text-secondary hover:text-primary active:scale-[0.98] transition-all shadow-sm"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orbit-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Auto-detected Container Banner */}
      {config?.detected && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-primary">
                  {t('cloudflare.detected_title', 'Contêiner cloudflared detectado no Docker!')}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {config.detected.container_name}
                </span>
              </div>
              <p className="text-xs text-secondary mt-1 max-w-2xl">
                {t(
                  'cloudflare.detected_desc',
                  'Identificamos seu túnel local em execução. As identificações de Conta e Túnel foram extraídas automaticamente.'
                )}
              </p>
              {config.detected.local_config_path && (
                <div className="mt-1.5 text-[11px] font-mono text-secondary/80 flex items-center gap-1.5">
                  <Server className="w-3 h-3" />
                  <span>Config: {config.detected.local_config_path}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleApplyDetected}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>{t('cloudflare.apply_detected', 'Preencher Credenciais')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Configuration Form Card (Collapsible) */}
      {showConfig && (
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-orbit-500" />
              <h2 className="text-sm font-bold text-primary">
                {t('cloudflare.config_section_title', 'Credenciais e Conexão da Cloudflare')}
              </h2>
            </div>
            {config?.configured && (
              <button
                type="button"
                onClick={handleDeleteConfig}
                className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('cloudflare.clear_credentials', 'Desconectar Túnel')}</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-secondary mb-1">
                  Account ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 8a4c9e83..."
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary mb-1">
                  Tunnel ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 6ff42887-865e-4658-b612-..."
                  value={tunnelId}
                  onChange={(e) => setTunnelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-secondary">
                  API Token (Cloudflare Zero Trust)
                </label>
                <span className="text-[11px] text-secondary/70">
                  Permissão: Account &gt; Cloudflare Tunnel &gt; Read
                </span>
              </div>
              <input
                type="password"
                placeholder={config?.has_api_token ? '••••••••••••••••' : 'Cole seu token da API aqui'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-border text-orbit-500 focus:ring-orbit-500"
                />
                <span className="text-xs text-secondary font-medium">
                  {t(
                    'cloudflare.auto_sync_label',
                    'Sincronizar automaticamente links públicos com os contêineres detectados'
                  )}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('common.save', 'Salvar Alterações')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Overview Metric Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm backdrop-blur-md">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider block">
            {t('cloudflare.metric_status', 'Status')}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status?.connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'
              }`}
            />
            <span className="text-base sm:text-lg font-bold text-primary">
              {status?.connected
                ? t('common.active', 'Ativo')
                : t('common.offline', 'Indisponível')}
            </span>
          </div>
          <span className="text-[11px] text-secondary/70 mt-1 block">
            {status?.mode === 'remote'
              ? 'API Cloudflare Zero Trust'
              : status?.mode === 'local'
              ? 'Arquivo config.yml local'
              : 'Não configurado'}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm backdrop-blur-md">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider block">
            {t('cloudflare.metric_tunnel_name', 'Túnel')}
          </span>
          <div className="mt-2 flex items-center gap-1.5 truncate">
            <span className="text-base sm:text-lg font-bold text-primary truncate font-mono">
              {status?.tunnel_name || (status?.tunnel_id ? `${status.tunnel_id.substring(0, 8)}...` : '—')}
            </span>
          </div>
          <span className="text-[11px] text-secondary/70 mt-1 block font-mono truncate">
            {status?.account_id ? `Conta: ${status.account_id.substring(0, 8)}...` : 'Sem conta'}
          </span>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm backdrop-blur-md">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider block">
            {t('cloudflare.metric_public_routes', 'Rotas Públicas')}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Globe className="w-5 h-5 text-orbit-500" />
            <span className="text-xl sm:text-2xl font-black text-primary font-mono">
              {rules.length}
            </span>
          </div>
          <span className="text-[11px] text-secondary/70 mt-1 block">
            {t('cloudflare.metric_active_hostnames', 'Domínios expostos')}
          </span>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm backdrop-blur-md">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider block">
            {t('cloudflare.metric_linked_containers', 'Contêineres Vinculados')}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Box className="w-5 h-5 text-emerald-500" />
            <span className="text-xl sm:text-2xl font-black text-primary font-mono">
              {matchedCount} <span className="text-xs font-normal text-secondary">/ {rules.length}</span>
            </span>
          </div>
          <span className="text-[11px] text-secondary/70 mt-1 block">
            {config?.auto_sync_links
              ? t('cloudflare.auto_sync_on', 'Auto-sync ativado')
              : t('cloudflare.auto_sync_off', 'Auto-sync pausado')}
          </span>
        </div>
      </div>

      {/* Error alert if fetch error */}
      {status?.error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-500">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">{t('cloudflare.api_warning', 'Aviso da API Cloudflare')}</p>
            <p className="mt-0.5 opacity-90">{status.error}</p>
          </div>
        </div>
      )}

      {/* Ingress Rules Table Card */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm backdrop-blur-md">
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

          <input
            type="text"
            placeholder={t('common.search_placeholder', 'Filtrar rotas ou contêineres...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-accent/50 border border-border text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 w-full sm:w-64"
          />
        </div>

        {filteredRules.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Globe className="w-10 h-10 text-secondary/40 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-primary">
              {isConfigured
                ? t('cloudflare.no_rules_found', 'Nenhuma rota pública encontrada')
                : t('cloudflare.not_configured_title', 'Túnel ainda não configurado')}
            </h3>
            <p className="text-xs text-secondary max-w-md mx-auto mt-1">
              {isConfigured
                ? t('cloudflare.no_rules_desc', 'Certifique-se de que o túnel possui rotas Ingress configuradas no Zero Trust Dashboard.')
                : t('cloudflare.not_configured_desc', 'Clique em "Configurar" acima para fornecer seu Token da API Cloudflare ou aplicar as credenciais do contêiner detectado.')}
            </p>
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
    </div>
  );
}

export default Cloudflare;
