import { useState } from 'react';
import { Copy, CheckCircle2, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ContainerLogsTabProps {
  logs: string;
  onRefresh: () => void;
}

export function ContainerLogsTab({ logs, onRefresh }: ContainerLogsTabProps) {
  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs).then(() => {
      setCopiedLogs(true);
      toast.success('Logs copiados!');
      setTimeout(() => setCopiedLogs(false), 2000);
    }).catch(() => toast.error('Falha ao copiar logs'));
  };

  return (
    <div className="flex-1 glass-panel rounded-xl p-0 border border-border flex flex-col overflow-hidden min-h-[500px]">
      <div className="bg-black/50 p-3 border-b border-border flex justify-between items-center">
        <span className="text-sm font-semibold text-secondary">Logs (Últimas 500 linhas)</span>
        <div className="flex gap-2">
          <button onClick={handleCopyLogs} className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary px-3 py-1.5 rounded transition-colors">
            {copiedLogs ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedLogs ? 'Copiado!' : 'Copiar'}
          </button>
          <button onClick={onRefresh} className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary px-3 py-1.5 rounded transition-colors">
            <RotateCw className="w-3 h-3" /> Atualizar Logs
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-4 text-sm font-mono whitespace-pre-wrap">
        {logs ? logs : <span className="text-secondary">Nenhum log encontrado...</span>}
      </div>
    </div>
  );
}
