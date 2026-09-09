import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Archive, 
  RotateCcw, 
  Download, 
  Trash2, 
  Plus, 
  Clock, 
  UploadCloud, 
  RefreshCw, 
  Search, 
  HardDrive, 
  Calendar, 
  CheckCircle2,
  FileArchive
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateBackupModal } from '../components/backups/CreateBackupModal';
import { RestoreConfirmModal } from '../components/backups/RestoreConfirmModal';
import { ScheduleModal, type BackupScheduleConfig } from '../components/backups/ScheduleModal';

export interface BackupItem {
  filename: string;
  app_name: string;
  size_bytes: number;
  created_at: string;
  app_dir_exists: boolean;
}

export default function Backups() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<BackupScheduleConfig>({
    enabled: false,
    interval_hours: 24,
    max_backups_per_app: 5,
    apps: [],
    last_run: null,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<BackupItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [backupsRes, scheduleRes, stacksRes, containersRes] = await Promise.allSettled([
        fetch('/api/backups'),
        fetch('/api/backups/schedule'),
        fetch('/api/docker/compose/stacks'),
        fetch('/api/docker/containers'),
      ]);

      if (backupsRes.status === 'fulfilled' && backupsRes.value.ok) {
        setBackups(await backupsRes.value.json());
      }
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
        setSchedule(await scheduleRes.value.json());
      }

      const detected = new Set<string>();
      if (stacksRes.status === 'fulfilled' && stacksRes.value.ok) {
        const stacks = await stacksRes.value.json();
        stacks.forEach((s: any) => s.name && detected.add(s.name));
      }
      if (containersRes.status === 'fulfilled' && containersRes.value.ok) {
        const containers = await containersRes.value.json();
        containers.forEach((c: any) => {
          const name = c.names?.[0]?.replace(/^\//, '') || c.name?.replace(/^\//, '');
          if (name) detected.add(name);
        });
      }
      setApps(Array.from(detected).sort());
    } catch (err: any) {
      toast.error('Erro ao carregar dados de backup: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalStorage = useMemo(() => {
    return backups.reduce((acc, b) => acc + b.size_bytes, 0);
  }, [backups]);

  const filteredBackups = useMemo(() => {
    if (!search.trim()) return backups;
    const q = search.toLowerCase();
    return backups.filter(
      (b) => b.app_name.toLowerCase().includes(q) || b.filename.toLowerCase().includes(q)
    );
  }, [backups, search]);

  const handleCreateBackup = async (appName: string) => {
    const toastId = toast.loading(`Criando backup para ${appName}...`);
    try {
      const res = await fetch('/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: appName }),
      });
      if (!res.ok) {
        const errorMsg = await res.text();
        throw new Error(errorMsg || 'Falha ao criar backup');
      }
      toast.success(`Backup de ${appName} criado com sucesso!`, { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId });
      throw err;
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupToRestore) return;
    const toastId = toast.loading(`Restaurando ${backupToRestore.app_name}...`);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: backupToRestore.filename,
          app_name: backupToRestore.app_name,
        }),
      });
      if (!res.ok) {
        const errorMsg = await res.text();
        throw new Error(errorMsg || 'Falha na restauração');
      }
      toast.success(`App ${backupToRestore.app_name} restaurado com sucesso!`, { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId });
      throw err;
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Deseja realmente excluir permanentemente ${filename}?`)) return;
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir backup');
      toast.success('Backup excluído!');
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleSaveSchedule = async (newConfig: BackupScheduleConfig) => {
    try {
      const res = await fetch('/api/backups/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error('Falha ao salvar agendamento');
      setSchedule(newConfig);
      toast.success('Agendamento de backups atualizado!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      throw err;
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('backup', file);

    setUploading(true);
    const toastId = toast.loading(`Enviando ${file.name}...`);
    try {
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorMsg = await res.text();
        throw new Error(errorMsg || 'Falha no upload do arquivo');
      }
      toast.success('Backup importado com sucesso!', { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">Backups & Restauração</h1>
              <p className="text-secondary text-sm">
                Snapshots 1-clique compactados em .tar.gz com restauração atômica e agendamento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            accept=".tar.gz,.tgz"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3.5 py-2 bg-accent/80 hover:bg-accent text-secondary hover:text-primary rounded-xl text-xs font-semibold border border-border transition-colors flex items-center gap-2"
            title="Importar arquivo .tar.gz existente"
          >
            <UploadCloud className="w-4 h-4 text-orbit-500" />
            <span>{uploading ? 'Enviando...' : 'Importar Snapshot'}</span>
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-2 ${
              schedule.enabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-accent/80 hover:bg-accent text-secondary hover:text-primary border-border'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Rotina: {schedule.enabled ? `A cada ${schedule.interval_hours}h` : 'Desativada'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Backup</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-secondary hover:text-primary rounded-xl hover:bg-accent border border-border transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20">
            <FileArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{backups.length}</div>
            <div className="text-xs text-secondary font-medium">Snapshots Salvos</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{formatBytes(totalStorage)}</div>
            <div className="text-xs text-secondary font-medium">Espaço Ocupado</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span>{schedule.enabled ? 'Ativo' : 'Desativado'}</span>
              <span className={`w-2 h-2 rounded-full ${schedule.enabled ? 'bg-emerald-500' : 'bg-secondary'}`} />
            </div>
            <div className="text-xs text-secondary font-medium">
              {schedule.enabled ? `Retenção: ${schedule.max_backups_per_app}/app` : 'Agendamento desligado'}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-primary truncate max-w-[170px]" title={schedule.last_run || 'Nenhum'}>
              {schedule.last_run || 'Nenhuma execução'}
            </div>
            <div className="text-xs text-secondary font-medium">Última Rotina</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            placeholder="Filtrar por app ou nome do arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent/40 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          />
        </div>
        <div className="text-xs text-secondary font-medium">
          Exibindo {filteredBackups.length} de {backups.length} backups
        </div>
      </div>

      {/* Backups List */}
      {filteredBackups.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-orbit-500/10 text-orbit-500 rounded-2xl mx-auto flex items-center justify-center border border-orbit-500/20">
            <Archive className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-primary">Nenhum backup encontrado</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Crie seu primeiro snapshot 1-clique para proteger as configurações, bancos de dados e volumes dos seus aplicativos.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Snapshot Agora</span>
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-accent/40 border-b border-border text-secondary font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Aplicativo</th>
                  <th className="px-5 py-3.5">Arquivo Snapshot</th>
                  <th className="px-5 py-3.5">Tamanho</th>
                  <th className="px-5 py-3.5">Data de Criação</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-primary">
                {filteredBackups.map((b) => (
                  <tr key={b.filename} className="hover:bg-accent/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20 shrink-0 font-bold">
                          {b.app_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-primary font-mono text-sm">{b.app_name}</div>
                          <div className="text-[11px] text-secondary flex items-center gap-1">
                            {b.app_dir_exists ? (
                              <span className="text-emerald-500 font-medium">Pasta /data ativa</span>
                            ) : (
                              <span className="text-amber-500 font-medium">App desinstalado</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-secondary text-[11px]">
                      {b.filename}
                    </td>
                    <td className="px-5 py-4 font-mono font-medium">
                      {formatBytes(b.size_bytes)}
                    </td>
                    <td className="px-5 py-4 text-secondary">
                      {b.created_at}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setBackupToRestore(b)}
                          className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-500/20"
                          title="Restaurar este snapshot (1-Clique)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`/api/backups/download/${encodeURIComponent(b.filename)}`}
                          download
                          className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors border border-border"
                          title="Baixar arquivo .tar.gz"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors border border-border"
                          title="Excluir snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateBackupModal
          apps={apps}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBackup}
        />
      )}

      {backupToRestore && (
        <RestoreConfirmModal
          backup={backupToRestore}
          onClose={() => setBackupToRestore(null)}
          onConfirm={handleRestoreBackup}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          initialConfig={schedule}
          availableApps={apps}
          onClose={() => setShowScheduleModal(false)}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
}
