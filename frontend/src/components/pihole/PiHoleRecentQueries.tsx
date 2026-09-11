import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, ShieldAlert, ShieldCheck, Check, Clock } from 'lucide-react';
import type { PiHoleRecentQueryItem } from '../../types/pihole';

interface PiHoleRecentQueriesProps {
  queries?: PiHoleRecentQueryItem[];
  onAddDomain: (domain: string, listType: 'white' | 'black') => Promise<void>;
  loading: boolean;
}

export function PiHoleRecentQueries({
  queries = [],
  onAddDomain,
  loading,
}: PiHoleRecentQueriesProps) {
  const { t } = useTranslation();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const handleAction = async (domain: string, listType: 'white' | 'black') => {
    try {
      setActionInProgress(`${domain}:${listType}`);
      await onAddDomain(domain, listType);
      setActionDone(`${domain}:${listType}`);
      setTimeout(() => setActionDone(null), 2000);
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            {t('pihole.query_status_blocked')}
          </span>
        );
      case 'cached':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {t('pihole.query_status_cached')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            {t('pihole.query_status_forwarded')}
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">{t('pihole.recent_queries_title')}</h3>
            <p className="text-xs text-secondary">{t('pihole.recent_queries_desc')}</p>
          </div>
        </div>
        {queries.length > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {queries.length} {t('pihole.recent_records')}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
        ) : queries.length === 0 ? (
          <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/40 text-secondary text-[11px]">
                  <th className="py-2.5 px-3 font-medium">{t('pihole.col_time')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('pihole.col_type')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('pihole.col_domain')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('pihole.col_client')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('pihole.col_status')}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{t('pihole.col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {queries.map((q, idx) => {
                  const isBlocked = q.status.toLowerCase() === 'blocked';
                  const targetList = isBlocked ? 'white' : 'black';
                  const actionKey = `${q.domain}:${targetList}`;
                  const isActing = actionInProgress === actionKey;
                  const isSuccess = actionDone === actionKey;

                  return (
                    <tr key={`${q.domain}-${q.timestamp}-${idx}`} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-secondary font-mono flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {q.time}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-border/50 text-primary">
                          {q.query_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-primary font-medium truncate max-w-[200px] md:max-w-xs" title={q.domain}>
                        {q.domain}
                      </td>
                      <td className="py-2.5 px-3 text-secondary font-mono whitespace-nowrap">
                        {q.client}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(q.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleAction(q.domain, targetList)}
                          disabled={isActing || isSuccess}
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all active:scale-95 disabled:opacity-50 ${
                            isBlocked
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title={isBlocked ? t('pihole.action_whitelist') : t('pihole.action_blacklist')}
                        >
                          {isSuccess ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>{t('pihole.added')}</span>
                            </>
                          ) : isBlocked ? (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              <span>{t('pihole.allow_action')}</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3 h-3" />
                              <span>{t('pihole.block_action')}</span>
                            </>
                          )}
                        </button>
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
