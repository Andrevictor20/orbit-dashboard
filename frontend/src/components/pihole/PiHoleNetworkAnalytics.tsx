import { useTranslation } from 'react-i18next';
import { BarChart3, Radio } from 'lucide-react';
import type { PiHoleUpstreamItem } from '../../types/pihole';

interface PiHoleNetworkAnalyticsProps {
  queryTypes?: Record<string, number>;
  upstreams?: PiHoleUpstreamItem[];
  loading: boolean;
}

export function PiHoleNetworkAnalytics({
  queryTypes = {},
  upstreams = [],
  loading,
}: PiHoleNetworkAnalyticsProps) {
  const { t } = useTranslation();

  const queryTypeList = Object.entries(queryTypes)
    .sort(([, a], [, b]) => b - a);

  const totalTypeCount = queryTypeList.reduce((acc, [, val]) => acc + val, 0);

  const getTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'A':
        return 'bg-blue-500 text-blue-400 border-blue-500/20';
      case 'AAAA':
        return 'bg-violet-500 text-violet-400 border-violet-500/20';
      case 'HTTPS':
        return 'bg-emerald-500 text-emerald-400 border-emerald-500/20';
      case 'PTR':
        return 'bg-amber-500 text-amber-400 border-amber-500/20';
      case 'SRV':
      case 'TXT':
        return 'bg-pink-500 text-pink-400 border-pink-500/20';
      default:
        return 'bg-zinc-500 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Tipos de Consulta DNS */}
      <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{t('pihole.query_types_title')}</h3>
              <p className="text-xs text-secondary">{t('pihole.query_types_desc')}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
          ) : queryTypeList.length === 0 ? (
            <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
          ) : (
            queryTypeList.map(([type, count]) => {
              const pct = totalTypeCount > 0 ? (count / totalTypeCount) * 100 : 0;
              const colorClass = getTypeColor(type);

              return (
                <div key={type} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border bg-opacity-10 ${colorClass}`}>
                        {type}
                      </span>
                      <span className="text-xs text-secondary font-medium">
                        {count.toLocaleString()} {t('pihole.queries')}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {pct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${colorClass.split(' ')[0]}`}
                      style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Servidores DNS Upstream */}
      <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{t('pihole.upstreams_title')}</h3>
              <p className="text-xs text-secondary">{t('pihole.upstreams_desc')}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
          ) : upstreams.length === 0 ? (
            <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
          ) : (
            upstreams.map((upstream) => (
              <div key={upstream.destination} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-primary truncate">
                      {upstream.name}
                    </p>
                    <span className="text-[10px] text-secondary font-mono">
                      {upstream.destination}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-emerald-500">
                      {upstream.percentage.toFixed(1)}%
                    </span>
                    {upstream.count > 0 && (
                      <span className="text-[10px] text-secondary block">
                        {upstream.count.toLocaleString()} reqs
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(upstream.percentage, 1), 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
