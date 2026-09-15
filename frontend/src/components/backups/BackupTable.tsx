import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Download, Trash2 } from 'lucide-react';
import type { BackupItem, BackupVisuals } from './types';

interface BackupTableProps {
  backups: BackupItem[];
  getItemVisuals: (b: BackupItem) => BackupVisuals;
  formatBytes: (bytes: number) => string;
  onRestore: (b: BackupItem) => void;
  onDelete: (filename: string) => void;
}

export const BackupTable: React.FC<BackupTableProps> = ({
  backups,
  getItemVisuals,
  formatBytes,
  onRestore,
  onDelete,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-accent/40 border-b border-border text-secondary font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-5 py-3.5">{t('backups.application_col', 'Alvo / Escopo')}</th>
              <th className="px-5 py-3.5">{t('backups.snapshot_file_col', 'Arquivo Snapshot')}</th>
              <th className="px-5 py-3.5">{t('backups.size_col', 'Tamanho')}</th>
              <th className="px-5 py-3.5">{t('backups.created_at_col', 'Data de Criação')}</th>
              <th className="px-5 py-3.5 text-right">{t('backups.actions_col', 'Ações')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-primary">
            {backups.map((b) => {
              const { icon: VisualIcon, badge, badgeColor, avatarColor } = getItemVisuals(b);
              const isApp = !b.target_type || b.target_type === 'single_app';
              return (
                <tr key={b.filename} className="hover:bg-accent/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border shrink-0 ${avatarColor}`}>
                        <VisualIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary font-mono text-sm">{b.app_name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {badge}
                          </span>
                        </div>
                        <div className="text-[11px] text-secondary flex items-center gap-1 mt-0.5">
                          {isApp ? (
                            b.app_dir_exists ? (
                              <span className="text-emerald-500 font-medium">
                                {t('backups.active_data_folder', 'Pasta /data ativa')}
                              </span>
                            ) : (
                              <span className="text-amber-500 font-medium">
                                {t('backups.app_uninstalled', 'App desinstalado')}
                              </span>
                            )
                          ) : (
                            <span>{b.description || t('backups.saved_snapshots', 'Snapshot')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-secondary text-[11px]">{b.filename}</td>
                  <td className="px-5 py-4 font-mono font-medium">{formatBytes(b.size_bytes)}</td>
                  <td className="px-5 py-4 text-secondary">{b.created_at}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onRestore(b)}
                        className="px-2.5 py-1.5 text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-500/10 rounded-xl transition-all border border-rose-500/25 flex items-center gap-1.5 font-medium text-xs shadow-sm hover:shadow-rose-500/20 active:scale-95"
                        title={t('backups.restore_tooltip', 'Restaurar este snapshot (1-Clique)')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('backups.apply_button', 'Aplicar')}</span>
                      </button>
                      <a
                        href={`/api/backups/download/${encodeURIComponent(b.filename)}`}
                        download
                        className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors border border-border"
                        title={t('backups.download_tooltip', 'Baixar arquivo .tar.gz')}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => onDelete(b.filename)}
                        className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors border border-border"
                        title={t('backups.delete_tooltip', 'Excluir snapshot')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
