import React from 'react';
import { RefreshCw, Download, Terminal, AlertTriangle } from 'lucide-react';

export interface UpdateTaskState {
  status: 'idle' | 'pulling' | 'recreating' | 'done' | 'error';
  progress: number;
  current_step: string;
  logs: string[];
  error?: string | null;
}

interface UpdateProgressViewProps {
  taskState: UpdateTaskState;
  reconnectAttempts: number;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
}

export const UpdateProgressView: React.FC<UpdateProgressViewProps> = ({
  taskState,
  reconnectAttempts,
  terminalEndRef,
}) => {
  return (
    <div className="p-5 space-y-4 overflow-y-auto flex-1">
      <div className="space-y-4 animate-in fade-in duration-150">
        <div className="space-y-2.5 p-4 rounded-2xl bg-card border border-border/80">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-primary flex items-center gap-2">
              {taskState.status === 'recreating' ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <Download className="w-4 h-4 text-orbit-500 animate-bounce" />
              )}
              {taskState.current_step || 'Executando atualização...'}
            </span>
            <span className="text-orbit-600 dark:text-orbit-400 font-mono text-xs tabular-nums font-bold">
              {taskState.progress}%
            </span>
          </div>

          <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
            <div
              className="bg-orbit-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(taskState.progress, 5)}%` }}
            />
          </div>

          {taskState.status === 'recreating' && (
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-secondary pt-1">
              <span>Tentativa de reconexão:</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                {reconnectAttempts}/45
              </span>
            </div>
          )}
        </div>

        {/* Console Log Terminal */}
        <div className="rounded-2xl bg-neutral-950 border border-border/80 overflow-hidden font-mono text-xs shadow-inner">
          <div className="px-3.5 py-2 bg-neutral-900 border-b border-border/60 flex items-center justify-between text-[11px] text-secondary">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-orbit-400" />
              <span className="font-medium text-zinc-300">
                Terminal de Atualização
              </span>
            </div>
            <span className="text-zinc-500 font-mono text-[10px]">
              Docker Engine
            </span>
          </div>
          <div className="p-3.5 max-h-48 overflow-y-auto space-y-1 scrollbar-thin text-[11px]">
            {taskState.logs.map((line, idx) => (
              <div key={idx} className="text-zinc-300">
                {line}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {taskState.error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{taskState.error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
