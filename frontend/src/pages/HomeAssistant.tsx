import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Lightbulb,
  Zap,
  Activity,
  Cpu,
  RefreshCw,
  Unlink,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sliders,
  Layers,
  Film,
  Sparkles,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

import type {
  HAConfig,
  HAEntity,
  MainTabType,
  DeviceSubFilter,
  HADeviceGroup,
} from '../components/homeassistant';

import {
  groupEntities,
  groupAllDevices,
  DeviceCardSystem,
  RawEntitiesTable,
  DeviceGroupCard,
  DeviceDetailModal,
} from '../components/homeassistant';

export function HomeAssistant() {
  const { t, i18n } = useTranslation();
  const [, startTransition] = useTransition();

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState<HAConfig | null>(null);

  // Formulário de conexão
  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Entidades e navegação
  const [entities, setEntities] = useState<HAEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTabType>('devices');
  const [deviceSubFilter, setDeviceSubFilter] = useState<DeviceSubFilter>('all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [isPendingAction, setIsPendingAction] = useState<Record<string, boolean>>({});
  const [selectedDevice, setSelectedDevice] = useState<HADeviceGroup | null>(null);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');

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
      // Offline ou erro de rede
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
        // Atualização otimista de estado
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
        } else if (service === 'select_option' && payload.option) {
          setEntities((prev) =>
            prev.map((ent) => {
              if (ent.entity_id === entityId) {
                return { ...ent, state: payload.option };
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

  const handleRunSpeedtest = () => {
    callService('homeassistant', 'update_entity', {
      entity_id: grouped.systemMetrics.speedtestDownload?.entity_id || 'sensor.speedtest_download',
    });
    toast.success(t('homeassistant.run_speedtest'));
  };

  const isPending = (entityId: string) => !!isPendingAction[entityId];

  const handleToggleEntityId = async (entityId: string, currentState: string) => {
    const [domain] = entityId.split('.');
    const nextService = currentState === 'on' ? 'turn_off' : 'turn_on';
    await callService(domain, nextService, { entity_id: entityId });
  };

  const handleGenericServiceCall = async (domain: string, service: string, serviceData: Record<string, any>) => {
    await callService(domain, service, serviceData);
  };

  // Agrupamento Universal de todas as entidades em Dispositivos Consolidados
  const allDeviceGroups = useMemo(() => {
    return groupAllDevices(entities);
  }, [entities]);

  // Manter dispositivo selecionado em sincronia com o estado das entidades
  const activeSelectedDevice = useMemo(() => {
    if (!selectedDevice) return null;
    return allDeviceGroups.find((g) => g.id === selectedDevice.id) || selectedDevice;
  }, [selectedDevice, allDeviceGroups]);

  // Áreas Dinâmicas extraídas diretamente do Home Assistant
  const dynamicAreas = useMemo(() => {
    const areaMap = new Map<string, number>();
    allDeviceGroups.forEach((dev) => {
      const a = dev.area?.trim() || 'Geral';
      areaMap.set(a, (areaMap.get(a) || 0) + 1);
    });
    return Array.from(areaMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allDeviceGroups]);

  // Filtragem de dispositivos por área dinâmica, categoria e texto de busca
  const filteredDeviceGroups = useMemo(() => {
    let list = allDeviceGroups;

    // 1. Filtragem por Área Dinâmica
    if (selectedAreaFilter !== 'all') {
      list = list.filter((dev) => {
        const devArea = (dev.area?.trim() || 'Geral').toLowerCase();
        return devArea === selectedAreaFilter.toLowerCase();
      });
    }

    // 2. Filtragem por Subcategoria de Hardware
    if (deviceSubFilter !== 'all') {
      list = list.filter((dev) => {
        switch (deviceSubFilter) {
          case 'lights':
            return dev.category === 'light';
          case 'switches':
            return dev.category === 'switch';
          case 'media':
            return dev.category === 'media';
          case 'climate':
            return dev.category === 'climate';
          case 'cameras':
            return dev.category === 'camera';
          case 'mobile':
            return dev.category === 'mobile';
          case 'network':
            return dev.category === 'network';
          case 'system':
            return dev.category === 'system';
          case 'automation':
            return dev.category === 'automation';
          case 'sensors':
            return dev.category === 'sensor';
          default:
            return true;
        }
      });
    }

    // 3. Filtragem por Busca em Tempo Real
    if (deviceSearchQuery.trim()) {
      const q = deviceSearchQuery.toLowerCase().trim();
      list = list.filter((dev) => {
        const matchName = dev.name.toLowerCase().includes(q);
        const matchDesc = (dev.description || '').toLowerCase().includes(q);
        const matchArea = (dev.area || '').toLowerCase().includes(q);
        const matchEntities = dev.entities.some(
          (e) =>
            e.entity_id.toLowerCase().includes(q) ||
            (e.attributes.friendly_name || '').toLowerCase().includes(q)
        );
        return matchName || matchDesc || matchArea || matchEntities;
      });
    }

    return list;
  }, [allDeviceGroups, selectedAreaFilter, deviceSubFilter, deviceSearchQuery]);

  // Agrupamento inteligente de dispositivos para métricas e automações
  const grouped = useMemo(() => {
    return groupEntities(entities);
  }, [entities]);

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

  // Data formatada para a saudação
  const formattedDate = useMemo(() => {
    try {
      const date = new Date();
      return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(date);
    } catch {
      return '';
    }
  }, [i18n.language]);

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

  // ESTADO DESCONECTADO (Formulário)
  if (!config || !config.configured) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
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

          <div className="lg:col-span-5 bg-card/60 backdrop-blur-xl border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-orbit-500" />
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

  // ESTADO CONECTADO (Dashboard Organizado)
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-card/55 backdrop-blur-3xl saturate-[190%] border border-border/70 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
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

        <div className="flex items-center gap-2 self-end md:self-auto relative z-10">
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

      {/* Navegação por Abas Simplificada */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: 'devices', label: t('homeassistant.tab_devices'), icon: Layers },
              { id: 'system', label: t('homeassistant.tab_system'), icon: Activity },
              { id: 'raw', label: t('homeassistant.tab_raw_entities'), icon: Sliders },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => startTransition(() => setActiveTab(tab.id))}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25'
                    : 'bg-card/50 hover:bg-card/85 text-secondary hover:text-primary border border-border/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerta de erro se houver falha de sincronização */}
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

      {/* Conteúdo da Aba Ativa */}
      {loadingEntities && entities.length === 0 ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
        </div>
      ) : (
        <>
          {/* ABA PRINCIPAL: DISPOSITIVOS CONSOLIDADOS COM ÁREAS DINÂMICAS */}
          {activeTab === 'devices' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Card de Saudação com Modo Cinema e Atalhos Rápidos */}
              <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
                    <span>{t('homeassistant.welcome', 'Olá!')}</span>
                    <span className="text-xl">👋</span>
                  </h2>
                  <p className="text-xs text-secondary capitalize mt-0.5">
                    {formattedDate}
                  </p>
                </div>

                {/* Controles Rápidos em Destaque (Modo Cinema, etc.) */}
                {grouped.quickBooleans.length > 0 && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {grouped.quickBooleans.map((bool) => {
                      const isOn = bool.state === 'on';
                      const pending = isPending(bool.entity_id);
                      return (
                        <button
                          key={bool.entity_id}
                          onClick={() => handleToggle(bool)}
                          disabled={pending}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                            isOn
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                              : 'bg-card/80 border-border/80 text-secondary hover:text-primary'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>{bool.attributes.friendly_name || t('homeassistant.cinema_mode')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seletor Dinâmico de Áreas do Home Assistant */}
              {dynamicAreas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-orbit-400" />
                      {t('homeassistant.dynamic_areas', { defaultValue: 'Áreas do Home Assistant' })}
                    </span>
                    <span className="text-[11px] text-secondary/70">
                      {dynamicAreas.length} {t('homeassistant.areas_detected', { defaultValue: 'áreas detectadas' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => startTransition(() => setSelectedAreaFilter('all'))}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 active:scale-95 ${
                        selectedAreaFilter === 'all'
                          ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                          : 'bg-card/60 hover:bg-card text-secondary hover:text-primary border border-border/70'
                      }`}
                    >
                      <span>{t('homeassistant.all_areas', { defaultValue: 'Todas as Áreas' })}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          selectedAreaFilter === 'all' ? 'bg-white/20' : 'bg-accent text-secondary'
                        }`}
                      >
                        {allDeviceGroups.length}
                      </span>
                    </button>
                    {dynamicAreas.map(([areaName, count]) => (
                      <button
                        key={areaName}
                        onClick={() => startTransition(() => setSelectedAreaFilter(areaName))}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 active:scale-95 ${
                          selectedAreaFilter === areaName
                            ? 'bg-orbit-500 text-white shadow-md shadow-orbit-500/25 font-semibold'
                            : 'bg-card/60 hover:bg-card text-secondary hover:text-primary border border-border/70'
                        }`}
                      >
                        <span>{areaName}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            selectedAreaFilter === areaName ? 'bg-white/20' : 'bg-accent text-secondary'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Barra de Subfiltros por Categoria e Busca */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {(
                    [
                      { id: 'all', label: t('homeassistant.tab_all') },
                      { id: 'lights', label: t('homeassistant.tab_lights') },
                      { id: 'switches', label: t('homeassistant.tab_switches') },
                      { id: 'media', label: t('homeassistant.media_players') },
                      { id: 'climate', label: t('homeassistant.tab_climate') },
                      { id: 'cameras', label: t('homeassistant.cameras') },
                      { id: 'mobile', label: t('homeassistant.mobile_devices') },
                      { id: 'network', label: t('homeassistant.tab_network') },
                      { id: 'system', label: t('homeassistant.tab_system_backups') },
                      { id: 'automation', label: t('homeassistant.tab_automations') },
                      { id: 'sensors', label: t('homeassistant.tab_sensors') },
                    ] as const
                  ).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => startTransition(() => setDeviceSubFilter(sub.id))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 active:scale-95 ${
                        deviceSubFilter === sub.id
                          ? 'bg-orbit-500 text-white shadow-sm font-semibold'
                          : 'bg-card/60 hover:bg-card text-secondary hover:text-primary border border-border/70'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Campo de Busca de Dispositivos */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                  <input
                    type="text"
                    value={deviceSearchQuery}
                    onChange={(e) => setDeviceSearchQuery(e.target.value)}
                    placeholder={t('homeassistant.search_placeholder')}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border/70 bg-card/70 text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Contador de Dispositivos Consolidados */}
              <div className="flex items-center justify-between text-xs text-secondary px-1">
                <span>
                  {t('homeassistant.showing_devices', {
                    count: filteredDeviceGroups.length,
                    defaultValue: `Exibindo ${filteredDeviceGroups.length} dispositivos consolidados`,
                  })}
                  {selectedAreaFilter !== 'all' && (
                    <span className="ml-1 text-orbit-400 font-medium">({selectedAreaFilter})</span>
                  )}
                </span>
                <span className="font-mono text-[11px] bg-card/60 border border-border/60 px-2 py-0.5 rounded-md">
                  {entities.length} {t('homeassistant.entities_integrated', { defaultValue: 'entidades agrupadas' })}
                </span>
              </div>

              {/* Grid de Cards de Dispositivos Consolidados */}
              {filteredDeviceGroups.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/70 bg-card/30">
                  <p className="text-sm text-secondary">
                    {t('homeassistant.no_devices_found', { defaultValue: 'Nenhum dispositivo encontrado para este filtro.' })}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDeviceGroups.map((device) => (
                    <DeviceGroupCard
                      key={device.id}
                      device={device}
                      onClick={() => setSelectedDevice(device)}
                      onQuickToggle={handleToggleEntityId}
                      isPending={device.primaryEntity ? isPending(device.primaryEntity.entity_id) : false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. ABA: SISTEMA */}
          {activeTab === 'system' && (
            <div className="animate-in fade-in duration-300">
              <DeviceCardSystem
                metrics={grouped.systemMetrics}
                isPending={isPending}
                onRunSpeedtest={handleRunSpeedtest}
              />
            </div>
          )}

          {/* 6. ABA: TODAS AS ENTIDADES (TÉCNICO) */}
          {activeTab === 'raw' && (
            <div className="animate-in fade-in duration-300">
              <RawEntitiesTable
                entities={entities}
                isPending={isPending}
                onToggle={handleToggle}
              />
            </div>
          )}
        </>
      )}

      {/* Modal de Inspeção e Controle Detalhado do Dispositivo */}
      <DeviceDetailModal
        device={activeSelectedDevice}
        isOpen={!!activeSelectedDevice}
        onClose={() => setSelectedDevice(null)}
        onToggle={handleToggleEntityId}
        onServiceCall={handleGenericServiceCall}
        isPendingAction={isPendingAction}
      />
    </div>
  );
}
export default HomeAssistant;
