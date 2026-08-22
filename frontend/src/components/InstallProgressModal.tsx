import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, Loader2, Minimize2 } from 'lucide-react';
import { useInstall } from '../contexts/InstallContext';
import { useNavigate } from 'react-router-dom';

const STATUS_LABELS: Record<string, string> = {
  starting: 'Iniciando...',
  preparing: 'Preparando arquivos...',
  pulling: 'Baixando imagem Docker...',
  installing: 'Iniciando containers...',
  done: 'Instalação concluída!',
  error: 'Falha na instalação',
};

const STATUS_COLORS: Record<string, string> = {
  starting: 'text-secondary',
  preparing: 'text-orbit-400',
  pulling: 'text-orbit-400',
  installing: 'text-orbit-400',
  done: 'text-emerald-400',
  error: 'text-rose-400',
};

export function InstallProgressModal() {
  const { taskId, appName, isModalOpen, task, minimize, clear } = useInstall();
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && task?.status !== 'error') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [task?.logs]);

  if (!isModalOpen || !taskId) return null;

  const handleCopyLogs = async () => {
    if (!task?.logs) return;
    await navigator.clipboard.writeText(task.logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSuccess = () => {
    clear();
    navigate('/containers');
  };

  const progressBarColor = task?.status === 'error'
    ? 'bg-rose-500'
    : task?.status === 'done'
    ? 'bg-emerald-500'
    : 'bg-orbit-500';

  const isDone = task?.status === 'done';
  const isError = task?.status === 'error';
  const isInProgress = !isDone && !isError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
            {isError && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
            {isInProgress && <Loader2 className="w-5 h-5 text-orbit-400 animate-spin flex-shrink-0" />}
            <div>
              <h3 className="font-semibold text-primary">Instalando {appName}</h3>
              <p className={`text-sm mt-0.5 ${task ? STATUS_COLORS[task.status] : 'text-secondary'}`}>
                {task ? STATUS_LABELS[task.status] : 'Aguardando...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isInProgress && (
              <button onClick={minimize} title="Continuar em segundo plano" className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors">
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            {(isDone || isError) && (
              <button onClick={clear} className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary uppercase tracking-wider font-medium">Progresso</span>
            <span className={`text-sm font-bold tabular-nums ${task ? STATUS_COLORS[task.status] : 'text-secondary'}`}>
              {task?.progress ?? 0}%
            </span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${progressBarColor} ${isInProgress ? 'relative' : ''}`}
              style={{ width: `${task?.progress ?? 0}%` }}
            >
              {isInProgress && (
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary uppercase tracking-wider font-medium">
              {isError ? 'Logs de Erro' : 'Output'}
            </span>
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary px-2 py-1 hover:bg-accent rounded transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado!' : 'Copiar Logs'}
            </button>
          </div>
          <div
            className={`h-48 overflow-y-auto rounded-lg p-3 font-mono text-xs space-y-0.5 bg-black/60 border ${
              isError ? 'border-rose-500/30' : 'border-border/50'
            }`}
          >
            {task?.logs && task.logs.length > 0 ? (
              task.logs.map((line, i) => {
                const isErrLine = line.startsWith('[ERROR]');
                const isInfoLine = line.startsWith('[INFO]');
                const isPullLine = line.startsWith('[PULL]');
                return (
                  <div
                    key={i}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      isErrLine ? 'text-rose-400' :
                      isInfoLine ? 'text-orbit-400' :
                      isPullLine ? 'text-sky-400' :
                      'text-gray-400'
                    }`}
                  >
                    {line}
                  </div>
                );
              })
            ) : (
              <div className="text-gray-600 italic">Aguardando output...</div>
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Error Summary */}
          {isError && task?.error && (
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <p className="text-sm text-rose-400 font-medium">Motivo do erro:</p>
              <p className="text-sm text-rose-300 mt-1 font-mono">{task.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-3 items-center">
          {isInProgress && (
            <button
              onClick={minimize}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors mr-auto"
            >
              Continuar em segundo plano
            </button>
          )}
          
          {isError && (
            <button
              onClick={clear}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors"
            >
              Fechar
            </button>
          )}
          {isDone && (
            <>
              <button
                onClick={clear}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSuccess}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver Containers
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
