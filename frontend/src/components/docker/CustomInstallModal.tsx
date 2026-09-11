import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Terminal, Layers, HardDrive, ShieldCheck, RefreshCw, Key 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FolderPickerModal } from '../files/FolderPickerModal';
import { CustomInstallPortsTab, type PortMappingItem } from './custom-install/CustomInstallPortsTab';
import { CustomInstallVolumesTab, type VolumeMappingItem } from './custom-install/CustomInstallVolumesTab';
import { CustomInstallEnvTab, type EnvVarItem } from './custom-install/CustomInstallEnvTab';

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
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [pickerVolumeIndex, setPickerVolumeIndex] = useState<number | null>(null);

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

          if (!initialEnv.some(e => e.key === 'PUID')) initialEnv.unshift({ key: 'PUID', value: '1000' });
          if (!initialEnv.some(e => e.key === 'PGID')) initialEnv.unshift({ key: 'PGID', value: '1000' });
          if (!initialEnv.some(e => e.key === 'TZ')) initialEnv.unshift({ key: 'TZ', value: 'UTC' });

          setPorts(initialPorts.length > 0 ? initialPorts : [{ host: '8080', container: '80', protocol: 'tcp' }]);
          setVolumes(initialVolumes.length > 0 ? initialVolumes : [{ host: `/app/data/apps/${appId}/config`, container: '/config' }]);
          setEnvVars(initialEnv);

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
              {activeTab === 'ports' && (
                <CustomInstallPortsTab
                  ports={ports}
                  setPorts={setPorts}
                  checkingPorts={checkingPorts}
                  onCheckConflicts={checkPortConflicts}
                  onApplySuggestedPort={applySuggestedPort}
                />
              )}

              {activeTab === 'volumes' && (
                <CustomInstallVolumesTab
                  volumes={volumes}
                  setVolumes={setVolumes}
                  appId={appId}
                  onOpenFolderPicker={(idx) => {
                    setPickerVolumeIndex(idx);
                    setIsFolderPickerOpen(true);
                  }}
                />
              )}

              {activeTab === 'env' && (
                <CustomInstallEnvTab
                  envVars={envVars}
                  setEnvVars={setEnvVars}
                />
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

        {/* Mini Folder Picker Modal */}
        <FolderPickerModal
          isOpen={isFolderPickerOpen}
          initialPath={pickerVolumeIndex !== null && volumes[pickerVolumeIndex]?.host ? volumes[pickerVolumeIndex].host : `/app/data/apps/${appId}`}
          onClose={() => {
            setIsFolderPickerOpen(false);
            setPickerVolumeIndex(null);
          }}
          onSelect={(selectedPath) => {
            if (pickerVolumeIndex !== null) {
              const updated = [...volumes];
              updated[pickerVolumeIndex].host = selectedPath;
              setVolumes(updated);
            }
          }}
        />
      </div>
    </div>
  );
}
