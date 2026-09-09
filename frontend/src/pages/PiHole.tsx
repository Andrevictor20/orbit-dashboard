import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  ShieldAlert,
  Power,
  RefreshCw,
  Unlink,
  ExternalLink,
  Settings,
  ChevronDown,
  Layers,
  Globe,
  Loader2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PiHoleConfig, PiHoleStats, PiHoleDomainItem, PiHoleTab } from '../types/pihole';
import { PiHoleStatsCards } from '../components/pihole/PiHoleStatsCards';
import { PiHoleTopDomains } from '../components/pihole/PiHoleTopDomains';
import { PiHoleDomainList } from '../components/pihole/PiHoleDomainList';
import { PiHoleConfigModal } from '../components/pihole/PiHoleConfigModal';

export function PiHole() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<PiHoleConfig | null>(null);
  const [stats, setStats] = useState<PiHoleStats | null>(null);
  const [domains, setDomains] = useState<PiHoleDomainItem[]>([]);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [isTogglingBlocking, setIsTogglingBlocking] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isDisableDropdownOpen, setIsDisableDropdownOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<PiHoleTab>('overview');

  const disableDropdownRef = useRef<HTMLDivElement>(null);

  // Close disable dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (disableDropdownRef.current && !disableDropdownRef.current.contains(e.target as Node)) {
        setIsDisableDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/pihole/config');
      if (res.ok) {
        const data: PiHoleConfig = await res.json();
        setConfig(data);
        if (data.configured && data.connected) {
          fetchStats();
          fetchDomains();
        }
      }
    } catch {
      // offline / network error
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch('/api/pihole/stats');
      if (res.ok) {
        const data: PiHoleStats = await res.json();
        setStats(data);
      }
    } catch {
      // error fetching stats
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchDomains = async () => {
    try {
      setLoadingDomains(true);
      const res = await fetch('/api/pihole/domains');
      if (res.ok) {
        const data: PiHoleDomainItem[] = await res.json();
        setDomains(data);
      }
    } catch {
      // error fetching domains
    } finally {
      setLoadingDomains(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleConnect = async (url: string, token: string) => {
    const res = await fetch('/api/pihole/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to connect to Pi-hole');
    }

    await fetchConfig();
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('pihole.disconnect_confirm'))) {
      return;
    }

    try {
      const res = await fetch('/api/pihole/config', { method: 'DELETE' });
      if (res.ok) {
        setConfig(null);
        setStats(null);
        setDomains([]);
        toast.success(t('pihole.disconnected_success'));
        await fetchConfig();
      }
    } catch {
      toast.error(t('pihole.disconnect_failed'));
    }
  };

  const handleToggleBlocking = async (enable: boolean, durationSeconds?: number) => {
    try {
      setIsTogglingBlocking(true);
      setIsDisableDropdownOpen(false);
      const res = await fetch('/api/pihole/blocking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable, duration_seconds: durationSeconds }),
      });

      if (res.ok) {
        const data = await res.json();
        const newStatus = data.status;
        toast.success(
          enable
            ? t('pihole.blocking_enabled_success')
            : durationSeconds
            ? t('pihole.blocking_paused_seconds_success', { seconds: durationSeconds })
            : t('pihole.blocking_disabled_success')
        );
        // Optimistic / update state
        if (config) {
          setConfig((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        if (stats) {
          setStats((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        fetchStats();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('pihole.toggle_failed'));
      }
    } catch {
      toast.error(t('pihole.toggle_failed'));
    } finally {
      setIsTogglingBlocking(false);
    }
  };

  const handleAddDomain = async (domain: string, listType: 'white' | 'black') => {
    const res = await fetch('/api/pihole/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, list_type: listType }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add domain');
    }

    await fetchDomains();
  };

  const handleRemoveDomain = async (domain: string, listType: 'white' | 'black') => {
    const res = await fetch('/api/pihole/domains', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, list_type: listType }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove domain');
    }

    await fetchDomains();
  };

  const isBlockingEnabled = stats?.status
    ? stats.status === 'enabled'
    : config?.status === 'enabled';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-primary">
                {t('pihole.title')}
              </h1>
              {config?.configured && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
                    config.connected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      config.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  {config.connected
                    ? t('pihole.status_connected')
                    : t('pihole.status_disconnected')}
                </span>
              )}
            </div>
            <p className="text-xs text-secondary mt-0.5">
              {t('pihole.subtitle')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {config?.configured && config.connected && (
            <>
              {/* Blocking Toggle Button with Dropdown for Timed Pause */}
              <div className="relative" ref={disableDropdownRef}>
                {isBlockingEnabled ? (
                  <div className="inline-flex rounded-xl shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleToggleBlocking(false)}
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
                    onClick={() => handleToggleBlocking(true)}
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
                      onClick={() => handleToggleBlocking(false, 10)}
                      className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
                    >
                      <Clock className="w-3.5 h-3.5 text-secondary" />
                      <span>10 {t('pihole.seconds')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBlocking(false, 30)}
                      className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
                    >
                      <Clock className="w-3.5 h-3.5 text-secondary" />
                      <span>30 {t('pihole.seconds')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBlocking(false, 300)}
                      className="w-full text-left px-3 py-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700/60 flex items-center gap-2"
                    >
                      <Clock className="w-3.5 h-3.5 text-secondary" />
                      <span>5 {t('pihole.minutes')}</span>
                    </button>
                    <div className="my-1 border-t border-border/50" />
                    <button
                      type="button"
                      onClick={() => handleToggleBlocking(false)}
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
                onClick={() => {
                  fetchStats();
                  fetchDomains();
                }}
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
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                title={t('pihole.disconnect')}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('pihole.disconnect')}</span>
              </button>
            </>
          )}

          {(!config?.configured || !config.connected) && (
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 shadow-md shadow-orbit-500/20 active:scale-95 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t('pihole.configure')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loadingConfig ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
          <span className="text-xs text-secondary">{t('common.loading')}</span>
        </div>
      ) : !config?.configured || !config.connected ? (
        /* Empty / Connect Call-to-Action */
        <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-8 sm:p-12 text-center flex flex-col items-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-primary">
            {t('pihole.connect_banner_title')}
          </h2>
          <p className="text-xs text-secondary leading-relaxed max-w-md">
            {t('pihole.connect_banner_desc')}
          </p>
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 shadow-lg shadow-orbit-500/25 active:scale-95 transition-all mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('pihole.connect_button_cta')}</span>
          </button>
        </div>
      ) : (
        /* Connected Dashboard */
        <div className="space-y-5">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-orbit-500/10 text-orbit-500 border border-orbit-500/20'
                  : 'text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t('pihole.tab_overview')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('domains')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'domains'
                  ? 'bg-orbit-500/10 text-orbit-500 border border-orbit-500/20'
                  : 'text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>{t('pihole.tab_domains')}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-secondary">
                {domains.length}
              </span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' ? (
            <div className="space-y-5">
              <PiHoleStatsCards stats={stats} loading={loadingStats} />
              <PiHoleTopDomains
                topQueries={stats?.top_queries}
                topAds={stats?.top_ads}
                onAddDomain={handleAddDomain}
                loading={loadingStats}
              />
            </div>
          ) : (
            <PiHoleDomainList
              domains={domains}
              loading={loadingDomains}
              onAddDomain={handleAddDomain}
              onRemoveDomain={handleRemoveDomain}
            />
          )}
        </div>
      )}

      {/* Connection Modal */}
      <PiHoleConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConnect={handleConnect}
        initialUrl={config?.url || ''}
      />
    </div>
  );
}
