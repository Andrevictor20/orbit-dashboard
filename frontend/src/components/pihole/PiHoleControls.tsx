import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Power,
  RefreshCw,
  Unlink,
  ExternalLink,
  Settings,
  ChevronDown,
  Loader2,
  Clock,
} from 'lucide-react';
import type { PiHoleConfig } from '../../types/pihole';

interface PiHoleControlsProps {
  config: PiHoleConfig | null;
  isBlockingEnabled: boolean;
  isTogglingBlocking: boolean;
  loadingStats: boolean;
  onToggleBlocking: (enable: boolean, durationSeconds?: number) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onOpenConfig: () => void;
}

export function PiHoleControls({
  config,
  isBlockingEnabled,
  isTogglingBlocking,
  loadingStats,
  onToggleBlocking,
  onRefresh,
  onDisconnect,
  onOpenConfig,
}: PiHoleControlsProps) {
  const { t } = useTranslation();
  const [isDisableDropdownOpen, setIsDisableDropdownOpen] = useState(false);
  const disableDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (disableDropdownRef.current && !disableDropdownRef.current.contains(e.target as Node)) {
        setIsDisableDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!config?.configured || !config.connected) {
    return (
      <button
        type="button"
        onClick={onOpenConfig}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 shadow-md shadow-orbit-500/20 active:scale-95 transition-all"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>{t('pihole.configure')}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Blocking Toggle Button with Dropdown for Timed Pause */}
      <div className="relative" ref={disableDropdownRef}>
        {isBlockingEnabled ? (
          <div className="inline-flex rounded-xl shadow-sm">
            <button
              type="button"
              onClick={() => onToggleBlocking(false)}
              disabled={isTogglingBlocking}
              className="flex items-center gap-2 px-3.5 py-2 rounded-l-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              title={t('pihole.disable_blocking_tooltip')}
            >
              {isTogglingBlocking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{t('pihole.blocking_active')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDisableDropdownOpen(!isDisableDropdownOpen)}
              className="px-2 py-2 rounded-r-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-y border-r border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              title={t('pihole.pause_options')}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onToggleBlocking(true)}
            disabled={isTogglingBlocking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {isTogglingBlocking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{t('pihole.blocking_inactive')}</span>
          </button>
        )}

        {/* Dropdown for timed pauses */}
        {isDisableDropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-48 rounded-xl border shad-border bg-surface dark:bg-zinc-800 shadow-xl py-1.5 z-30 animate-fade-in text-xs">
            <div className="px-3 py-1 text-[10px] font-semibold text-secondary uppercase tracking-wider">
              {t('pihole.pause_blocking_for')}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDisableDropdownOpen(false);
                onToggleBlocking(false, 10);
              }}
              className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>10 {t('pihole.seconds')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDisableDropdownOpen(false);
                onToggleBlocking(false, 30);
              }}
              className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>30 {t('pihole.seconds')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDisableDropdownOpen(false);
                onToggleBlocking(false, 300);
              }}
              className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>5 {t('pihole.minutes')}</span>
            </button>
            <div className="my-1 border-t border-border/50" />
            <button
              type="button"
              onClick={() => {
                setIsDisableDropdownOpen(false);
                onToggleBlocking(false);
              }}
              className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('pihole.indefinitely')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync Button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loadingStats}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={t('common.refresh')}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{t('common.refresh')}</span>
      </button>

      {/* Open Web UI */}
      <a
        href={`${config.url}/admin`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={t('pihole.open_web_ui')}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Admin UI</span>
      </a>

      {/* Disconnect Button */}
      <button
        type="button"
        onClick={onDisconnect}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
        title={t('pihole.disconnect')}
      >
        <Unlink className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('pihole.disconnect')}</span>
      </button>
    </div>
  );
}
