import React from 'react';
import { HardDrive } from 'lucide-react';
import { formatStorage, getFriendlyDiskName } from '../../utils/format';

export interface MountItem {
  name: string;
  mount_point: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

interface DiskMountDeckProps {
  storages: MountItem[];
  currentPath: string;
  handleNavigate: (path: string) => void;
}

export const DiskMountDeck: React.FC<DiskMountDeckProps> = ({
  storages,
  currentPath,
  handleNavigate,
}) => {
  if (storages.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {storages.map((st, idx) => {
        const usedFormatted = formatStorage(st.used_bytes, 1);
        const totalFormatted = formatStorage(st.total_bytes, 1);
        const availFormatted = formatStorage(
          st.available_bytes || (st.total_bytes - st.used_bytes),
          1
        );
        const pct =
          st.total_bytes > 0
            ? Math.round((st.used_bytes / st.total_bytes) * 100)
            : 0;
        const isSelected =
          currentPath === st.mount_point ||
          currentPath.startsWith(`${st.mount_point}/`);
        const friendlyName = getFriendlyDiskName(st.name, st.mount_point);

        return (
          <button
            key={idx}
            onClick={() => handleNavigate(st.mount_point)}
            className={`text-left p-3.5 rounded-2xl border transition-all ${
              isSelected
                ? 'bg-orbit-500/10 border-orbit-500/50 shadow-md ring-2 ring-orbit-500/20'
                : 'bg-card border-border/70 hover:bg-accent/60 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <HardDrive
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-orbit-400' : 'text-secondary'
                  }`}
                />
                <span className="text-xs font-bold text-primary truncate">
                  {friendlyName}
                </span>
              </div>
              <span className="text-[10px] font-mono text-secondary px-1.5 py-0.5 rounded bg-accent/80 border border-border/60">
                {st.fs_type}
              </span>
            </div>

            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${
                  pct > 85
                    ? 'bg-rose-500'
                    : pct > 70
                    ? 'bg-amber-500'
                    : 'bg-orbit-500'
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-secondary">
              <span>{availFormatted} livre</span>
              <span className="font-semibold text-primary">
                {pct}% ({usedFormatted}/{totalFormatted})
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
