import { useTranslation } from 'react-i18next';
import { Plus, X, FolderOpen } from 'lucide-react';

export interface VolumeMappingItem {
  host: string;
  container: string;
}

interface CustomInstallVolumesTabProps {
  volumes: VolumeMappingItem[];
  setVolumes: (vols: VolumeMappingItem[]) => void;
  appId: string;
  onOpenFolderPicker: (index: number) => void;
}

export function CustomInstallVolumesTab({
  volumes,
  setVolumes,
  appId,
  onOpenFolderPicker
}: CustomInstallVolumesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {t('custom_install.volumes_heading', 'Mapeamento de Pastas')}
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            {t('custom_install.volumes_sub', 'Defina os caminhos no host onde os dados persistentes serão gravados.')}
          </p>
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
                <div className="flex items-center gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => onOpenFolderPicker(idx)}
                    className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-secondary hover:text-primary transition-all shrink-0 active:scale-95"
                    title={t('folder_picker.browse', 'Selecionar pasta no servidor')}
                    aria-label={t('folder_picker.browse', 'Selecionar pasta no servidor')}
                  >
                    <FolderOpen className="w-4 h-4 text-orbit-500" />
                  </button>
                </div>
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
  );
}
