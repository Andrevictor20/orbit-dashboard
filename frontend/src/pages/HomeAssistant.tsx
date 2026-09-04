import { useState, useEffect, useMemo, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  Lightbulb, 
  ToggleLeft, 
  ToggleRight, 
  Thermometer, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Unlink, 
  Search, 
  Zap, 
  ShieldCheck, 
  Activity, 
  AlertCircle, 
  Loader2, 
  Sliders, 
  Droplets,
  DoorClosed,
  HelpCircle,
  Cpu
} from 'lucide-react';
import toast from 'react-hot-toast';

interface HAConfig {
  configured: boolean;
  connected: boolean;
  url: string;
  version: string | null;
  location_name: string | null;
  error?: string | null;
}

interface HAEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    unit_of_measurement?: string;
    device_class?: string;
    brightness?: number;
    supported_color_modes?: string[];
    current_temperature?: number;
    temperature?: number;
    hvac_modes?: string[];
    [key: string]: any;
  };
  last_changed?: string;
  last_updated?: string;
}

type TabType = 'all' | 'light' | 'switch' | 'sensor' | 'binary_sensor' | 'climate';

export function HomeAssistant() {
  const { t } = useTranslation();
  const [, startTransition] = useTransition();

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState<HAConfig | null>(null);

  // Connection form state
  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Entities state
  const [entities, setEntities] = useState<HAEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPendingAction, setIsPendingAction] = useState<Record<string, boolean>>({});

  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/homeassistant/config');
      if (res.ok) {
        const data: HAConfig = await res.json();
        setConfig(data);
        if (data.configured && data.connected) {
          fetchEntities();
        }
      }
    } catch {
      // Offline or network error
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchEntities = async () => {
    try {
      setLoadingEntities(true);
      setEntitiesError(null);
      const res = await fetch('/api/homeassistant/entities');
      if (res.ok) {
        const data: HAEntity[] = await res.json();
        setEntities(data);
      } else {
        const err = await res.json().catch(() => ({ error: 'Error' }));
        setEntitiesError(err.error || t('homeassistant.error_loading'));
      }
    } catch (e: any) {
      setEntitiesError(e.message || t('homeassistant.error_loading'));
    } finally {
      setLoadingEntities(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !tokenInput.trim()) return;

    setIsConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/homeassistant/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          token: tokenInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error || 'Falha na conexão com o Home Assistant');
        toast.error(data.error || 'Falha ao conectar');
      } else {
        toast.success(t('homeassistant.connect_title') + ': ' + t('common.success'));
        fetchConfig();
      }
    } catch (err: any) {
      setConnectError(err.message || 'Erro de rede');
      toast.error('Erro de conexão');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('homeassistant.disconnect_confirm'))) return;

    try {
      const res = await fetch('/api/homeassistant/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('homeassistant.disconnect') + ': ' + t('common.success'));
        setConfig(null);
        setEntities([]);
        setUrlInput('');
        setTokenInput('');
        fetchConfig();
      }
    } catch {
      toast.error('Erro ao desconectar');
    }
  };

  const callService = async (domain: string, service: string, payload: Record<string, any>) => {
    const entityId = payload.entity_id;
    if (entityId) {
      setIsPendingAction((prev) => ({ ...prev, [entityId]: true }));
    }

    try {
      const res = await fetch(`/api/homeassistant/services/${domain}/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Optimistic UI update
        if (service === 'turn_on' || service === 'turn_off' || service === 'toggle') {
          const nextState = service === 'turn_on' ? 'on' : service === 'turn_off' ? 'off' : undefined;
          setEntities((prev) =>
            prev.map((ent) => {
              if (ent.entity_id === entityId) {
                const updatedState = nextState !== undefined ? nextState : ent.state === 'on' ? 'off' : 'on';
                return { ...ent, state: updatedState };
              }
              return ent;
            })
          );
        }
      } else {
        toast.error('Falha ao executar ação');
      }
    } catch {
      toast.error('Erro ao enviar comando');
    } finally {
      if (entityId) {
        setIsPendingAction((prev) => ({ ...prev, [entityId]: false }));
      }
    }
  };

  const handleToggle = (entity: HAEntity) => {
    const [domain] = entity.entity_id.split('.');
    const nextService = entity.state === 'on' ? 'turn_off' : 'turn_on';
    callService(domain, nextService, { entity_id: entity.entity_id });
  };

  const handleBrightnessChange = (entityId: string, brightnessValue: number) => {
    callService('light', 'turn_on', {
      entity_id: entityId,
      brightness: brightnessValue,
    });
  };

  // Filter entities by tab and search
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      const [domain] = entity.entity_id.split('.');
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'light' && domain === 'light') ||
        (activeTab === 'switch' && domain === 'switch') ||
        (activeTab === 'sensor' && domain === 'sensor') ||
        (activeTab === 'binary_sensor' && domain === 'binary_sensor') ||
        (activeTab === 'climate' && domain === 'climate');

      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const friendlyName = (entity.attributes.friendly_name || '').toLowerCase();
      const entityId = entity.entity_id.toLowerCase();
      return friendlyName.includes(q) || entityId.includes(q);
    });
  }, [entities, activeTab, searchQuery]);

  // KPIs
  const stats = useMemo(() => {
    let total = entities.length;
    let lightsOn = 0;
    let switchesOn = 0;
    let sensorsCount = 0;

    entities.forEach((ent) => {
      const [domain] = ent.entity_id.split('.');
      if (domain === 'light' && ent.state === 'on') lightsOn++;
      if (domain === 'switch' && ent.state === 'on') switchesOn++;
      if (domain === 'sensor' || domain === 'binary_sensor') sensorsCount++;
    });

    return { total, lightsOn, switchesOn, sensorsCount };
  }, [entities]);

  if (loadingConfig) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
          <span className="text-xs text-secondary font-medium tracking-wide">
            {t('common.loading')}
          </span>
        </div>
      </div>
    );
  }

  // DISCONNECTED STATE (Form)
  if (!config || !config.configured) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header Title */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 shadow-sm">
              <Home className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                {t('homeassistant.title')}
              </h1>
              <p className="text-sm text-secondary">
                {t('homeassistant.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Setup Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-card/55 backdrop-blur-3xl saturate-[190%] border border-border/70 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-orbit-500/15 blur-3xl pointer-events-none" />

            <h2 className="text-lg font-semibold text-primary mb-1">
              {t('homeassistant.connect_title')}
            </h2>
            <p className="text-xs text-secondary mb-6">
              {t('homeassistant.connect_subtitle')}
            </p>

            {connectError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-start gap-3 text-xs leading-relaxed animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  {t('homeassistant.url_label')}
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={t('homeassistant.url_placeholder')}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border/80 bg-background/70 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  {t('homeassistant.token_label')}
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={t('homeassistant.token_placeholder')}
                    required
                    className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border/80 bg-background/70 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-orbit-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors p-1"
                    title={showToken ? t('homeassistant.hide_token') : t('homeassistant.show_token')}
                    aria-label={showToken ? t('homeassistant.hide_token') : t('homeassistant.show_token')}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting || !urlInput.trim() || !tokenInput.trim()}
                className="w-full py-3 px-4 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-orbit-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('homeassistant.connecting')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('homeassistant.connect_button')}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Step Guide */}
          <div className="lg:col-span-5 bg-card/60 backdrop-blur-xl border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <HelpCircle className="w-4 h-4 text-orbit-500" />
              <h3>{t('homeassistant.how_to_get_token')}</h3>
            </div>

            <div className="space-y-3.5 text-xs text-secondary leading-relaxed">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orbit-500/20 text-orbit-400 font-bold shrink-0">
                  1
                </span>
                <p>{t('homeassistant.step_1')}</p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orbit-500/20 text-orbit-400 font-bold shrink-0">
                  2
                </span>
                <p>{t('homeassistant.step_2')}</p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orbit-500/20 text-orbit-400 font-bold shrink-0">
                  3
                </span>
                <p>{t('homeassistant.step_3')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CONNECTED STATE (Dashboard)
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-card/55 backdrop-blur-3xl saturate-[190%] border border-border/70 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/20 shadow-sm">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-primary">
                {config.location_name || t('homeassistant.title')}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('homeassistant.status_connected')}
              </span>
              {config.version && (
                <span className="text-xs text-secondary font-mono bg-accent px-2 py-0.5 rounded-md border border-border/60">
                  v{config.version}
                </span>
              )}
            </div>
            <p className="text-xs text-secondary font-mono mt-0.5 truncate max-w-sm sm:max-w-md">
              {config.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={fetchEntities}
            disabled={loadingEntities}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/70 bg-card/50 hover:bg-card/85 text-secondary hover:text-primary text-xs font-medium transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
            title={t('homeassistant.sync')}
            aria-label={t('homeassistant.sync')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingEntities ? 'animate-spin text-orbit-500' : ''}`} />
            <span className="hidden sm:inline">
              {loadingEntities ? t('homeassistant.syncing') : t('homeassistant.sync')}
            </span>
          </button>

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-all active:scale-[0.98] shadow-sm"
            title={t('homeassistant.disconnect')}
            aria-label={t('homeassistant.disconnect')}
          >
            <Unlink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('homeassistant.disconnect')}</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-card/50 backdrop-blur-3xl saturate-[190%] border border-border/60 shadow-sm hover:border-orbit-500/30 transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium">{t('homeassistant.total_devices')}</span>
            <div className="text-2xl font-bold text-primary mt-1">{stats.total}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card/50 backdrop-blur-3xl saturate-[190%] border border-border/60 shadow-sm hover:border-amber-500/30 transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium">{t('homeassistant.lights_on')}</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.lightsOn}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Lightbulb className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card/50 backdrop-blur-3xl saturate-[190%] border border-border/60 shadow-sm hover:border-indigo-500/30 transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium">{t('homeassistant.switches_on')}</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{stats.switchesOn}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card/50 backdrop-blur-3xl saturate-[190%] border border-border/60 shadow-sm hover:border-emerald-500/30 transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium">{t('homeassistant.sensors_count')}</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.sensorsCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: 'all', label: t('homeassistant.tab_all') },
              { id: 'light', label: t('homeassistant.tab_lights') },
              { id: 'switch', label: t('homeassistant.tab_switches') },
              { id: 'sensor', label: t('homeassistant.tab_sensors') },
              { id: 'binary_sensor', label: t('homeassistant.tab_binary_sensors') },
              { id: 'climate', label: t('homeassistant.tab_climate') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 active:scale-95 ${
                activeTab === tab.id
                  ? 'bg-orbit-500 text-white shadow-sm font-semibold'
                  : 'bg-card/60 hover:bg-card text-secondary hover:text-primary border border-border/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('homeassistant.search_placeholder')}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border/70 bg-card/60 text-primary text-xs focus:outline-none focus:ring-2 focus:ring-orbit-500 transition-all"
          />
        </div>
      </div>

      {/* Error Alert if fetching failed */}
      {entitiesError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{entitiesError}</span>
          </div>
          <button
            onClick={fetchEntities}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-colors"
          >
            {t('homeassistant.retry')}
          </button>
        </div>
      )}

      {/* Entities Grid */}
      {loadingEntities && entities.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-orbit-500" />
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40">
          <Home className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
          <h3 className="text-sm font-semibold text-primary mb-1">
            {searchQuery ? t('homeassistant.empty_search') : t('homeassistant.no_devices_found')}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEntities.map((entity) => {
            const [domain] = entity.entity_id.split('.');
            const friendlyName = entity.attributes.friendly_name || entity.entity_id;
            const isOn = entity.state === 'on';
            const isPending = !!isPendingAction[entity.entity_id];

            // Render Light Card
            if (domain === 'light') {
              const supportsBrightness =
                Array.isArray(entity.attributes.supported_color_modes) &&
                entity.attributes.supported_color_modes.some((m) => m.includes('brightness'));
              const brightnessPct = entity.attributes.brightness
                ? Math.round((entity.attributes.brightness / 255) * 100)
                : 0;

              return (
                <div
                  key={entity.entity_id}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-3 bg-card/55 backdrop-blur-3xl saturate-[190%] hover:scale-[1.015] hover:shadow-md ${
                    isOn
                      ? 'border-amber-500/40 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20'
                      : 'border-border/70 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl transition-colors ${
                          isOn
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-accent/80 text-secondary'
                        }`}
                      >
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                          {friendlyName}
                        </h4>
                        <span className="text-[11px] text-secondary font-mono truncate block">
                          {entity.entity_id}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(entity)}
                      disabled={isPending}
                      aria-label={`Alternar ${friendlyName}`}
                      className={`p-1.5 rounded-xl transition-all active:scale-95 ${
                        isOn
                          ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                          : 'text-secondary hover:text-primary bg-accent/60'
                      }`}
                      title={isOn ? t('homeassistant.state_on') : t('homeassistant.state_off')}
                    >
                      {isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isOn ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  </div>

                  {/* Brightness Slider if supported */}
                  {supportsBrightness && isOn && (
                    <div className="pt-2 border-t border-border/50 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-secondary">
                        <span className="flex items-center gap-1">
                          <Sliders className="w-3 h-3" />
                          {t('homeassistant.brightness')}
                        </span>
                        <span className="font-semibold text-primary">{brightnessPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="255"
                        defaultValue={entity.attributes.brightness || 255}
                        onChange={(e) =>
                          handleBrightnessChange(entity.entity_id, parseInt(e.target.value, 10))
                        }
                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-accent rounded-lg"
                      />
                    </div>
                  )}
                </div>
              );
            }

            // Render Switch Card
            if (domain === 'switch') {
              return (
                <div
                  key={entity.entity_id}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 bg-card/55 backdrop-blur-3xl saturate-[190%] hover:scale-[1.015] hover:shadow-md ${
                    isOn
                      ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                      : 'border-border/70 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        isOn ? 'bg-indigo-500/20 text-indigo-400' : 'bg-accent/80 text-secondary'
                      }`}
                    >
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                        {friendlyName}
                      </h4>
                      <span className="text-[11px] text-secondary font-mono truncate block">
                        {entity.entity_id}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(entity)}
                    disabled={isPending}
                    aria-label={`Alternar ${friendlyName}`}
                    className={`p-1.5 rounded-xl transition-all active:scale-95 ${
                      isOn
                        ? 'text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25'
                        : 'text-secondary hover:text-primary bg-accent/60'
                    }`}
                    title={isOn ? t('homeassistant.state_on') : t('homeassistant.state_off')}
                  >
                    {isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isOn ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              );
            }

            // Render Binary Sensor Card
            if (domain === 'binary_sensor') {
              const isDetected = entity.state === 'on';
              const isDoor = entity.attributes.device_class === 'door' || entity.attributes.device_class === 'window';

              return (
                <div
                  key={entity.entity_id}
                  className="p-4 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-3xl saturate-[190%] shadow-sm hover:scale-[1.015] hover:shadow-md transition-all duration-300 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl ${
                        isDetected
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {isDoor ? <DoorClosed className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                        {friendlyName}
                      </h4>
                      <span className="text-[11px] text-secondary font-mono truncate block">
                        {entity.entity_id}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      isDetected
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-accent text-secondary border border-border/60'
                    }`}
                  >
                    {isDoor
                      ? isDetected
                        ? t('homeassistant.state_open')
                        : t('homeassistant.state_closed')
                      : isDetected
                      ? t('homeassistant.state_detected')
                      : t('homeassistant.state_clear')}
                  </span>
                </div>
              );
            }

            // Render Numeric / Generic Sensor Card
            if (domain === 'sensor') {
              const devClass = entity.attributes.device_class;
              const unit = entity.attributes.unit_of_measurement || '';

              const SensorIcon =
                devClass === 'temperature'
                  ? Thermometer
                  : devClass === 'humidity'
                  ? Droplets
                  : devClass === 'power' || devClass === 'energy'
                  ? Zap
                  : Activity;

              return (
                <div
                  key={entity.entity_id}
                  className="p-4 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-3xl saturate-[190%] shadow-sm hover:scale-[1.015] hover:shadow-md transition-all duration-300 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-400">
                      <SensorIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                        {friendlyName}
                      </h4>
                      <span className="text-[11px] text-secondary font-mono truncate block">
                        {entity.entity_id}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-bold text-primary tabular-nums">
                      {entity.state}
                    </span>
                    {unit && <span className="text-xs text-secondary font-medium ml-1">{unit}</span>}
                  </div>
                </div>
              );
            }

            // Render Climate Card
            if (domain === 'climate') {
              const currentTemp = entity.attributes.current_temperature;
              const targetTemp = entity.attributes.temperature;

              return (
                <div
                  key={entity.entity_id}
                  className="p-4 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-3xl saturate-[190%] shadow-sm hover:scale-[1.015] hover:shadow-md transition-all duration-300 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400">
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                          {friendlyName}
                        </h4>
                        <span className="text-[11px] text-secondary capitalize">{entity.state}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-secondary">{t('homeassistant.temperature')}</span>
                    <span className="font-bold text-primary">
                      {currentTemp ? `${currentTemp}°C` : '-'}
                      {targetTemp ? ` (Alvo: ${targetTemp}°C)` : ''}
                    </span>
                  </div>
                </div>
              );
            }

            // Generic Fallback Card
            return (
              <div
                key={entity.entity_id}
                className="p-4 rounded-2xl border border-border/70 bg-card/55 backdrop-blur-3xl saturate-[190%] shadow-sm hover:scale-[1.015] hover:shadow-md transition-all duration-300 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-primary truncate" title={friendlyName}>
                    {friendlyName}
                  </h4>
                  <span className="text-[11px] text-secondary font-mono truncate block">
                    {entity.entity_id}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-accent text-secondary text-xs font-mono">
                  {entity.state}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
