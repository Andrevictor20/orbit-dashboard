import { useTranslation } from 'react-i18next';
import { Cloud, Zap, Settings, RefreshCw, Loader2, Plus } from 'lucide-react';
import type { CloudflareStatusResponse } from '../../types/cloudflare';

interface CloudflareHeaderProps {
  status?: CloudflareStatusResponse;
  isConfigured: boolean;
  rulesCount: number;
  syncing: boolean;
  refreshing: boolean;
  showConfig: boolean;
  onSyncLinks: () => void;
  onToggleConfig: () => void;
  onRefresh: () => void;
  onAddRouteClick: () => void;
}

export function CloudflareHeader({
  status,
  isConfigured,
  rulesCount,
  syncing,
  refreshing,
  showConfig,
  onSyncLinks,
  onToggleConfig,
  onRefresh,
  onAddRouteClick,
}: CloudflareHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
          <Cloud className="w-5 h-5" />
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
        {isConfigured && (
          <button
            onClick={onAddRouteClick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-400 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('cloudflare.btn_new_route', 'Nova Rota')}</span>
          </button>
        )}

        {rulesCount > 0 && (
          <button
            onClick={onSyncLinks}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent/60 hover:bg-accent border border-border/70 active:scale-[0.98] text-primary text-xs font-semibold transition-all shadow-sm focus:outline-none"
            title={t('cloudflare.sync_tooltip', 'Sincronizar links públicos com os cards de contêineres')}
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
            <span>{t('cloudflare.sync_button', 'Sincronizar Links')}</span>
          </button>
        )}

        <button
          onClick={onToggleConfig}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/70 text-xs font-semibold transition-all shadow-sm ${
            showConfig
              ? 'bg-orbit-500 text-white border-orbit-500'
              : 'bg-card/60 hover:bg-card text-secondary hover:text-primary active:scale-[0.98]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t('common.settings', 'Configurar')}</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 rounded-xl border border-border/70 bg-card/60 hover:bg-card text-secondary hover:text-primary active:scale-[0.98] transition-all shadow-sm"
          aria-label="Atualizar dados"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orbit-500' : ''}`} />
        </button>
      </div>
    </div>
  );
}
