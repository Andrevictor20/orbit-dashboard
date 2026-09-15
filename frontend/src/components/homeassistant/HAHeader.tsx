import { useTranslation } from 'react-i18next';
import { Home, Lightbulb, Zap, Activity, RefreshCw, Unlink } from 'lucide-react';
import type { HAConfig, DeviceSubFilter } from './types';

interface HAHeaderProps {
  config: HAConfig;
  stats: {
    total: number;
    lightsOn: number;
    switchesOn: number;
    sensorsCount: number;
  };
  loadingEntities: boolean;
  onFilterSubCategory: (filter: DeviceSubFilter) => void;
  onSync: () => void;
  onDisconnect: () => void;
}

export function HAHeader({
  config,
  stats,
  loadingEntities,
  onFilterSubCategory,
  onSync,
  onDisconnect,
}: HAHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-card/55 backdrop-blur-3xl saturate-[190%] border border-border/70 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
      {/* Identificação da Instância */}
      <div className="flex items-center gap-3.5 relative z-10">
        <div className="p-2.5 rounded-xl bg-orbit-500/15 text-orbit-600 dark:text-orbit-400 border border-orbit-500/20 shadow-sm shrink-0">
          <Home className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-primary truncate">
              {config.location_name || t('homeassistant.title')}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('homeassistant.status_connected')}
            </span>
            {config.version && (
              <span className="text-[11px] text-secondary font-mono bg-accent/70 px-2 py-0.5 rounded-md border border-border/60">
                v{config.version}
              </span>
            )}
          </div>
          <p className="text-[11px] text-secondary/70 font-mono mt-0.5 truncate max-w-xs sm:max-w-sm md:max-w-md">
            {config.url}
          </p>
        </div>
      </div>

      {/* Glanceable Status Chips & Ações */}
      <div className="flex items-center gap-2 flex-wrap relative z-10">
        {/* Chip Luzes */}
        <button
          onClick={() => onFilterSubCategory(stats.lightsOn > 0 ? 'lights' : 'all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
            stats.lightsOn > 0
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/10 hover:bg-amber-500/25'
              : 'bg-card/60 border-border/70 text-secondary hover:text-primary hover:bg-card/90'
          }`}
          title="Filtrar Luzes"
        >
          <Lightbulb className={`w-3.5 h-3.5 ${stats.lightsOn > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`} />
          <span>{stats.lightsOn} {t('homeassistant.lights_on', 'Luzes')}</span>
        </button>

        {/* Chip Tomadas/Interruptores */}
        <button
          onClick={() => onFilterSubCategory(stats.switchesOn > 0 ? 'switches' : 'all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
            stats.switchesOn > 0
              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-sm shadow-indigo-500/10 hover:bg-indigo-500/25'
              : 'bg-card/60 border-border/70 text-secondary hover:text-primary hover:bg-card/90'
          }`}
          title="Filtrar Tomadas"
        >
          <Zap className={`w-3.5 h-3.5 ${stats.switchesOn > 0 ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
          <span>{stats.switchesOn} {t('homeassistant.switches_on', 'Tomadas')}</span>
        </button>

        {/* Chip Sensores */}
        <button
          onClick={() => onFilterSubCategory('sensors')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border bg-card/60 border-border/70 text-secondary hover:text-primary hover:bg-card/90"
          title="Filtrar Sensores"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{stats.sensorsCount} {t('homeassistant.sensors_count', 'Sensores')}</span>
        </button>

        {/* Divisor Vertical */}
        <div className="h-5 w-px bg-border/80 hidden sm:block mx-0.5" />

        {/* Sincronizar */}
        <button
          onClick={onSync}
          disabled={loadingEntities}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card/50 hover:bg-card text-secondary hover:text-primary text-xs font-medium transition-all active:scale-95 shadow-sm disabled:opacity-50"
          title={t('homeassistant.sync')}
          aria-label={t('homeassistant.sync')}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingEntities ? 'animate-spin text-orbit-500' : ''}`} />
          <span className="hidden sm:inline">
            {loadingEntities ? t('homeassistant.syncing') : t('homeassistant.sync')}
          </span>
        </button>

        {/* Desconectar */}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-all active:scale-95 shadow-sm"
          title={t('homeassistant.disconnect')}
          aria-label={t('homeassistant.disconnect')}
        >
          <Unlink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
