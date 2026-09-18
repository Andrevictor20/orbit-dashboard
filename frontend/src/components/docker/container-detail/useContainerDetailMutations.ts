import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EnvVariable, ContainerData } from './ContainerOverviewTab';

const isHiddenEnv = (key: string) => key === 'PATH' || key === 'NODE_PATH';

const toEnvVariables = (env: string[] = []): EnvVariable[] =>
  env.map((entry) => {
    const [key, ...value] = entry.split('=');
    return { key, value: value.join('=') };
  });

interface ConfirmAction {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export function useContainerDetailMutations(
  container: ContainerData | null,
  inspectData: any,
  fetchInspect: () => Promise<void>,
  fetchContainer: () => Promise<void>
) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [editingEnv, setEditingEnv] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [hiddenEnvVariables, setHiddenEnvVariables] = useState<EnvVariable[]>([]);
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  const [editingVolumes, setEditingVolumes] = useState(false);
  const [volumeVariables, setVolumeVariables] = useState<{ host: string; container: string }[]>([]);
  const [volumeSaving, setVolumeSaving] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const beginEnvEdit = () => {
    const allEnvs = toEnvVariables(inspectData?.Config?.Env);
    setEnvVariables(allEnvs.filter(e => !isHiddenEnv(e.key)));
    setHiddenEnvVariables(allEnvs.filter(e => isHiddenEnv(e.key)));
    setEnvError(null);
    setEditingEnv(true);
  };

  const updateEnvField = (index: number, field: keyof EnvVariable, value: string) => {
    setEnvVariables((current) =>
      current.map((variable, currentIndex) =>
        currentIndex === index ? { ...variable, [field]: value } : variable
      )
    );
  };

  const handleUpdateEnv = async () => {
    if (!container) return;
    const invalid = envVariables.some(({ key }) => !key.trim());
    if (invalid) {
      setEnvError(t('docker.env_key_required', 'Cada variável precisa ter uma chave. Remova as linhas vazias antes de salvar.'));
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: t('docker.env_edit_title', 'Editar Variáveis de Ambiente'),
      message: t('docker.env_edit_confirm', 'Salvar recriará o container. Ele ficará indisponível por alguns segundos, terá um novo ID e volumes anônimos podem perder dados. Deseja continuar?'),
      onConfirm: async () => {
        setEnvSaving(true);
        setEnvError(null);
        try {
          const token = localStorage.getItem('saturn_token');
          const fullEnvVariables = [...envVariables, ...hiddenEnvVariables];
          const response = await fetch(`/api/docker/containers/${container.id}/env`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ env: fullEnvVariables.map(({ key, value }) => `${key}=${value}`) }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
          setEnvError(t('docker.env_recreate_failed', 'Não foi possível recriar o container com as novas variáveis. Nenhuma alteração adicional foi aplicada.'));
        } finally {
          setEnvSaving(false);
        }
      },
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
    setVolumeVariables((current) =>
      current.map((variable, currentIndex) =>
        currentIndex === index ? { ...variable, [field]: value } : variable
      )
    );
  };

  const handleUpdateVolumes = async () => {
    if (!container) return;
    const invalid = volumeVariables.some(({ host, container }) => !host.trim() || !container.trim());
    if (invalid) {
      setVolumeError(t('docker.volume_paths_required', 'Cada volume precisa ter um Host Path e um Container Path válidos.'));
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: t('docker.volume_edit_title', 'Editar Volumes (Binds)'),
      message: t('docker.volume_edit_confirm', 'Salvar recriará o container. Ele ficará indisponível por alguns segundos, terá um novo ID e volumes anônimos (não listados) podem perder dados. Deseja continuar?'),
      onConfirm: async () => {
        setVolumeSaving(true);
        setVolumeError(null);
        try {
          const token = localStorage.getItem('saturn_token');
          const response = await fetch(`/api/docker/containers/${container.id}/volumes`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ volumes: volumeVariables.map(({ host, container }) => `${host}:${container}`) }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
          setVolumeError(t('docker.volume_recreate_failed', 'Não foi possível recriar o container com os novos volumes. Nenhuma alteração adicional foi aplicada.'));
        } finally {
          setVolumeSaving(false);
        }
      },
    });
  };

  const syncInspectToState = (data: any) => {
    if (!editingEnv) {
      const allEnvs = toEnvVariables(data?.Config?.Env);
      setEnvVariables(allEnvs.filter(e => !isHiddenEnv(e.key)));
      setHiddenEnvVariables(allEnvs.filter(e => isHiddenEnv(e.key)));
    }
    if (!editingVolumes) {
      const binds: string[] = data?.HostConfig?.Binds || [];
      setVolumeVariables(binds.map((b: string) => {
        const parts = b.split(':');
        return { host: parts[0] || '', container: parts[1] || '' };
      }));
    }
  };

  return {
    editingEnv, setEditingEnv,
    envVariables, setEnvVariables,
    hiddenEnvVariables,
    envSaving,
    envError, setEnvError,
    beginEnvEdit,
    updateEnvField,
    handleUpdateEnv,

    editingVolumes, setEditingVolumes,
    volumeVariables, setVolumeVariables,
    volumeSaving,
    volumeError, setVolumeError,
    beginVolumeEdit,
    updateVolumeField,
    handleUpdateVolumes,

    confirmAction,
    setConfirmAction,
    syncInspectToState,
    isHiddenEnv,
  };
}
