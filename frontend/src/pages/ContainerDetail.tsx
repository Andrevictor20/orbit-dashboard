import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, HardDrive, Play, Square, RotateCw, Pause, PlayCircle, Trash2, Terminal as TerminalIcon, AlignLeft, Info, ExternalLink, Pencil, Plus, X, Copy, ClipboardPaste, CheckCircle2, DownloadCloud, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { formatBytes } from '../utils/format';
import { resolveWebUrl } from '../utils/url';
import { getIconForImage } from '../utils/icons';
import { ContainerIcon } from '../components/ui/ContainerIcon';

interface ContainerData {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  size_rw?: number;
  size_root_fs?: number;
}

interface StatPoint {
  time: string;
  cpu: number;
  memory: number;
  memory_limit: number;
}

interface EnvVariable {
  key: string;
  value: string;
}

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

  const handleUpdate = async () => {
    if (!id) return;
    setUpdating(true);
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

      // If finished synchronously
      if (data?.status === 'success') {
        setHasUpdate(false);
        toast.success('Container atualizado e reiniciado com sucesso!');
        await fetchContainer();
        await fetchInspect();
        return;
      }

      // Polling background update
      toast('Download da imagem iniciado em segundo plano...', { icon: '⏳' });
      let completed = false;
      let retries = 0;
      while (!completed && retries < 180) { // up to 6 minutes
        await new Promise(r => setTimeout(r, 2000));
        retries++;
        try {
          const statusRes = await fetch(`/api/docker/containers/${id}/update-status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!statusRes.ok) continue;
          const task = await statusRes.json().catch(() => null);
          if (!task) continue;

          if (task.status === 'success') {
            completed = true;
            setHasUpdate(false);
            toast.success('Container atualizado e reiniciado com sucesso!');
            await fetchContainer();
            await fetchInspect();
          } else if (task.status === 'error') {
            completed = true;
            toast.error(`Falha ao atualizar container: ${task.error || 'Erro desconhecido'}`);
          }
        } catch {
          // Transient network reconnection retry
        }
      }
    } catch (e) {
      console.error('Update error:', e);
      toast.error('Erro de conexão ao atualizar container.');
    } finally {
      setUpdating(false);
    }
  };
  const [editingEnv, setEditingEnv] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [hiddenEnvVariables, setHiddenEnvVariables] = useState<EnvVariable[]>([]);
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  const [editingVolumes, setEditingVolumes] = useState(false);
  const [volumeVariables, setVolumeVariables] = useState<{host: string, container: string}[]>([]);
  const [volumeSaving, setVolumeSaving] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [copiedLogs, setCopiedLogs] = useState(false);
  
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
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  useEffect(() => {
    fetchContainer();
    fetchStats();
    fetchInspect();
    
    const interval = setInterval(() => {
      fetchContainer();
      fetchStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'terminal') {
      // Setup Xterm
      if (!terminalRef.current) return;
      terminalRef.current.innerHTML = '';
      
      const term = new XTerm({
        theme: {
          background: '#090d13',
          foreground: '#e6edf3',
          cursor: '#10b981',
          cursorAccent: '#090d13',
          selectionBackground: '#388bfd55',
          selectionForeground: '#ffffff',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#ffffff',
        },
        fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, monospace',
        fontSize: 14,
        lineHeight: 1.25,
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      requestAnimationFrame(() => fitAddon.fit());

      xtermRef.current = term;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/docker/containers/${id}/exec`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const sendResize = (cols: number, rows: number) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      };

      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        if (isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) {
          if (term.hasSelection() || event.shiftKey) {
            const selected = term.getSelection();
            if (selected) {
              navigator.clipboard.writeText(selected).then(() => toast.success('Copiado!')).catch(() => {});
              return false;
            }
          }
        }
        if (isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) {
          navigator.clipboard.readText().then(text => {
            if (text && ws.readyState === WebSocket.OPEN) ws.send(text);
          }).catch(() => {});
          return false;
        }
        return true;
      });

      ws.onopen = () => {
        term.writeln('\x1b[1;32mConectado ao shell do container...\x1b[0m');
        sendResize(term.cols, term.rows);
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[1;31mConexão encerrada.\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      term.onResize(({ cols, rows }) => sendResize(cols, rows));

      const handleResize = () => {
        fitAddon.fit();
        sendResize(term.cols, term.rows);
      };
      window.addEventListener('resize', handleResize);

      const observer = new ResizeObserver(() => handleResize());
      observer.observe(terminalRef.current);

      return () => {
        window.removeEventListener('resize', handleResize);
        observer.disconnect();
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        term.dispose();
        xtermRef.current = null;
      };
    }
  }, [activeTab, id]);

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

  const confirmDeleteContainer = () => {
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!container) return;
    setActionLoading(true);
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
      
      toast.success('Container excluído com sucesso!', { id: loadingToast });
      navigate('/containers');
    } catch (err) {
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


  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs', err);
    }
  };

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
            onClick={confirmDeleteContainer} 
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
        <>
          {hasUpdate && (
            <div className="flex items-center justify-between p-3.5 mb-4 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-900 dark:text-violet-300 text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
                <div>
                  <span className="font-semibold text-primary dark:text-white">Atualização disponível</span>
                  <p className="text-xs text-secondary dark:text-zinc-400 mt-0.5 font-medium">Uma nova versão da imagem foi detectada para a arquitetura do seu dispositivo.</p>
                </div>
              </div>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-xs transition-colors shrink-0 shadow-md shadow-violet-900/30 flex items-center gap-1.5"
              >
                <DownloadCloud className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
                <span>{updating ? 'Atualizando...' : 'Atualizar Agora'}</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
              title="Uso de CPU" 
              value={`${cpuPercent}%`} 
              trend="Realtime"
              trendUp={parseFloat(cpuPercent) < 80}
              subText="Consumo atual do processo"
              icon={Activity}
            />
            <StatCard 
              title="Uso de Memória" 
              value={`${memUsed} MB`} 
              trend={`${memLimit} MB`}
              trendUp={true}
              subText="Limite configurado"
              icon={HardDrive}
            />
            <StatCard 
              title="Armazenamento" 
              value={formatBytes((container.size_rw || 0) + (container.size_root_fs || 0))} 
              trend="RW + RootFS"
              trendUp={true}
              subText="Espaço ocupado em disco"
              icon={HardDrive}
            />
          </div>

          <div className="grid grid-cols-3 gap-6 flex-1">
            <div className="col-span-2 glass-panel rounded-xl p-6 min-h-[400px] flex flex-col border border-border">
              <h3 className="text-lg font-bold mb-6 text-primary flex items-center gap-2">
                <Activity className="w-5 h-5 text-secondary" />
                Desempenho em Tempo Real
              </h3>
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpuC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMemoryC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}MB`} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <Tooltip 
                      formatter={(value: any) => typeof value === 'number' ? value.toFixed(1) : value}
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#d4d4d4', fontWeight: 600 }}
                      labelStyle={{ color: '#a3a3a3', marginBottom: '4px' }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="cpu" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCpuC)" name="CPU (%)" />
                    <Area yAxisId="right" type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMemoryC)" name="RAM (MB)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="col-span-1 space-y-6">
              <div className="glass-panel rounded-xl p-6 border border-border">
                <h3 className="text-md font-bold mb-4 text-primary border-b border-border pb-2">Informações da Rede</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-secondary uppercase font-semibold">Acessos e Portas</span>
                    <div className="mt-2">
                      {renderPorts()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6 border border-border">
                <h3 className="text-md font-bold mb-4 text-primary border-b border-border pb-2">Ambiente & Config</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-secondary uppercase font-semibold">Criado em</span>
                    <p className="text-sm mt-1">{inspectData?.Created ? new Date(inspectData.Created).toLocaleString() : 'N/A'}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-secondary uppercase font-semibold">Variáveis (Env)</span>
                      {!editingEnv && <button type="button" onClick={beginEnvEdit} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary">
                        <Pencil className="w-3 h-3" /> Editar Variáveis
                      </button>}
                    </div>
                    {editingEnv ? <div className="mt-2 space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Salvar recriará o container, causando breve indisponibilidade e um novo ID.</p>
                      {envVariables.map((variable, index) => <div className="flex gap-2" key={index}>
                        <input aria-label={`Chave da variável ${index + 1}`} value={variable.key} onChange={(event) => updateEnvField(index, 'key', event.target.value)} placeholder="CHAVE" className="min-w-0 flex-1 rounded bg-black/40 border border-border px-2 py-1 text-xs font-mono" />
                        <input aria-label={`Valor da variável ${index + 1}`} value={variable.value} onChange={(event) => updateEnvField(index, 'value', event.target.value)} placeholder="valor" className="min-w-0 flex-1 rounded bg-black/40 border border-border px-2 py-1 text-xs font-mono" />
                        <button type="button" aria-label={`Remover variável ${index + 1}`} onClick={() => setEnvVariables((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="p-1 text-secondary hover:text-rose-400"><X className="w-4 h-4" /></button>
                      </div>)}
                      <button type="button" onClick={() => setEnvVariables((current) => [...current, { key: '', value: '' }])} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary"><Plus className="w-3 h-3" /> + Adicionar</button>
                      {envError && <p role="alert" className="text-xs text-rose-400">{envError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleUpdateEnv} disabled={envSaving} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{envSaving ? 'Salvando...' : 'Salvar alterações'}</button>
                        <button type="button" onClick={() => { setEditingEnv(false); setEnvError(null); }} disabled={envSaving} className="rounded bg-accent px-3 py-1.5 text-xs text-secondary">Cancelar</button>
                      </div>
                    </div> : <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
                      {inspectData?.Config?.Env ? inspectData.Config.Env.map((e: string, i: number) => {
                        const [key, ...val] = e.split('=');
                        if (isHiddenEnv(key)) return null;
                        return (
                          <div key={i} className="text-xs font-mono bg-black/50 p-1 rounded border border-border truncate" title={e}>
                            <span className="text-secondary">{key}</span>={val.join('=')}
                          </div>
                        )
                      }) : <span className="text-secondary text-sm">Nenhuma variável configurada</span>}
                    </div>}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-secondary uppercase font-semibold">Volumes (Binds)</span>
                      {!editingVolumes && <button type="button" onClick={beginVolumeEdit} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary">
                        <Pencil className="w-3 h-3" /> Editar Volumes
                      </button>}
                    </div>
                    {editingVolumes ? <div className="mt-2 space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Salvar recriará o container. Volumes anônimos podem ser perdidos.</p>
                      {volumeVariables.map((variable, index) => <div className="flex gap-2" key={index}>
                        <input aria-label={`Host path ${index + 1}`} value={variable.host} onChange={(event) => updateVolumeField(index, 'host', event.target.value)} placeholder="/host/path" className="min-w-0 flex-1 rounded bg-black/40 border border-border px-2 py-1 text-xs font-mono" />
                        <span className="text-secondary flex items-center">:</span>
                        <input aria-label={`Container path ${index + 1}`} value={variable.container} onChange={(event) => updateVolumeField(index, 'container', event.target.value)} placeholder="/container/path" className="min-w-0 flex-1 rounded bg-black/40 border border-border px-2 py-1 text-xs font-mono" />
                        <button type="button" aria-label={`Remover volume ${index + 1}`} onClick={() => setVolumeVariables((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="p-1 text-secondary hover:text-rose-400"><X className="w-4 h-4" /></button>
                      </div>)}
                      <button type="button" onClick={() => setVolumeVariables((current) => [...current, { host: '', container: '' }])} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary"><Plus className="w-3 h-3" /> + Adicionar</button>
                      {volumeError && <p role="alert" className="text-xs text-rose-400">{volumeError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleUpdateVolumes} disabled={volumeSaving} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{volumeSaving ? 'Salvando...' : 'Salvar alterações'}</button>
                        <button type="button" onClick={() => { setEditingVolumes(false); setVolumeError(null); }} disabled={volumeSaving} className="rounded bg-accent px-3 py-1.5 text-xs text-secondary">Cancelar</button>
                      </div>
                    </div> : <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
                      {inspectData?.HostConfig?.Binds && inspectData.HostConfig.Binds.length > 0 ? inspectData.HostConfig.Binds.map((b: string, i: number) => {
                        const parts = b.split(':');
                        return (
                          <div key={i} className="text-xs font-mono bg-black/50 p-1 rounded border border-border truncate" title={b}>
                            <span className="text-secondary">{parts[0]}</span>:{parts[1]}
                          </div>
                        )
                      }) : <span className="text-secondary text-sm">Nenhum volume mapeado</span>}
                    </div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="flex-1 glass-panel rounded-xl p-0 border border-border flex flex-col overflow-hidden min-h-[500px]">
          <div className="bg-black/50 p-3 border-b border-border flex justify-between items-center">
            <span className="text-sm font-semibold text-secondary">Logs (Últimas 500 linhas)</span>
            <div className="flex gap-2">
              <button onClick={handleCopyLogs} className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary px-3 py-1.5 rounded transition-colors">
                {copiedLogs ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedLogs ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={fetchLogs} className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary px-3 py-1.5 rounded transition-colors">
                <RotateCw className="w-3 h-3" /> Atualizar Logs
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-4 text-sm font-mono whitespace-pre-wrap">
            {logs ? logs : <span className="text-secondary">Nenhum log encontrado...</span>}
          </div>
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="flex-1 glass-panel rounded-xl p-0 border border-border flex flex-col overflow-hidden min-h-[500px]">
          <div className="bg-black/50 p-3 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-primary">Shell TTY do Container (sh)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (xtermRef.current) {
                    const sel = xtermRef.current.getSelection();
                    if (sel) {
                      navigator.clipboard.writeText(sel).then(() => toast.success('Copiado!')).catch(() => {});
                    } else {
                      toast('Selecione um texto para copiar');
                    }
                  }
                }}
                className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2.5 py-1 rounded transition-colors"
                title="Copiar Seleção"
              >
                <Copy className="w-3 h-3" />
                <span>Copiar</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.readText().then(text => {
                    if (text && wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(text);
                      toast.success('Conteúdo colado!');
                    }
                  }).catch(() => toast.error('Permissão necessária para colar'));
                }}
                className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2.5 py-1 rounded transition-colors"
                title="Colar da Área de Transferência"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Colar</span>
              </button>
              <button
                onClick={() => {
                  if (xtermRef.current) {
                    xtermRef.current.clear();
                  }
                }}
                className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2 py-1 rounded transition-colors"
                title="Limpar Terminal"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-[#090d13] p-2">
            <div ref={terminalRef} className="h-full w-full" />
          </div>
        </div>
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

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Excluir Container"
        message={`Tem certeza que deseja excluir permanentemente o container ${container.name}?`}
        onConfirm={executeDelete}
        isDestructive={true}
        confirmText="Sim, excluir"
      >
        <div className="bg-black/20 p-4 rounded-lg border border-border/50">
          <p className="text-sm text-primary font-medium mb-3">Opções de exclusão em cascata:</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer pb-2 mb-2 border-b border-border/50">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
                checked={deleteOptions.volumes && deleteOptions.image && deleteOptions.network}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDeleteOptions({ volumes: checked, image: checked, network: checked });
                }}
              />
              <span className="text-sm font-semibold text-primary">Selecionar tudo</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
                checked={deleteOptions.volumes}
                onChange={(e) => setDeleteOptions(prev => ({ ...prev, volumes: e.target.checked }))}
              />
              <span className="text-sm text-secondary">Excluir volumes anônimos associados</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
                checked={deleteOptions.image}
                onChange={(e) => setDeleteOptions(prev => ({ ...prev, image: e.target.checked }))}
              />
              <span className="text-sm text-secondary">Excluir imagem do container</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border bg-black/40 text-rose-500 focus:ring-rose-500/20"
                checked={deleteOptions.network}
                onChange={(e) => setDeleteOptions(prev => ({ ...prev, network: e.target.checked }))}
              />
              <span className="text-sm text-secondary">Excluir redes exclusivas do container</span>
            </label>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
