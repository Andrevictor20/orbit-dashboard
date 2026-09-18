import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, AlignLeft, Terminal as TerminalIcon } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { resolveWebUrl } from '../utils/url';
import {
  ContainerOverviewTab,
  type ContainerData,
  type StatPoint,
} from '../components/docker/container-detail/ContainerOverviewTab';
import { ContainerLogsTab } from '../components/docker/container-detail/ContainerLogsTab';
import { ContainerTerminalTab } from '../components/docker/container-detail/ContainerTerminalTab';
import { ContainerDeleteModal } from '../components/docker/container-detail/ContainerDeleteModal';
import { ContainerDetailHeader } from '../components/docker/container-detail/ContainerDetailHeader';
import { useContainerDetailMutations } from '../components/docker/container-detail/useContainerDetailMutations';
import { pollContainerUpdate } from '../utils/batchUpdateRunner';

export function ContainerDetail() {
  const { t } = useTranslation();
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({ volumes: false, image: false, network: false });

  const mutations = useContainerDetailMutations(container, inspectData, fetchInspect, fetchContainer);

  useEffect(() => {
    if (id) {
      const token = localStorage.getItem('saturn_token');
      fetch(`/api/docker/containers/${id}/check-update`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.has_update) setHasUpdate(true); })
        .catch(() => {});
    }
  }, [id]);

  async function fetchContainer() {
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch('/api/docker/containers', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list: ContainerData[] = await res.json();
        const found = list.find(c => c.id.startsWith(id || ''));
        if (found) setContainer(found);
      }
    } catch (e) { console.error(e); }
  }

  async function fetchInspect() {
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch(`/api/docker/containers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInspectData(data);
        mutations.syncInspectToState(data);
      }
    } catch (e) { console.error(e); }
  }

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch(`/api/docker/containers/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLogs(await res.text());
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('saturn_token');
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
            return newData.length > 30 ? newData.slice(newData.length - 30) : newData;
          });
        }
      }
    } catch (e) { console.error(e); }
  };

  const pollUpdateStatus = async (token: string | null) => {
    if (!id) return;
    const cleanName = (container?.name || id).replace(/^\//, '');
    const result = await pollContainerUpdate({ containerId: id, cleanName, token, signal: new AbortController().signal, t });
    if (result.success) {
      setHasUpdate(false);
      toast.success(t('containers.update_success', 'Container atualizado e reiniciado com sucesso!'));
      await fetchContainer();
      await fetchInspect();
    } else if (!result.wasCancelled) {
      toast.error(t('containers.update_error', { defaultValue: `Falha ao atualizar container: ${result.error || 'Erro desconhecido'}`, error: result.error || 'Erro desconhecido' }));
    }
  };

  useEffect(() => {
    if (!id) return;
    if (sessionStorage.getItem(`saturn_deleting_${id}`)) {
      sessionStorage.removeItem(`saturn_deleting_${id}`);
      toast(t('containers.delete_background_notice', 'A exclusão do container continua em andamento em segundo plano.'), { icon: '🗑️' });
      navigate('/containers');
      return;
    }
    fetchContainer();
    fetchStats();
    fetchInspect();

    const token = localStorage.getItem('saturn_token');
    fetch(`/api/docker/containers/${id}/update-status`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(task => {
        if (task && (task.status === 'pulling' || task.status === 'recreating')) {
          setUpdating(true);
          toast(t('containers.resuming_update', 'Recuperando processo de atualização em andamento...'), { icon: '⏳' });
          pollUpdateStatus(token).finally(() => {
            setUpdating(false);
            sessionStorage.removeItem(`saturn_updating_${id}`);
          });
        }
      })
      .catch(() => {});

    const interval = setInterval(() => { fetchContainer(); fetchStats(); }, 5000);
    return () => clearInterval(interval);
  }, [id, navigate]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const handleUpdate = async () => {
    if (!id) return;
    setUpdating(true);
    sessionStorage.setItem(`saturn_updating_${id}`, 'true');
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch(`/api/docker/containers/${id}/update`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const rawText = await res.text().catch(() => '');
      let data: any = null;
      try { data = JSON.parse(rawText); } catch { data = null; }
      if (!res.ok || data?.status === 'error') {
        let err = data?.message || rawText;
        if (rawText.includes('<!DOCTYPE html') || rawText.includes('<html')) err = t('containers.proxy_timeout_error', 'Tempo limite ou erro retornado pelo proxy intermediário/rede.');
        toast.error(t('containers.update_error', { defaultValue: `Falha ao atualizar container: ${err}`, error: err }));
        return;
      }
      if (data?.status === 'success') {
        setHasUpdate(false);
        toast.success(t('containers.update_success', 'Container atualizado e reiniciado com sucesso!'));
        await fetchContainer();
        await fetchInspect();
        return;
      }
      toast(t('containers.pull_started_bg', 'Download da imagem iniciado em segundo plano...'), { icon: '⏳' });
      await pollUpdateStatus(token);
    } catch (e) {
      console.error('Update error:', e);
      toast.error(t('containers.update_conn_error', 'Erro de conexão ao atualizar container.'));
    } finally {
      setUpdating(false);
      sessionStorage.removeItem(`saturn_updating_${id}`);
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
    if (!container) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('saturn_token');
      await fetch(`/api/docker/containers/${container.id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      await fetchContainer();
    } catch (err) { console.error(`Failed to ${action} container`, err); }
    finally { setActionLoading(false); }
  };

  const executeDelete = async () => {
    if (!container) return;
    setActionLoading(true);
    sessionStorage.setItem(`saturn_deleting_${id}`, 'true');
    const loadingToast = toast.loading(t('containers.stopping_and_deleting', 'Parando e excluindo container com segurança...'));
    try {
      const token = localStorage.getItem('saturn_token');
      const query = new URLSearchParams();
      if (deleteOptions.volumes) query.append('v', 'true');
      if (deleteOptions.image) query.append('image', 'true');
      if (deleteOptions.network) query.append('network', 'true');
      const res = await fetch(`/api/docker/containers/${id}?${query.toString()}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      sessionStorage.removeItem(`saturn_deleting_${id}`);
      toast.success(t('containers.delete_success', 'Container excluído com sucesso!'), { id: loadingToast });
      navigate('/containers');
    } catch (err) {
      sessionStorage.removeItem(`saturn_deleting_${id}`);
      console.error('Failed to delete container', err);
      toast.error(t('containers.delete_error', 'Erro ao excluir o container.'), { id: loadingToast });
      setActionLoading(false);
    }
  };

  const renderPorts = () => {
    const links = [];
    const ports = inspectData?.NetworkSettings?.Ports;
    if (ports && Object.keys(ports).length > 0) {
      for (const [containerPort, hostBindings] of Object.entries(ports)) {
        if (hostBindings) {
          for (const binding of (hostBindings as any[])) {
            const hostPort = binding.HostPort;
            links.push(<a key={`${containerPort}-${hostPort}`} href={resolveWebUrl(hostPort)} target="_blank" rel="noreferrer" className="inline-block bg-accent hover:bg-saturn-700 text-secondary px-2 py-1 rounded text-xs font-mono transition-colors mr-2 mb-2">{hostPort} → {containerPort}</a>);
          }
        }
      }
    } else if (inspectData?.HostConfig?.NetworkMode === 'host' || inspectData?.NetworkSettings?.Networks?.host) {
      const exposed = inspectData?.Config?.ExposedPorts;
      if (exposed) {
        for (const portKey of Object.keys(exposed)) {
          const hostPort = portKey.split('/')[0];
          links.push(<a key={`host-${hostPort}`} href={resolveWebUrl(hostPort)} target="_blank" rel="noreferrer" className="inline-block bg-accent hover:bg-saturn-700 text-secondary px-2 py-1 rounded text-xs font-mono transition-colors mr-2 mb-2">{hostPort} (Host Network)</a>);
        }
      }
    }
    return links.length > 0 ? <div className="flex flex-wrap">{links}</div> : <span className="text-secondary text-sm">{t('containers.no_ports_mapped', 'Nenhuma porta mapeada para o host')}</span>;
  };

  if (!container) {
    return <div className="flex items-center justify-center h-full text-secondary">{t('containers.loading_details', 'Carregando detalhes do container...')}</div>;
  }

  const latestStat = history[history.length - 1];
  const cpuPercent = latestStat ? latestStat.cpu.toFixed(1) : '0.0';
  const memUsed = latestStat ? latestStat.memory.toFixed(1) : '0.0';
  const memLimit = latestStat ? latestStat.memory_limit.toFixed(1) : '0.0';

  const getFirstMappedPort = () => {
    if (!inspectData?.NetworkSettings?.Ports) return null;
    for (const hostBindings of Object.values(inspectData.NetworkSettings.Ports)) {
      if (hostBindings && (hostBindings as any[]).length > 0) return (hostBindings as any[])[0].HostPort;
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
      <ContainerDetailHeader
        container={container}
        appPort={getFirstMappedPort()}
        hasUpdate={hasUpdate}
        updating={updating}
        actionLoading={actionLoading}
        onBack={() => navigate('/containers')}
        onAction={handleAction}
        onUpdate={handleUpdate}
        onDeleteClick={() => setShowDeleteModal(true)}
      />

      <div className="flex space-x-1 bg-card/50 border border-border rounded-lg p-1 overflow-x-auto scrollbar-none">
        {(['overview', 'logs', 'terminal'] as const).map((tab) => {
          const icons = { overview: Info, logs: AlignLeft, terminal: TerminalIcon };
          const labels = {
            overview: t('containers.tab_overview', 'Visão Geral'),
            logs: t('containers.tab_logs', 'Logs'),
            terminal: t('containers.tab_terminal', 'Terminal')
          };
          const Icon = icons[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-accent text-primary shadow' : 'text-secondary hover:text-primary'}`}
            >
              <Icon className="w-4 h-4 shrink-0" /> {labels[tab]}
            </button>
          );
        })}
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
          editingEnv={mutations.editingEnv}
          envVariables={mutations.envVariables}
          envSaving={mutations.envSaving}
          envError={mutations.envError}
          beginEnvEdit={mutations.beginEnvEdit}
          updateEnvField={mutations.updateEnvField}
          setEnvVariables={mutations.setEnvVariables}
          handleUpdateEnv={mutations.handleUpdateEnv}
          setEditingEnv={mutations.setEditingEnv}
          setEnvError={mutations.setEnvError}
          editingVolumes={mutations.editingVolumes}
          volumeVariables={mutations.volumeVariables}
          volumeSaving={mutations.volumeSaving}
          volumeError={mutations.volumeError}
          beginVolumeEdit={mutations.beginVolumeEdit}
          updateVolumeField={mutations.updateVolumeField}
          setVolumeVariables={mutations.setVolumeVariables}
          handleUpdateVolumes={mutations.handleUpdateVolumes}
          setEditingVolumes={mutations.setEditingVolumes}
          setVolumeError={mutations.setVolumeError}
          isHiddenEnv={mutations.isHiddenEnv}
        />
      )}
      {activeTab === 'logs' && <ContainerLogsTab logs={logs} onRefresh={fetchLogs} />}
      {activeTab === 'terminal' && <ContainerTerminalTab id={id!} />}

      <ConfirmModal
        isOpen={mutations.confirmAction.isOpen}
        onClose={() => mutations.setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        title={mutations.confirmAction.title}
        message={mutations.confirmAction.message}
        onConfirm={mutations.confirmAction.onConfirm}
        isDestructive={false}
        confirmText={t('common.confirm_continue', 'Sim, continuar')}
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
