import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileArchive, HardDrive, CheckCircle2, Calendar } from 'lucide-react';
import type { BackupScheduleConfig } from './ScheduleModal';

interface BackupKpiCardsProps {
  totalBackups: number;
  totalStorage: number;
  schedule: BackupScheduleConfig;
  formatBytes: (bytes: number) => string;
}

export const BackupKpiCards: React.FC<BackupKpiCardsProps> = ({
  totalBackups,
  totalStorage,
  schedule,
  formatBytes,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-saturn-500/10 text-saturn-500 rounded-xl border border-saturn-500/20">
          <FileArchive className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-primary">{totalBackups}</div>
          <div className="text-xs text-secondary font-medium">
            {t('backups.saved_snapshots', 'Snapshots Salvos')}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-primary">{formatBytes(totalStorage)}</div>
          <div className="text-xs text-secondary font-medium">
            {t('backups.used_space', 'Espaço Ocupado')}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-primary flex items-center gap-1.5">
            <span>{schedule.enabled ? t('backups.active', 'Ativo') : t('backups.disabled', 'Desativado')}</span>
            <span className={`w-2 h-2 rounded-full ${schedule.enabled ? 'bg-emerald-500' : 'bg-secondary'}`} />
          </div>
          <div className="text-xs text-secondary font-medium">
            {schedule.enabled
              ? t('backups.retention', {
                  count: schedule.max_backups_per_app,
                  defaultValue: `Retenção: ${schedule.max_backups_per_app}/app`,
                })
              : t('backups.schedule_disabled', 'Agendamento desligado')}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <div
            className="text-sm font-bold text-primary truncate max-w-[170px]"
            title={schedule.last_run || t('backups.no_runs', 'Nenhum')}
          >
            {schedule.last_run || t('backups.no_execution', 'Nenhuma execução')}
          </div>
          <div className="text-xs text-secondary font-medium">{t('backups.last_run', 'Última Rotina')}</div>
        </div>
      </div>
    </div>
  );
};
