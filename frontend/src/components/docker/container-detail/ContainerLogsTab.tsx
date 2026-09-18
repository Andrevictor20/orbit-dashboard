import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, CheckCircle2, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ContainerLogsTabProps {
  logs: string;
  onRefresh: () => void;
}

export function ContainerLogsTab({ logs, onRefresh }: ContainerLogsTabProps) {
  const { t } = useTranslation();
  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs).then(() => {
      setCopiedLogs(true);
      toast.success(t('docker.logs_copied', 'Logs copiados!'));
      setTimeout(() => setCopiedLogs(false), 2000);
    }).catch(() => toast.error(t('docker.logs_copy_failed', 'Falha ao copiar logs')));
  };

  return (
    <div className="flex-1 glass-panel rounded-xl p-0 border border-border flex flex-col overflow-hidden min-h-[500px]">
      <div className="bg-black/50 p-3 border-b border-border flex justify-between items-center">
        <span className="text-sm font-semibold text-secondary">{t('docker.last_500_lines', 'Logs (Últimas 500 linhas)')}</span>
        <div className="flex gap-2">
          <button onClick={handleCopyLogs} className="text-xs flex items-center gap-1 bg-accent hover:bg-saturn-700 text-secondary px-3 py-1.5 rounded transition-colors">
            {copiedLogs ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedLogs ? t('common.copied', 'Copiado!') : t('common.copy', 'Copiar')}
          </button>
          <button onClick={onRefresh} className="text-xs flex items-center gap-1 bg-accent hover:bg-saturn-700 text-secondary px-3 py-1.5 rounded transition-colors">
            <RotateCw className="w-3 h-3" /> {t('docker.refresh_logs', 'Atualizar Logs')}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-4 text-sm font-mono whitespace-pre-wrap">
        {logs ? logs : <span className="text-secondary">{t('docker.no_logs_found', 'Nenhum log encontrado...')}</span>}
      </div>
    </div>
  );
}
