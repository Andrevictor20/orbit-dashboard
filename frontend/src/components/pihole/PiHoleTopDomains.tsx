import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ShieldAlert, ShieldCheck, Check } from 'lucide-react';

interface PiHoleTopDomainsProps {
  topQueries?: Record<string, number>;
  topAds?: Record<string, number>;
  onAddDomain: (domain: string, listType: 'white' | 'black') => Promise<void>;
  loading: boolean;
}

export function PiHoleTopDomains({
  topQueries = {},
  topAds = {},
  onAddDomain,
  loading,
}: PiHoleTopDomainsProps) {
  const { t } = useTranslation();
  const [addingDomain, setAddingDomain] = useState<string | null>(null);
  const [addedDomain, setAddedDomain] = useState<string | null>(null);

  const handleAction = async (domain: string, listType: 'white' | 'black') => {
    try {
      setAddingDomain(`${domain}:${listType}`);
      await onAddDomain(domain, listType);
      setAddedDomain(`${domain}:${listType}`);
      setTimeout(() => setAddedDomain(null), 2000);
    } finally {
      setAddingDomain(null);
    }
  };

  const queriesList = Object.entries(topQueries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7);

  const adsList = Object.entries(topAds)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Permitted Domains */}
      <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{t('pihole.top_queries_title')}</h3>
              <p className="text-xs text-secondary">{t('pihole.top_queries_desc')}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
          ) : queriesList.length === 0 ? (
            <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
          ) : (
            queriesList.map(([domain, count]) => {
              const actionKey = `${domain}:black`;
              const isAdding = addingDomain === actionKey;
              const isAdded = addedDomain === actionKey;

              return (
                <div
                  key={domain}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <p className="text-xs font-medium text-primary truncate font-mono">{domain}</p>
                    <span className="text-[10px] text-secondary">{count.toLocaleString()} {t('pihole.queries')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAction(domain, 'black')}
                    disabled={isAdding || isAdded}
                    className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                    title={t('pihole.action_blacklist')}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">{t('pihole.added')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3" />
                        <span>{t('pihole.block_action')}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top Blocked Domains */}
      <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{t('pihole.top_ads_title')}</h3>
              <p className="text-xs text-secondary">{t('pihole.top_ads_desc')}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
          ) : adsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
          ) : (
            adsList.map(([domain, count]) => {
              const actionKey = `${domain}:white`;
              const isAdding = addingDomain === actionKey;
              const isAdded = addedDomain === actionKey;

              return (
                <div
                  key={domain}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <p className="text-xs font-medium text-primary truncate font-mono">{domain}</p>
                    <span className="text-[10px] text-secondary">{count.toLocaleString()} {t('pihole.blocked')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAction(domain, 'white')}
                    disabled={isAdding || isAdded}
                    className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                    title={t('pihole.action_whitelist')}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">{t('pihole.added')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        <span>{t('pihole.allow_action')}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
