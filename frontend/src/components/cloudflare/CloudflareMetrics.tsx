import { useTranslation } from 'react-i18next';
import { Globe, Box } from 'lucide-react';
import type { CloudflareStatusResponse } from '../../types/cloudflare';

interface CloudflareMetricsProps {
  status?: CloudflareStatusResponse;
  rulesCount: number;
  matchedCount: number;
  autoSync: boolean;
}

export function CloudflareMetrics({
  status,
  rulesCount,
  matchedCount,
  autoSync,
}: CloudflareMetricsProps) {
  const { t } = useTranslation();

  return (
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
            {rulesCount}
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
            {matchedCount} <span className="text-xs font-normal text-secondary">/ {rulesCount}</span>
          </span>
        </div>
        <span className="text-[11px] text-secondary/70 mt-1 block">
          {autoSync
            ? t('cloudflare.auto_sync_on', 'Auto-sync ativado')
            : t('cloudflare.auto_sync_off', 'Auto-sync pausado')}
        </span>
      </div>
    </div>
  );
}
