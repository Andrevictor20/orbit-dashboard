import { useTranslation } from 'react-i18next';
import { Laptop, Smartphone, Server, Users } from 'lucide-react';
import type { PiHoleClientItem } from '../../types/pihole';

interface PiHoleTopClientsProps {
  clients?: PiHoleClientItem[];
  loading: boolean;
}

export function PiHoleTopClients({ clients = [], loading }: PiHoleTopClientsProps) {
  const { t } = useTranslation();

  const getDeviceIcon = (name: string, ip: string) => {
    const combined = `${name} ${ip}`.toLowerCase();
    if (combined.includes('iphone') || combined.includes('android') || combined.includes('phone') || combined.includes('mobile')) {
      return <Smartphone className="w-4 h-4 text-violet-400" />;
    }
    if (combined.includes('server') || combined.includes('nas') || combined.includes('orbit') || combined.includes('gateway') || ip === '127.0.0.1') {
      return <Server className="w-4 h-4 text-amber-400" />;
    }
    return <Laptop className="w-4 h-4 text-blue-400" />;
  };

  const topList = clients.slice(0, 7);

  return (
    <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">{t('pihole.top_clients_title')}</h3>
            <p className="text-xs text-secondary">{t('pihole.top_clients_desc')}</p>
          </div>
        </div>
        {topList.length > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {topList.length} {t('pihole.clients_shown')}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-secondary">{t('common.loading')}</div>
        ) : topList.length === 0 ? (
          <div className="py-8 text-center text-xs text-secondary">{t('pihole.no_data')}</div>
        ) : (
          topList.map((client) => {
            const hasCustomName = client.name && client.name !== client.ip;

            return (
              <div
                key={client.ip}
                className="p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      {getDeviceIcon(client.name, client.ip)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary truncate">
                        {hasCustomName ? client.name : client.ip}
                      </p>
                      {hasCustomName && (
                        <span className="text-[10px] text-secondary font-mono block truncate">
                          {client.ip}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {client.count.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-secondary ml-1.5">
                      ({client.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Percentage progress bar */}
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(client.percentage, 1), 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
