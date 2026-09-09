import { useTranslation } from 'react-i18next';
import { Activity, ShieldCheck, Percent, Database, Users } from 'lucide-react';
import type { PiHoleStats } from '../../types/pihole';

interface PiHoleStatsCardsProps {
  stats: PiHoleStats | null;
  loading: boolean;
}

export function PiHoleStatsCards({ stats, loading }: PiHoleStatsCardsProps) {
  const { t } = useTranslation();

  const totalQueries = stats?.dns_queries_today ?? 0;
  const adsBlocked = stats?.ads_blocked_today ?? 0;
  const adsPercentage = stats?.ads_percentage_today ?? 0;
  const domainsBlocked = stats?.domains_being_blocked ?? 0;
  const uniqueClients = stats?.unique_clients ?? stats?.clients_ever_seen ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total DNS Queries */}
      <div className="relative overflow-hidden rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 transition-all duration-200 hover:border-orbit-500/30 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            {t('pihole.stats_total_queries')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-primary">
            {loading ? '...' : totalQueries.toLocaleString()}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-secondary">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {loading ? '...' : `${uniqueClients} ${t('pihole.stats_active_clients')}`}
          </span>
        </div>
      </div>

      {/* 2. Queries Blocked */}
      <div className="relative overflow-hidden rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 transition-all duration-200 hover:border-orbit-500/30 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            {t('pihole.stats_queries_blocked')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-rose-500">
            {loading ? '...' : adsBlocked.toLocaleString()}
          </span>
        </div>
        <div className="mt-3 text-xs text-secondary">
          <span>{t('pihole.stats_queries_blocked_desc')}</span>
        </div>
      </div>

      {/* 3. Percentage Blocked */}
      <div className="relative overflow-hidden rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 transition-all duration-200 hover:border-orbit-500/30 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            {t('pihole.stats_percent_blocked')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-amber-500">
            {loading ? '...' : `${adsPercentage.toFixed(1)}%`}
          </span>
        </div>
        <div className="mt-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(Math.max(adsPercentage, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* 4. Blocklist Domains (Gravity) */}
      <div className="relative overflow-hidden rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 transition-all duration-200 hover:border-orbit-500/30 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            {t('pihole.stats_blocklist_count')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <Database className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-emerald-500">
            {loading ? '...' : domainsBlocked.toLocaleString()}
          </span>
        </div>
        <div className="mt-3 text-xs text-secondary">
          <span>{t('pihole.stats_gravity_list')}</span>
        </div>
      </div>
    </div>
  );
}
