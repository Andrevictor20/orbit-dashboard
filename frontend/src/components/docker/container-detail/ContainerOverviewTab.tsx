import { Activity, HardDrive, Sparkles, DownloadCloud, Pencil, Plus, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../../ui/StatCard';
import { formatBytes } from '../../../utils/format';

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  size_rw?: number;
  size_root_fs?: number;
}

export interface StatPoint {
  time: string;
  cpu: number;
  memory: number;
  memory_limit: number;
}

export interface EnvVariable {
  key: string;
  value: string;
}

interface ContainerOverviewTabProps {
  container: ContainerData;
  inspectData: any;
  history: StatPoint[];
  cpuPercent: string;
  memUsed: string;
  memLimit: string;
  hasUpdate: boolean;
  updating: boolean;
  onUpdate: () => void;
  renderPorts: () => React.ReactNode;
  editingEnv: boolean;
  envVariables: EnvVariable[];
  envSaving: boolean;
  envError: string | null;
  beginEnvEdit: () => void;
  updateEnvField: (index: number, field: keyof EnvVariable, value: string) => void;
  setEnvVariables: React.Dispatch<React.SetStateAction<EnvVariable[]>>;
  handleUpdateEnv: () => void;
  setEditingEnv: React.Dispatch<React.SetStateAction<boolean>>;
  setEnvError: React.Dispatch<React.SetStateAction<string | null>>;
  editingVolumes: boolean;
  volumeVariables: { host: string; container: string }[];
  volumeSaving: boolean;
  volumeError: string | null;
  beginVolumeEdit: () => void;
  updateVolumeField: (index: number, field: 'host' | 'container', value: string) => void;
  setVolumeVariables: React.Dispatch<React.SetStateAction<{ host: string; container: string }[]>>;
  handleUpdateVolumes: () => void;
  setEditingVolumes: React.Dispatch<React.SetStateAction<boolean>>;
  setVolumeError: React.Dispatch<React.SetStateAction<string | null>>;
  isHiddenEnv: (key: string) => boolean;
}

export function ContainerOverviewTab({
  container,
  inspectData,
  history,
  cpuPercent,
  memUsed,
  memLimit,
  hasUpdate,
  updating,
  onUpdate,
  renderPorts,
  editingEnv,
  envVariables,
  envSaving,
  envError,
  beginEnvEdit,
  updateEnvField,
  setEnvVariables,
  handleUpdateEnv,
  setEditingEnv,
  setEnvError,
  editingVolumes,
  volumeVariables,
  volumeSaving,
  volumeError,
  beginVolumeEdit,
  updateVolumeField,
  setVolumeVariables,
  handleUpdateVolumes,
  setEditingVolumes,
  setVolumeError,
  isHiddenEnv,
}: ContainerOverviewTabProps) {
  return (
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
            onClick={onUpdate}
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
  );
}
