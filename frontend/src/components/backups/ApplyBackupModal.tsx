import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  RotateCcw, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  FileArchive,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { BackupItem, BackupVisuals } from './types';

interface ApplyBackupModalProps {
  backups: BackupItem[];
  getItemVisuals: (b: BackupItem) => BackupVisuals;
  formatBytes: (bytes: number) => string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApplyBackupModal: React.FC<ApplyBackupModalProps> = ({
  backups,
  getItemVisuals,
  formatBytes,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'existing' | 'upload'>('existing');
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(backups[0] || null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyExisting = async () => {
    if (!selectedBackup) return;
    setIsApplying(true);
    setStatusMessage(t('backups.restoring_configs_and_apps', 'Restaurando configurações, dados e inicializando contêineres...'));

    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedBackup.id,
          filename: selectedBackup.filename,
          app_name: selectedBackup.app_name,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || t('backups.restore_failed', 'Falha na restauração'));
      }

      toast.success(t('backups.restore_complete_reloading', 'Backup aplicado com sucesso! Recarregando sistema...'), { duration: 4000 });
      onSuccess();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || t('backups.restore_failed', 'Falha ao aplicar backup'));
      setIsApplying(false);
      setStatusMessage('');
    }
  };

  const handleUploadAndApply = async () => {
    if (!uploadFile) return;
    setIsApplying(true);
    setStatusMessage(t('backups.uploading_snapshot', 'Enviando arquivo de backup para o servidor...'));

    try {
      const formData = new FormData();
      formData.append('backup', uploadFile);

      const uploadRes = await fetch('/api/backups/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(err || 'Falha no envio do arquivo');
      }

      setStatusMessage(t('backups.restoring_configs_and_apps', 'Extraindo configurações e inicializando contêineres Docker...'));

      const restoreRes = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
        }),
      });

      if (!restoreRes.ok) {
        const err = await restoreRes.text();
        throw new Error(err || t('backups.restore_failed', 'Falha ao aplicar snapshot enviado'));
      }

      toast.success(t('backups.restore_complete_reloading', 'Backup importado e aplicado com sucesso! Recarregando...'), { duration: 4000 });
      onSuccess();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || t('backups.restore_failed', 'Falha no processo'));
      setIsApplying(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">
                {t('backups.apply_modal_title', 'Restaurar / Aplicar Backup')}
              </h3>
              <p className="text-xs text-secondary">
                {t('backups.apply_modal_subtitle', 'Restaure temas, integrações, rotas e recrie os contêineres Docker')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying}
            aria-label={t('common.close', 'Fechar')}
            className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-4 flex gap-2 border-b border-border/60 bg-accent/20">
          <button
            onClick={() => setActiveTab('existing')}
            disabled={isApplying}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'existing'
                ? 'border-orbit-500 text-orbit-500 bg-card'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>{t('backups.select_snapshot_tab', 'Snapshots Salvos no Servidor')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-accent text-secondary font-mono">
              {backups.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            disabled={isApplying}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-orbit-500 text-orbit-500 bg-card'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{t('backups.upload_file_tab', 'Do Meu Computador (.tar.gz)')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">{t('common.attention', 'Atenção:')} </span>
              {t('backups.apply_warning', 'Ao aplicar o backup, temas, papéis de parede, links, integrações e volumes serão restaurados, e todos os contêineres Docker presentes no snapshot serão baixados e iniciados automaticamente.')}
            </div>
          </div>

          {activeTab === 'existing' ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-secondary">
                {t('backups.choose_backup_to_apply', 'Selecione o snapshot que deseja restaurar:')}
              </label>

              {backups.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-xl text-secondary text-xs">
                  {t('backups.no_backups_available', 'Nenhum backup disponível no servidor. Use a aba "Do Meu Computador" para enviar um arquivo.')}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {backups.map((b) => {
                    const { icon: VisualIcon, badge, badgeColor, avatarColor } = getItemVisuals(b);
                    const isSelected = selectedBackup?.id === b.id || selectedBackup?.filename === b.filename;
                    return (
                      <div
                        key={b.filename}
                        onClick={() => !isApplying && setSelectedBackup(b)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-orbit-500 bg-orbit-500/5 ring-1 ring-orbit-500/40 shadow-sm'
                            : 'border-border bg-accent/20 hover:bg-accent/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border shrink-0 ${avatarColor}`}>
                            <VisualIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary text-xs">{b.app_name}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${badgeColor}`}>
                                {badge}
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-secondary mt-0.5">{b.filename}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-semibold text-primary block">
                            {formatBytes(b.size_bytes)}
                          </span>
                          <span className="text-[10px] text-secondary">{b.created_at}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                accept=".tar.gz,.tgz"
                className="hidden"
              />

              <div
                onClick={() => !isApplying && fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                  uploadFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-border hover:border-orbit-500 hover:bg-accent/30'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-orbit-500/10 text-orbit-500 border border-orbit-500/20">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {uploadFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {uploadFile.name}
                    </p>
                    <p className="text-[11px] text-secondary font-mono">
                      {formatBytes(uploadFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-primary">
                      {t('backups.click_to_select_file', 'Clique para selecionar o arquivo .tar.gz')}
                    </p>
                    <p className="text-[11px] text-secondary">
                      {t('backups.drag_or_browse', 'Ou arraste o arquivo gerado pelo Orbit diretamente aqui')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Message during execution */}
          {isApplying && (
            <div className="p-3.5 rounded-xl bg-orbit-500/10 border border-orbit-500/20 flex items-center gap-3 animate-pulse">
              <RotateCcw className="w-4 h-4 text-orbit-500 animate-spin shrink-0" />
              <p className="text-xs font-medium text-orbit-600 dark:text-orbit-400">{statusMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-accent/20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary hover:bg-accent border border-border transition-colors"
          >
            {t('common.cancel', 'Cancelar')}
          </button>

          {activeTab === 'existing' ? (
            <button
              onClick={handleApplyExisting}
              disabled={!selectedBackup || isApplying}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-rose-600/20 flex items-center gap-2 active:scale-95"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
              <span>{isApplying ? t('backups.applying', 'Aplicando...') : t('backups.apply_now', 'Aplicar Snapshot Agora')}</span>
            </button>
          ) : (
            <button
              onClick={handleUploadAndApply}
              disabled={!uploadFile || isApplying}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-rose-600/20 flex items-center gap-2 active:scale-95"
            >
              <ArrowRight className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
              <span>{isApplying ? t('backups.uploading_and_applying', 'Enviando & Aplicando...') : t('backups.upload_and_apply', 'Enviar Arquivo e Restaurar Agora')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
