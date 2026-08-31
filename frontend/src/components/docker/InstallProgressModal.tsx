import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, Loader2, Minimize2 } from 'lucide-react';
import { useInstall } from '../../contexts/InstallContext';
import { useNavigate } from 'react-router-dom';

const STATUS_LABELS: Record<string, string> = {
  starting: 'Iniciando...',
  preparing: 'Preparando arquivos...',
  pulling: 'Baixando imagem Docker...',
  installing: 'Iniciando containers...',
  running: 'Processando...',
  done: 'Instalação concluída!',
  error: 'Falha na instalação',
};

const getStatusLabel = (status: string, type?: string) => {
  if (status === 'done') {
    return type && type !== 'app_install' ? 'Operação concluída!' : 'Instalação concluída!';
  }
  return STATUS_LABELS[status] || status;
};

const STATUS_COLORS: Record<string, string> = {
  starting: 'text-secondary',
  preparing: 'text-orbit-400',
  pulling: 'text-orbit-400',
  installing: 'text-orbit-400',
  running: 'text-orbit-400',
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
    const dest = task?.destinationUrl || '/containers';
    clear();
    navigate(dest);
  };

  const progressBarColor = task?.status === 'error'
    ? 'bg-rose-500'
    : task?.status === 'done'
    ? 'bg-emerald-500'
    : 'bg-orbit-500';

  const isDone = task?.status === 'done';
  const isError = task?.status === 'error';
  const isInProgress = !isDone && !isError;

  const modalTitle = task?.title || (appName ? (appName.startsWith('Instalando') || appName.startsWith('Instalação') ? appName : `Instalando ${appName}`) : 'Tarefa em Segundo Plano');

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fade-in" onClick={minimize}>
      <div 
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden animate-slide-up my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card/70 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
            {isError && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
            {isInProgress && <Loader2 className="w-5 h-5 text-orbit-400 animate-spin flex-shrink-0" />}
            <div className="min-w-0">
              <h3 className="font-semibold text-primary text-sm sm:text-base truncate">{modalTitle}</h3>
              <p className={`text-xs sm:text-sm mt-0.5 ${task ? STATUS_COLORS[task.status] || 'text-secondary' : 'text-secondary'}`}>
                {task ? getStatusLabel(task.status, task.type) : 'Aguardando...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isInProgress && (
              <button 
                onClick={minimize} 
                title="Continuar em segundo plano" 
                className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors"
                aria-label="Minimizar para segundo plano"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            {(isDone || isError) && (
              <button 
                onClick={() => clear()} 
                className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 sm:px-5 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary uppercase tracking-wider font-medium">Progresso</span>
            <span className={`text-sm font-bold tabular-nums ${task ? STATUS_COLORS[task.status] || 'text-secondary' : 'text-secondary'}`}>
              {task?.progress ?? 0}%
            </span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor} ${isInProgress ? 'relative' : ''}`}
              style={{ width: `${task?.progress ?? 0}%` }}
            >
              {isInProgress && (
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-xs text-secondary uppercase tracking-wider font-medium">
              {isError ? 'Logs de Erro' : 'Output / Logs de Execução'}
            </span>
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary px-2.5 py-1 hover:bg-accent rounded-lg border border-border/50 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado!' : 'Copiar Logs'}</span>
            </button>
          </div>
          <div
            className={`flex-1 min-h-[160px] max-h-[280px] overflow-y-auto rounded-xl p-3.5 font-mono text-xs space-y-1 bg-black/60 border ${
              isError ? 'border-rose-500/30' : 'border-border/50'
            }`}
          >
            {task?.logs && task.logs.length > 0 ? (
              task.logs.map((line: string, i: number) => {
                const isErrLine = line.startsWith('[ERROR]');
                const isSuccessLine = line.startsWith('[SUCCESS]');
                const isInfoLine = line.startsWith('[INFO]');
                const isPullLine = line.startsWith('[PULL]');
                const isPruneLine = line.startsWith('[PRUNE]');
                const isFileLine = line.startsWith('[FILE]');
                return (
                  <div
                    key={i}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      isErrLine ? 'text-rose-400' :
                      isSuccessLine ? 'text-emerald-400 font-semibold' :
                      isInfoLine ? 'text-orbit-400' :
                      isPullLine ? 'text-sky-400' :
                      isPruneLine ? 'text-amber-400' :
                      isFileLine ? 'text-indigo-400' :
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
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl shrink-0">
              <p className="text-xs text-rose-400 font-medium">Motivo do erro:</p>
              <p className="text-xs text-rose-300 mt-1 font-mono break-all">{task.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-wrap justify-end gap-2 sm:gap-3 items-center border-t border-border/50 pt-3 shrink-0">
          {isInProgress && (
            <button
              onClick={minimize}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors mr-auto"
            >
              Continuar em segundo plano
            </button>
          )}
          
          {isError && (
            <button
              onClick={() => clear()}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors"
            >
              Fechar
            </button>
          )}
          {isDone && (
            <>
              <button
                onClick={() => clear()}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-accent text-secondary hover:text-primary transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSuccess}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20 active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>
                  {task?.destinationUrl === '/volumes' ? 'Ver Volumes' :
                   task?.destinationUrl === '/images' ? 'Ver Imagens' :
                   task?.destinationUrl === '/networks' ? 'Ver Redes' :
                   task?.destinationUrl === '/files' ? 'Ver Arquivos' :
                   'Ver Containers'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
