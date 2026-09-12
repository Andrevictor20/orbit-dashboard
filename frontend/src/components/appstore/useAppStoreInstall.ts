import { useState } from 'react';
import toast from 'react-hot-toast';
import { useInstall } from '../../contexts/InstallContext';
import type { PortConflictItem } from '../docker/PortConflictDialog';

export interface PortConflictModalData {
  isOpen: boolean;
  appId: string;
  appName: string;
  conflicts: PortConflictItem[];
  rawInspection?: any;
}

export function useAppStoreInstall() {
  const { startInstall } = useInstall();
  const [installing, setInstalling] = useState<string | null>(null);
  const [customModalApp, setCustomModalApp] = useState<{ id: string; name: string } | null>(null);
  const [portConflictData, setPortConflictData] = useState<PortConflictModalData | null>(null);
  const [isDockerInstallOpen, setIsDockerInstallOpen] = useState(false);

  const handleInstall = async (id: string, appName: string) => {
    try {
      setInstalling(id);
      const token = localStorage.getItem('orbit_token');

      // 1. Inspeciona a configuração de portas antes de iniciar o download
      try {
        const configRes = await fetch(`/api/store/apps/${id}/config`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (configRes.ok) {
          const configData = await configRes.json();
          const hostPorts = (configData.ports || [])
            .map((p: any) => p.host)
            .filter((p: any) => typeof p === 'number' && p > 0);

          if (hostPorts.length > 0) {
            const checkRes = await fetch('/api/docker/ports/check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ ports: hostPorts })
            });

            if (checkRes.ok) {
              const checkData = await checkRes.json();
              const conflicts: PortConflictItem[] = checkData.conflicts || [];
              const hasInUse = conflicts.some(c => c.in_use);

              if (hasInUse) {
                setPortConflictData({
                  isOpen: true,
                  appId: id,
                  appName,
                  conflicts,
                  rawInspection: configData,
                });
                setInstalling(null);
                return;
              }
            }
          }
        }
      } catch (checkErr) {
        console.warn('Pre-install port check skipped:', checkErr);
      }

      // 2. Sem conflito de portas -> prossegue com a instalação direta
      const res = await fetch(`/api/store/install/${id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Installation failed');
      }

      const data = await res.json();
      if (data.task_id) {
        startInstall(data.task_id, appName);
      }
    } catch (err: any) {
      console.error('Install error:', err);
      toast.error(err.message || 'Erro ao iniciar instalação');
    } finally {
      setInstalling(null);
    }
  };

  const handleCustomInstall = async (payload: any, overrideApp?: { id: string; name: string }) => {
    const target = overrideApp || customModalApp;
    if (!target) return;
    const { id, name } = target;
    try {
      setInstalling(id);
      setCustomModalApp(null);
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/store/install/custom/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Falha na instalação personalizada');
      }

      const data = await res.json();
      if (data.task_id) {
        startInstall(data.task_id, name);
      }
    } catch (err: any) {
      console.error('Custom install error:', err);
      toast.error(err.message || 'Erro ao instalar aplicativo');
    } finally {
      setInstalling(null);
    }
  };

  const handleAcceptSuggestedPorts = async () => {
    if (!portConflictData) return;
    const { appId, appName, conflicts, rawInspection } = portConflictData;
    setPortConflictData(null);

    const conflictMap = new Map<number, number>();
    conflicts.forEach(c => {
      if (c.in_use) {
        conflictMap.set(c.host_port, c.suggested_port);
      }
    });

    const adjustedPorts = (rawInspection?.ports || []).map((p: any) => ({
      host: conflictMap.get(p.host) ?? p.host,
      container: p.container,
      protocol: p.protocol || 'tcp',
    }));

    const payload = {
      ports: adjustedPorts,
      volumes: rawInspection?.volumes,
      env: rawInspection?.env,
    };

    await handleCustomInstall(payload, { id: appId, name: appName });
  };

  const handleOpenCustomFromConflict = () => {
    if (!portConflictData) return;
    const { appId, appName } = portConflictData;
    setPortConflictData(null);
    setCustomModalApp({ id: appId, name: appName });
  };

  return {
    installing,
    customModalApp,
    setCustomModalApp,
    portConflictData,
    setPortConflictData,
    isDockerInstallOpen,
    setIsDockerInstallOpen,
    handleInstall,
    handleCustomInstall,
    handleAcceptSuggestedPorts,
    handleOpenCustomFromConflict,
  };
}
