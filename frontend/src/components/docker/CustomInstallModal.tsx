import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Plus, Terminal, AlertTriangle, 
  Layers, HardDrive, ShieldCheck, RefreshCw, Key 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PortMappingItem {
  host: string;
  container: string;
  protocol: string;
  in_use?: boolean;
  suggested_port?: number;
}

interface VolumeMappingItem {
  host: string;
  container: string;
}

interface EnvVarItem {
  key: string;
  value: string;
}

interface CustomInstallModalProps {
  appId: string;
  appName?: string;
  onClose: () => void;
  onInstall: (payload: any) => void;
}

export function CustomInstallModal({ appId, appName, onClose, onInstall }: CustomInstallModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ports' | 'volumes' | 'env'>('ports');
  const [ports, setPorts] = useState<PortMappingItem[]>([]);
  const [volumes, setVolumes] = useState<VolumeMappingItem[]>([]);
  const [envVars, setEnvVars] = useState<EnvVarItem[]>([]);
  const [checkingPorts, setCheckingPorts] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        setLoading(true);
        const token = localStorage.getItem('orbit_token');
        const res = await fetch(`/api/store/apps/${appId}/config`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          const initialPorts: PortMappingItem[] = (data.ports || []).map((p: any) => ({
            host: String(p.host),
            container: String(p.container),
            protocol: p.protocol || 'tcp',
          }));

          const initialVolumes: VolumeMappingItem[] = (data.volumes || []).map((v: any) => ({
            host: v.host || `/app/data/apps/${appId}`,
            container: v.container || '/config',
          }));

          const envMap = data.env || {};
          const initialEnv: EnvVarItem[] = Object.entries(envMap).map(([key, value]) => ({
            key,
            value: String(value),
          }));

          // Ensure standard homelab env vars are present if missing
          if (!initialEnv.some(e => e.key === 'PUID')) initialEnv.unshift({ key: 'PUID', value: '1000' });
          if (!initialEnv.some(e => e.key === 'PGID')) initialEnv.unshift({ key: 'PGID', value: '1000' });
          if (!initialEnv.some(e => e.key === 'TZ')) initialEnv.unshift({ key: 'TZ', value: 'UTC' });

          setPorts(initialPorts.length > 0 ? initialPorts : [{ host: '8080', container: '80', protocol: 'tcp' }]);
          setVolumes(initialVolumes.length > 0 ? initialVolumes : [{ host: `/app/data/apps/${appId}/config`, container: '/config' }]);
          setEnvVars(initialEnv);

          // Check port conflicts
          if (initialPorts.length > 0) {
            checkPortConflicts(initialPorts);
          }
        } else if (isMounted) {
          setPorts([{ host: '8080', container: '80', protocol: 'tcp' }]);
          setVolumes([{ host: `/app/data/apps/${appId}/config`, container: '/config' }]);
          setEnvVars([
            { key: 'PUID', value: '1000' },
            { key: 'PGID', value: '1000' },
            { key: 'TZ', value: 'America/Sao_Paulo' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load app config:', err);
        if (isMounted) {
          setPorts([{ host: '8080', container: '80', protocol: 'tcp' }]);
          setVolumes([{ host: `/app/data/apps/${appId}/config`, container: '/config' }]);
          setEnvVars([
            { key: 'PUID', value: '1000' },
            { key: 'PGID', value: '1000' },
            { key: 'TZ', value: 'America/Sao_Paulo' },
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchConfig();
    return () => { isMounted = false; };
  }, [appId]);

  const checkPortConflicts = async (currentPorts: PortMappingItem[]) => {
    try {
      setCheckingPorts(true);
      const hostPorts = currentPorts
        .map(p => parseInt(p.host, 10))
        .filter(p => !isNaN(p) && p > 0);

      if (hostPorts.length === 0) return;

      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/ports/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ports: hostPorts })
      });

      if (res.ok) {
        const data = await res.json();
        const conflicts: any[] = data.conflicts || [];
        setPorts(prev => prev.map(p => {
          const match = conflicts.find(c => c.host_port === parseInt(p.host, 10));
          return match ? {
            ...p,
            in_use: match.in_use,
            suggested_port: match.suggested_port
          } : { ...p, in_use: false };
        }));
      }
    } catch (e) {
      console.warn('Port check error:', e);
    } finally {
      setCheckingPorts(false);
    }
  };

  const applySuggestedPort = (idx: number, suggested: number) => {
    const updated = [...ports];
    updated[idx].host = String(suggested);
    updated[idx].in_use = false;
    setPorts(updated);
    toast.success(t('custom_install.port_applied', 'Porta {{port}} aplicada!', { port: suggested }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validPorts = ports
      .filter(p => p.host.trim() !== '' && p.container.trim() !== '')
      .map(p => ({
        host: parseInt(p.host, 10) || 0,
        container: parseInt(p.container, 10) || 0,
        protocol: p.protocol || 'tcp'
      }));

    const validVolumes = volumes
      .filter(v => v.host.trim() !== '' && v.container.trim() !== '')
      .map(v => ({
        host: v.host.trim(),
        container: v.container.trim()
      }));

    const validEnv: Record<string, string> = {};
    envVars.forEach(item => {
      const k = item.key.trim();
      if (k) validEnv[k] = item.value;
    });

    onInstall({
      ports: validPorts,
      volumes: validVolumes,
      env: validEnv
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-primary animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orbit-500/15 border border-orbit-500/30 flex items-center justify-center text-orbit-500">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                {t('custom_install.title', 'Personalizar Instalação')}
              </h2>
              <span className="text-xs text-secondary font-mono">
                {appName || appId}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors" 
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-5 gap-4 bg-muted/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ports')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'ports'
                ? 'border-orbit-500 text-orbit-500 font-bold'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('custom_install.tab_ports', 'Portas de Rede')}
            {ports.some(p => p.in_use) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('volumes')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'volumes'
                ? 'border-orbit-500 text-orbit-500 font-bold'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            {t('custom_install.tab_volumes', 'Volumes & Pastas')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('env')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'env'
                ? 'border-orbit-500 text-orbit-500 font-bold'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Key className="w-4 h-4" />
            {t('custom_install.tab_env', 'Variáveis de Ambiente')}
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-orbit-500" />
              <span className="text-xs text-secondary">{t('common.loading', 'Carregando configurações...')}</span>
            </div>
          ) : (
            <>
              {/* PORTS TAB */}
              {activeTab === 'ports' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{t('custom_install.ports_heading', 'Mapeamento de Portas')}</h3>
                      <p className="text-xs text-secondary mt-0.5">{t('custom_install.ports_sub', 'Redirecione as portas do contêiner para o host evitando conflitos.')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => checkPortConflicts(ports)}
                        disabled={checkingPorts}
                        className="text-xs flex items-center gap-1.5 bg-accent/60 hover:bg-accent text-secondary hover:text-primary border border-border px-2.5 py-1.5 rounded-xl transition-colors"
                        title="Verificar conflitos de portas com o host"
                      >
                        <RefreshCw className={`w-3 h-3 text-orbit-500 ${checkingPorts ? 'animate-spin' : ''}`} />
                        <span>{checkingPorts ? 'Checando...' : 'Checar Conflitos'}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPorts([...ports, { host: '', container: '', protocol: 'tcp' }])}
                        className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5 text-orbit-500" /> {t('common.add', 'Adicionar')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {ports.map((port, idx) => (
                      <div key={idx} className="bg-background/80 border border-border p-3 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                              {t('custom_install.host_port', 'Porta do Host')}
                            </label>
                            <input
                              type="number"
                              placeholder="Host"
                              value={port.host}
                              onChange={(e) => {
                                const newPorts = [...ports];
                                newPorts[idx].host = e.target.value;
                                setPorts(newPorts);
                              }}
                              onBlur={() => checkPortConflicts(ports)}
                              className={`w-full bg-card border rounded-xl px-3 py-1.5 text-sm text-primary font-mono transition-all ${
                                port.in_use ? 'border-rose-500 bg-rose-500/10' : 'border-border focus:border-orbit-500'
                              }`}
                            />
                          </div>

                          <span className="text-secondary font-bold font-mono pt-4">:</span>

                          <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                              {t('custom_install.container_port', 'Porta Container')}
                            </label>
                            <input
                              type="number"
                              placeholder="Container"
                              value={port.container}
                              onChange={(e) => {
                                const newPorts = [...ports];
                                newPorts[idx].container = e.target.value;
                                setPorts(newPorts);
                              }}
                              className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-primary font-mono"
                            />
                          </div>

                          <div className="w-24">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                              {t('custom_install.protocol', 'Protocolo')}
                            </label>
                            <select
                              value={port.protocol}
                              onChange={(e) => {
                                const newPorts = [...ports];
                                newPorts[idx].protocol = e.target.value;
                                setPorts(newPorts);
                              }}
                              className="w-full bg-card border border-border rounded-xl px-2 py-1.5 text-xs text-primary font-mono"
                            >
                              <option value="tcp">TCP</option>
                              <option value="udp">UDP</option>
                            </select>
                          </div>

                          <div className="pt-4">
                            <button 
                              type="button" 
                              onClick={() => setPorts(ports.filter((_, i) => i !== idx))}
                              className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                              title="Remover"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Port Conflict Alert */}
                        {port.in_use && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>{t('custom_install.port_conflict_alert', 'Porta {{port}} já está em uso no host!', { port: port.host })}</span>
                            </div>
                            {port.suggested_port && (
                              <button
                                type="button"
                                onClick={() => applySuggestedPort(idx, port.suggested_port!)}
                                className="px-2 py-0.5 bg-rose-500 text-white rounded font-bold text-[10px] hover:bg-rose-600 transition-colors"
                              >
                                {t('custom_install.use_suggested', 'Usar {{port}}', { port: port.suggested_port })}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VOLUMES TAB */}
              {activeTab === 'volumes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{t('custom_install.volumes_heading', 'Mapeamento de Pastas')}</h3>
                      <p className="text-xs text-secondary mt-0.5">{t('custom_install.volumes_sub', 'Defina os caminhos no host onde os dados persistentes serão gravados.')}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setVolumes([...volumes, { host: `/app/data/apps/${appId}`, container: '/data' }])}
                      className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-orbit-500" /> {t('common.add', 'Adicionar')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {volumes.map((vol, idx) => (
                      <div key={idx} className="bg-background/80 border border-border p-3 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                              {t('custom_install.host_path', 'Caminho no Host')}
                            </label>
                            <input
                              placeholder="/app/data/apps/..."
                              value={vol.host}
                              onChange={(e) => {
                                const newVols = [...volumes];
                                newVols[idx].host = e.target.value;
                                setVolumes(newVols);
                              }}
                              className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-primary font-mono focus:border-orbit-500"
                            />
                          </div>

                          <span className="text-secondary font-bold font-mono pt-4">:</span>

                          <div className="w-1/3">
                            <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                              {t('custom_install.container_path', 'Ponto no Container')}
                            </label>
                            <input
                              placeholder="/config"
                              value={vol.container}
                              onChange={(e) => {
                                const newVols = [...volumes];
                                newVols[idx].container = e.target.value;
                                setVolumes(newVols);
                              }}
                              className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-primary font-mono"
                            />
                          </div>

                          <div className="pt-4">
                            <button 
                              type="button" 
                              onClick={() => setVolumes(volumes.filter((_, i) => i !== idx))}
                              className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                              title="Remover"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ENV VARS TAB */}
              {activeTab === 'env' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{t('custom_install.env_heading', 'Variáveis de Ambiente')}</h3>
                      <p className="text-xs text-secondary mt-0.5">{t('custom_install.env_sub', 'Ajuste credenciais, PUID/PGID, fuso horário e parâmetros de inicialização.')}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                      className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-orbit-500" /> {t('common.add', 'Adicionar')}
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {envVars.map((env, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          placeholder="CHAVE"
                          value={env.key}
                          onChange={(e) => {
                            const newEnv = [...envVars];
                            newEnv[idx].key = e.target.value;
                            setEnvVars(newEnv);
                          }}
                          className="w-1/3 bg-background border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold focus:border-orbit-500"
                        />
                        <span className="text-secondary font-bold font-mono">=</span>
                        <input
                          placeholder="VALOR"
                          value={env.value}
                          onChange={(e) => {
                            const newEnv = [...envVars];
                            newEnv[idx].value = e.target.value;
                            setEnvVars(newEnv);
                          }}
                          className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono focus:border-orbit-500"
                        />
                        <button 
                          type="button" 
                          onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))}
                          className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="Remover"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </form>
        
        {/* Footer Actions */}
        <div className="p-4 sm:px-6 border-t border-border flex items-center justify-between bg-muted/20 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-secondary hover:text-primary hover:bg-accent/60 rounded-xl transition-colors text-xs font-medium"
          >
            {t('common.cancel', 'Cancelar')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-orbit-500 text-white rounded-xl font-semibold hover:bg-orbit-600 active:scale-95 shadow-md shadow-orbit-500/25 transition-all text-xs flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {t('custom_install.confirm_install', 'Confirmar e Instalar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
