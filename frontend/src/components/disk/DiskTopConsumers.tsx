import React from 'react';
import { Flame, CornerDownRight } from 'lucide-react';
import type { DiskItemStat } from '../../stores/diskAnalyzerStore';
import { formatBytes } from '../../utils/format';
import { getItemIcon } from './diskUtils';

interface DiskTopConsumersProps {
  topConsumers: DiskItemStat[];
  currentPath: string;
  totalSize: number;
  handleNavigate: (path: string) => void;
}

export const DiskTopConsumers: React.FC<DiskTopConsumersProps> = ({
  topConsumers,
  currentPath,
  totalSize,
  handleNavigate,
}) => {
  if (topConsumers.length === 0) return null;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-primary">
            Top Maiores Consumidores de Espaço em{' '}
            <span className="font-mono text-orbit-400">{currentPath}</span>
          </h3>
        </div>
        <span className="text-xs text-secondary font-mono">
          {formatBytes(totalSize)} analisados
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {topConsumers.map((item, idx) => {
          const medal =
            idx === 0
              ? '🥇 #1'
              : idx === 1
              ? '🥈 #2'
              : idx === 2
              ? '🥉 #3'
              : `#${idx + 1}`;
          return (
            <div
              key={item.path}
              onClick={() => item.is_dir && handleNavigate(item.path)}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                item.is_dir
                  ? 'bg-card border-border/80 hover:border-orbit-500/50 hover:bg-accent/60 cursor-pointer group shadow-sm hover:shadow-md'
                  : 'bg-card/70 border-border/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-orbit-500/10 text-orbit-600 dark:text-orbit-300 border border-orbit-500/20">
                  {medal}
                </span>
                <span className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2 min-w-0">
                {getItemIcon(item.name, item.is_dir)}
                <span
                  className="text-xs font-bold text-primary truncate group-hover:text-orbit-400 transition-colors"
                  title={item.name}
                >
                  {item.name}
                </span>
              </div>

              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-secondary">
                <span className="font-semibold text-primary">
                  {formatBytes(item.size)}
                </span>
                {item.is_dir && (
                  <span className="text-orbit-500 dark:text-orbit-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Explorar <CornerDownRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
