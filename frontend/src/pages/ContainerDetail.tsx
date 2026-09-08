import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, RotateCw, Pause, PlayCircle, Trash2, Terminal as TerminalIcon, AlignLeft, Info, ExternalLink, DownloadCloud } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { resolveWebUrl } from '../utils/url';
import { getIconForImage } from '../utils/icons';
import { ContainerIcon } from '../components/ui/ContainerIcon';
import {
  ContainerOverviewTab,
  type ContainerData,
  type StatPoint,
  type EnvVariable,
} from '../components/docker/container-detail/ContainerOverviewTab';
import { ContainerLogsTab } from '../components/docker/container-detail/ContainerLogsTab';
import { ContainerTerminalTab } from '../components/docker/container-detail/ContainerTerminalTab';
import { ContainerDeleteModal } from '../components/docker/container-detail/ContainerDeleteModal';
import { pollContainerUpdate } from '../utils/batchUpdateRunner';

const toEnvVariables = (env: string[] = []): EnvVariable[] => env.map((entry) => {
  const [key, ...value] = entry.split('=');
  return { key, value: value.join('=') };
});

const isHiddenEnv = (key: string) => key === 'PATH' || key === 'NODE_PATH';

export function ContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [container, setContainer] = useState<ContainerData | null>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [logs, setLogs] = useState<string>('');
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'terminal'>('overview');

  const [editingEnv, setEditingEnv] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [hiddenEnvVariables, setHiddenEnvVariables] = useState<EnvVariable[]>([]);
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  const [editingVolumes, setEditingVolumes] = useState(false);
  const [volumeVariables, setVolumeVariables] = useState<{ host: string; container: string }[]>([]);
  const [volumeSaving, setVolumeSaving] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({
    volumes: false,
    image: false,
    network: false,
  });

  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (id) {
      const token = localStorage.getItem('orbit_token');
      fetch(`/api/docker/containers/${id}/check-update`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.has_update) {
            setHasUpdate(true);
          }
        })
        .catch(() => {});
    }
  }, [id]);

  const fetchContainer = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/containers', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list: ContainerData[] = await res.json();
        const found = list.find(c => c.id.startsWith(id || ''));
        if (found) {
          setContainer(found);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInspect = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/docker/containers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInspectData(data);
        if (!editingEnv) {
          const allEnvs = toEnvVariables(data?.Config?.Env);
          setEnvVariables(allEnvs.filter(e => !isHiddenEnv(e.key)));
          setHiddenEnvVariables(allEnvs.filter(e => isHiddenEnv(e.key)));
        }
        if (!editingVolumes) {
          const binds: string[] = data?.HostConfig?.Binds || [];
          setVolumeVariables(binds.map(b => {
            const parts = b.split(':');
            return { host: parts[0] || '', container: parts[1] || '' };
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/docker/containers/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const text = await res.text();
        setLogs(text);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const statsRes = await fetch('/api/docker/containers/stats/snapshot', { headers: { Authorization: `Bearer ${token}` } });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const stat = statsData.find((s: any) => s.id.startsWith(id || ''));
        if (stat) {
          setHistory(prev => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const memMB = stat.memory_used / 1024 / 1024;
            const limMB = stat.memory_limit / 1024 / 1024;
            
            const newData = [...prev, { time: timeStr, cpu: stat.cpu_percent, memory: memMB, memory_limit: limMB }];
            if (newData.length > 30) return newData.slice(newData.length - 30);
            return newData;
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pollUpdateStatus = async (token: string | null) => {
    if (!id) return;
    const cleanName = (container?.name || id).replace(/^\//, '');
    const result = await pollContainerUpdate({
      containerId: id,
      cleanName,
      token,
      signal: new AbortController().signal,
    });

    if (result.success) {
      setHasUpdate(false);
      toast.success('Container atualizado e reiniciado com sucesso!');
      await fetchContainer();
      await fetchInspect();
    } else if (!result.wasCancelled) {
      toast.error(`Falha ao atualizar container: ${result.error || 'Erro desconhecido'}`);
    }
  };

  useEffect(() => {
    if (!id) return;

    // Se a página foi recarregada (F5) enquanto uma exclusão estava em andamento
    if (sessionStorage.getItem(`orbit_deleting_${id}`)) {
      sessionStorage.removeItem(`orbit_deleting_${id}`);
      toast('A exclusão do container continua em andamento em segundo plano.', { icon: '🗑️' });
      navigate('/containers');
      return;
    }

    fetchContainer();
    fetchStats();
    fetchInspect();

    // Verifica se há atualização em segundo plano já ativa no servidor após F5
    const token = localStorage.getItem('orbit_token');
    fetch(`/api/docker/containers/${id}/update-status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then(task => {
        if (task && (task.status === 'pulling' || task.status === 'recreating')) {
          setUpdating(true);
          toast('Recuperando processo de atualização em andamento...', { icon: '⏳' });
          pollUpdateStatus(token).finally(() => {
            setUpdating(false);
            sessionStorage.removeItem(`orbit_updating_${id}`);
          });
        }
      })
      .catch(() => {});
    
    const interval = setInterval(() => {
      fetchContainer();
      fetchStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [id, navigate]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleUpdate = async () => {
    if (!id) return;
    setUpdating(true);
    sessionStorage.setItem(`orbit_updating_${id}`, 'true');
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch(`/api/docker/containers/${id}/update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const rawText = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!res.ok || data?.status === 'error') {
        let err = data?.message || rawText;
        if (rawText.includes('<!DOCTYPE html') || rawText.includes('<html')) {
          err = 'Tempo limite ou erro retornado pelo proxy intermediário/rede.';
        }
        toast.error(`Falha ao atualizar container: ${err}`);
        return;
      }

      if (data?.status === 'success') {
        setHasUpdate(false);
        toast.success('Container atualizado e reiniciado com sucesso!');
        await fetchContainer();
        await fetchInspect();
        return;
      }

      toast('Download da imagem iniciado em segundo plano...', { icon: '⏳' });
      await pollUpdateStatus(token);
    } catch (e) {
      console.error('Update error:', e);
      toast.error('Erro de conexão ao atualizar container.');
    } finally {
      setUpdating(false);
      sessionStorage.removeItem(`orbit_updating_${id}`);
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
    if (!container) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('orbit_token');
      await fetch(`/api/docker/containers/${container.id}/${action}`, { 
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchContainer();
    } catch (err) {
      console.error(`Failed to ${action} container`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!container) return;
    setActionLoading(true);
    sessionStorage.setItem(`orbit_deleting_${id}`, 'true');
    const loadingToast = toast.loading('Parando e excluindo container com segurança...');
    try {
      const token = localStorage.getItem('orbit_token');
      
      const query = new URLSearchParams();
      if (deleteOptions.volumes) query.append('v', 'true');
      if (deleteOptions.image) query.append('image', 'true');
      if (deleteOptions.network) query.append('network', 'true');

      const url = `/api/docker/containers/${id}?${query.toString()}`;

      const res = await fetch(url, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      
      sessionStorage.removeItem(`orbit_deleting_${id}`);
      toast.success('Container excluído com sucesso!', { id: loadingToast });
      navigate('/containers');
    } catch (err) {
      sessionStorage.removeItem(`orbit_deleting_${id}`);
      console.error('Failed to delete container', err);
      toast.error('Erro ao excluir o container.', { id: loadingToast });
      setActionLoading(false);
    }
  };

  const beginEnvEdit = () => {
    const allEnvs = toEnvVariables(inspectData?.Config?.Env);
    setEnvVariables(allEnvs.filter(e => !isHiddenEnv(e.key)));
    setHiddenEnvVariables(allEnvs.filter(e => isHiddenEnv(e.key)));
    setEnvError(null);
    setEditingEnv(true);
  };

  const updateEnvField = (index: number, field: keyof EnvVariable, value: string) => {
    setEnvVariables((current) => current.map((variable, currentIndex) =>
      currentIndex === index ? { ...variable, [field]: value } : variable
    ));
  };

  const handleUpdateEnv = async () => {
    if (!container) return;
    const invalid = envVariables.some(({ key }) => !key.trim());
    if (invalid) {
      setEnvError('Cada variável precisa ter uma chave. Remova as linhas vazias antes de salvar.');
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: 'Editar Variáveis de Ambiente',
      message: 'Salvar recriará o container. Ele ficará indisponível por alguns segundos, terá um novo ID e volumes anônimos podem perder dados. Deseja continuar?',
      onConfirm: async () => {
        setEnvSaving(true);
        setEnvError(null);
        try {
          const token = localStorage.getItem('orbit_token');
          const fullEnvVariables = [...envVariables, ...hiddenEnvVariables];
          const response = await fetch(`/api/docker/containers/${container.id}/env`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ env: fullEnvVariables.map(({ key, value }) => `${key}=${value}`) }),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const recreated = await response.json().catch(() => null);
          setEditingEnv(false);
          if (recreated?.id) {
            navigate(`/containers/${recreated.id}`);
          } else {
            await fetchInspect();
            await fetchContainer();
          }
        } catch (error) {
          console.error('Failed to update environment variables', error);
          setEnvError('Não foi possível recriar o container com as novas variáveis. Nenhuma alteração adicional foi aplicada.');
        } finally {
          setEnvSaving(false);
        }
      }
    });
  };

  const beginVolumeEdit = () => {
    const binds: string[] = inspectData?.HostConfig?.Binds || [];
    setVolumeVariables(binds.map(b => {
      const parts = b.split(':');
      return { host: parts[0] || '', container: parts[1] || '' };
    }));
    setVolumeError(null);
    setEditingVolumes(true);
  };

  const updateVolumeField = (index: number, field: 'host' | 'container', value: string) => {
    setVolumeVariables((current) => current.map((variable, currentIndex) =>
      currentIndex === index ? { ...variable, [field]: value } : variable
    ));
  };

  const handleUpdateVolumes = async () => {
    if (!container) return;
    const invalid = volumeVariables.some(({ host, container }) => !host.trim() || !container.trim());
    if (invalid) {
      setVolumeError('Cada volume precisa ter um Host Path e um Container Path válidos.');
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: 'Editar Volumes (Binds)',
      message: 'Salvar recriará o container. Ele ficará indisponível por alguns segundos, terá um novo ID e volumes anônimos (não listados) podem perder dados. Deseja continuar?',
      onConfirm: async () => {
        setVolumeSaving(true);
        setVolumeError(null);
        try {
          const token = localStorage.getItem('orbit_token');
          const response = await fetch(`/api/docker/containers/${container.id}/volumes`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ volumes: volumeVariables.map(({ host, container }) => `${host}:${container}`) }),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const recreated = await response.json().catch(() => null);
          setEditingVolumes(false);
          if (recreated?.id) {
            navigate(`/containers/${recreated.id}`);
          } else {
            await fetchInspect();
            await fetchContainer();
          }
        } catch (error) {
          console.error('Failed to update volumes', error);
          setVolumeError('Não foi possível recriar o container com os novos volumes. Nenhuma alteração adicional foi aplicada.');
        } finally {
          setVolumeSaving(false);
        }
      }
    });
  };

  const renderPorts = () => {
    const links = [];
    const ports = inspectData?.NetworkSettings?.Ports;
    
    if (ports && Object.keys(ports).length > 0) {
      for (const [containerPort, hostBindings] of Object.entries(ports)) {
        if (hostBindings) {
          for (const binding of (hostBindings as any[])) {
            const hostPort = binding.HostPort;
            const targetUrl = resolveWebUrl(hostPort);
            links.push(
              <a key={`${containerPort}-${hostPort}`} href={targetUrl} target="_blank" rel="noreferrer" className="inline-block bg-accent hover:bg-orbit-700 text-secondary px-2 py-1 rounded text-xs font-mono transition-colors mr-2 mb-2">
                {hostPort} → {containerPort}
              </a>
            );
          }
        }
      }
    } else if (inspectData?.HostConfig?.NetworkMode === 'host' || inspectData?.NetworkSettings?.Networks?.host) {
      const exposed = inspectData?.Config?.ExposedPorts;
      if (exposed) {
        for (const portKey of Object.keys(exposed)) {
          const hostPort = portKey.split('/')[0];
          const targetUrl = resolveWebUrl(hostPort);
          links.push(
            <a key={`host-${hostPort}`} href={targetUrl} target="_blank" rel="noreferrer" className="inline-block bg-accent hover:bg-orbit-700 text-secondary px-2 py-1 rounded text-xs font-mono transition-colors mr-2 mb-2">
              {hostPort} (Host Network)
            </a>
          );
        }
      }
    }

    return links.length > 0 ? <div className="flex flex-wrap">{links}</div> : <span className="text-secondary text-sm">Nenhuma porta mapeada para o host</span>;
  };

  if (!container) {
    return (
      <div className="flex items-center justify-center h-full text-secondary">
        Carregando detalhes do container...
      </div>
    );
  }

  const latestStat = history[history.length - 1];
  const cpuPercent = latestStat ? latestStat.cpu.toFixed(1) : '0.0';
  const memUsed = latestStat ? latestStat.memory.toFixed(1) : '0.0';
  const memLimit = latestStat ? latestStat.memory_limit.toFixed(1) : '0.0';

  const getFirstMappedPort = () => {
    if (!inspectData?.NetworkSettings?.Ports) return null;
    const ports = inspectData.NetworkSettings.Ports;
    for (const hostBindings of Object.values(ports)) {
      if (hostBindings && (hostBindings as any[]).length > 0) {
        return (hostBindings as any[])[0].HostPort;
      }
    }
    return null;
  };
  const appPort = getFirstMappedPort();

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate('/containers')}
            className="p-2 bg-card border border-border rounded-md text-secondary hover:text-primary hover:bg-accent transition-colors shrink-0"
            aria-label="Voltar para containers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center border border-border/80 shadow-sm shrink-0 p-1">
            <ContainerIcon
              src={getIconForImage(container.image, container.name)}
              name={container.name}
              image={container.image}
              size={28}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 truncate">
              <span className="truncate">{container.name}</span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border shrink-0 ${
                container.state.toLowerCase() === 'running' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : container.state.toLowerCase() === 'paused'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
              }`}>
                {container.state.toUpperCase()}
              </span>
            </h2>
            <p className="text-secondary font-mono text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{container.image} • {container.id.substring(0, 12)}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {appPort && (
            <a 
              href={`http://${window.location.hostname}:${appPort}`} 
              target="_blank" 
              rel="noreferrer"
              title="Abrir Aplicação"
              className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-orbit-700 hover:text-white hover:border-orbit-600 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Abrir
            </a>
          )}
          {container.state.toLowerCase() === 'running' ? (
            <>
              <button onClick={() => handleAction('stop')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
                <Square className="w-4 h-4" /> Parar
              </button>
              <button onClick={() => handleAction('pause')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
                <Pause className="w-4 h-4" /> Pausar
              </button>
              <button onClick={() => handleAction('restart')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
                <RotateCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} /> Reiniciar
              </button>
            </>
          ) : container.state.toLowerCase() === 'paused' ? (
            <>
              <button onClick={() => handleAction('unpause')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
                <PlayCircle className="w-4 h-4" /> Retomar
              </button>
              <button onClick={() => handleAction('stop')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all">
                <Square className="w-4 h-4" /> Parar
              </button>
            </>
          ) : (
            <button onClick={() => handleAction('start')} disabled={actionLoading} className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg shadow-emerald-900/20">
              <Play className="w-4 h-4" /> Iniciar
            </button>
          )}
          
          <button 
            onClick={handleUpdate} 
            disabled={updating || actionLoading} 
            className={`px-3 sm:px-4 py-2 rounded-md text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg relative ${
              hasUpdate
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 ring-2 ring-violet-400/50 shadow-violet-900/30'
                : 'bg-orbit-600 hover:bg-orbit-500 shadow-orbit-900/20'
            }`}
            title={hasUpdate ? 'Nova versão da imagem disponível para seu dispositivo! Clique para atualizar e reiniciar.' : 'Buscar nova imagem do container e reiniciar'}
          >
            <DownloadCloud className={`w-4 h-4 ${updating ? 'animate-bounce' : ''}`} /> 
            <span>{updating ? 'Atualizando...' : 'Atualizar'}</span>
            {hasUpdate && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            )}
          </button>

          <div className="w-px h-6 sm:h-8 bg-white/10 mx-1"></div>
          <button 
            onClick={() => setShowDeleteModal(true)} 
            disabled={actionLoading} 
            title="Excluir Container"
            className="p-2 bg-accent border border-border hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 rounded-md text-secondary transition-all"
            aria-label="Excluir container"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex space-x-1 bg-card/50 border border-border rounded-lg p-1 overflow-x-auto scrollbar-none">
        <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-accent text-primary shadow' : 'text-secondary hover:text-primary'}`}>
          <Info className="w-4 h-4 shrink-0" /> Visão Geral
        </button>
        <button onClick={() => setActiveTab('logs')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'logs' ? 'bg-accent text-primary shadow' : 'text-secondary hover:text-primary'}`}>
          <AlignLeft className="w-4 h-4 shrink-0" /> Logs
        </button>
        <button onClick={() => setActiveTab('terminal')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'terminal' ? 'bg-accent text-primary shadow' : 'text-secondary hover:text-primary'}`}>
          <TerminalIcon className="w-4 h-4 shrink-0" /> Terminal
        </button>
      </div>

      {activeTab === 'overview' && (
        <ContainerOverviewTab
          container={container}
          inspectData={inspectData}
          history={history}
          cpuPercent={cpuPercent}
          memUsed={memUsed}
          memLimit={memLimit}
          hasUpdate={hasUpdate}
          updating={updating}
          onUpdate={handleUpdate}
          renderPorts={renderPorts}
          editingEnv={editingEnv}
          envVariables={envVariables}
          envSaving={envSaving}
          envError={envError}
          beginEnvEdit={beginEnvEdit}
          updateEnvField={updateEnvField}
          setEnvVariables={setEnvVariables}
          handleUpdateEnv={handleUpdateEnv}
          setEditingEnv={setEditingEnv}
          setEnvError={setEnvError}
          editingVolumes={editingVolumes}
          volumeVariables={volumeVariables}
          volumeSaving={volumeSaving}
          volumeError={volumeError}
          beginVolumeEdit={beginVolumeEdit}
          updateVolumeField={updateVolumeField}
          setVolumeVariables={setVolumeVariables}
          handleUpdateVolumes={handleUpdateVolumes}
          setEditingVolumes={setEditingVolumes}
          setVolumeError={setVolumeError}
          isHiddenEnv={isHiddenEnv}
        />
      )}

      {activeTab === 'logs' && (
        <ContainerLogsTab logs={logs} onRefresh={fetchLogs} />
      )}

      {activeTab === 'terminal' && (
        <ContainerTerminalTab id={id!} />
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.onConfirm}
        isDestructive={false}
        confirmText="Sim, continuar"
      />

      <ContainerDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        containerName={container.name}
        deleteOptions={deleteOptions}
        setDeleteOptions={setDeleteOptions}
        onConfirm={executeDelete}
      />
    </div>
  );
}
