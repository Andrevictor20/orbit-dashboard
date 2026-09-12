import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpLeft,
  Search,
  RefreshCw,
  Folder,
  Compass,
  Clock,
  ShieldAlert,
  Terminal,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type { DiskItemStat } from '../../stores/diskAnalyzerStore';
import { formatBytes } from '../../utils/format';
import { getPathSafetyInfo } from '../../utils/pathSafety';
import { getItemIcon } from './diskUtils';

interface BreadcrumbSegment {
  label: string;
  path: string;
}

interface DiskDirectoryTreeProps {
  currentPath: string;
  breadcrumbSegments: BreadcrumbSegment[];
  handleGoUp: () => void;
  handleNavigate: (path: string) => void;
  searchFilter: string;
  setSearchFilter: (v: string) => void;
  sortBy: 'size' | 'percentage' | 'name';
  setSortBy: (v: 'size' | 'percentage' | 'name') => void;
  sortAsc: boolean;
  setSortAsc: (v: boolean) => void;
  fetchAnalysis: (path: string) => void;
  loading: boolean;
  totalSize: number;
  itemCount: number;
  store: {
    totalBytes: number;
    scannedBytes: number;
  };
  elapsedSeconds: number;
  error: string | null;
  filteredItems: DiskItemStat[];
  handleDeleteItem: (item: DiskItemStat) => void;
}

export const DiskDirectoryTree: React.FC<DiskDirectoryTreeProps> = ({
  currentPath,
  breadcrumbSegments,
  handleGoUp,
  handleNavigate,
  searchFilter,
  setSearchFilter,
  sortBy,
  setSortBy,
  sortAsc,
  setSortAsc,
  fetchAnalysis,
  loading,
  totalSize,
  itemCount,
  store,
  elapsedSeconds,
  error,
  filteredItems,
  handleDeleteItem,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-card/85 backdrop-blur-2xl border border-border/80 rounded-2xl overflow-hidden shadow-xl min-h-[450px]">
      {/* Breadcrumb Navigation & Controls Toolbar */}
      <div className="p-3 sm:p-4 border-b border-border/70 bg-card/40 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Breadcrumbs & Up Button */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={handleGoUp}
            disabled={currentPath === '/' || !currentPath}
            className="p-1.5 rounded-xl border border-border/80 bg-card text-secondary hover:text-primary hover:bg-accent disabled:opacity-30 transition-colors shadow-sm"
            title="Subir um diretório (..)"
          >
            <ArrowUpLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono scrollbar-none py-1 truncate">
            {breadcrumbSegments.map((crumb, idx, arr) => (
              <div
                key={crumb.path}
                className="flex items-center gap-1 shrink-0"
              >
                <button
                  onClick={() => handleNavigate(crumb.path)}
                  className={`hover:text-orbit-400 transition-colors px-1 py-0.5 rounded ${
                    idx === arr.length - 1
                      ? 'font-bold text-primary bg-accent'
                      : 'text-secondary'
                  }`}
                >
                  {crumb.label}
                </button>
                {idx < arr.length - 1 && (
                  <span className="text-secondary/50">&gt;</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Search Filter & Sort Tools */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Instant Filter input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrar nesta pasta..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-background border border-border text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:border-orbit-500 w-40 sm:w-52 shadow-sm"
            />
          </div>

          {/* Sort Toggle buttons */}
          <div className="flex items-center bg-accent/60 border border-border/80 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => {
                if (sortBy === 'size') setSortAsc(!sortAsc);
                else {
                  setSortBy('size');
                  setSortAsc(false);
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors font-mono ${
                sortBy === 'size'
                  ? 'bg-orbit-500 text-white font-semibold shadow-sm'
                  : 'text-secondary hover:text-primary hover:bg-accent/80'
              }`}
            >
              Tamanho {sortBy === 'size' ? (sortAsc ? '↑' : '↓') : ''}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'name') setSortAsc(!sortAsc);
                else {
                  setSortBy('name');
                  setSortAsc(true);
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors font-mono ${
                sortBy === 'name'
                  ? 'bg-orbit-500 text-white font-semibold shadow-sm'
                  : 'text-secondary hover:text-primary hover:bg-accent/80'
              }`}
            >
              Nome {sortBy === 'name' ? (sortAsc ? '↑' : '↓') : ''}
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchAnalysis(currentPath)}
            className="p-2 rounded-xl border border-border/80 bg-card text-secondary hover:text-primary hover:bg-accent transition-colors shadow-sm"
            title="Recarregar"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Open in File Manager shortcut */}
          <button
            onClick={() =>
              navigate(`/files?path=${encodeURIComponent(currentPath)}`)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-semibold transition-all shadow-sm"
            title="Abrir pasta no Gerenciador de Arquivos"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Gerenciador</span>
          </button>
        </div>
      </div>

      {/* Tree Summary Bar */}
      <div className="px-4 py-2.5 bg-muted/60 border-b border-border/70 flex items-center justify-between text-xs font-mono text-secondary">
        <div>
          <span>
            Tamanho Total:{' '}
            <strong className="text-primary">{formatBytes(totalSize)}</strong>
          </span>
          <span className="mx-2 text-border">•</span>
          <span>
            Itens: <strong className="text-primary">{itemCount}</strong>
          </span>
        </div>
        <div className="hidden sm:block text-[11px] text-secondary/70">
          Dica: clique em uma pasta para navegar hierarquicamente
        </div>
      </div>

      {/* Content List Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-orbit-500/20 border-t-orbit-500 animate-spin" />
              <Compass className="w-6 h-6 text-orbit-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center space-y-1 w-full max-w-sm">
              <p className="text-sm font-semibold text-primary">
                Calculando uso em{' '}
                <span className="font-mono text-orbit-400">{currentPath}</span>
              </p>
              {store.totalBytes > 0 && (
                <div className="w-full h-1.5 bg-neutral-900 rounded-full mt-3 mb-2 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-orbit-500 transition-all duration-300 shadow-[0_0_15px_var(--color-orbit-500)]"
                    style={{
                      width: `${Math.min(
                        100,
                        (store.scannedBytes / store.totalBytes) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-primary font-mono font-bold">
                {formatBytes(store.scannedBytes)}{' '}
                {store.totalBytes > 0 ? `/ ${formatBytes(store.totalBytes)}` : ''}
              </p>
              <p className="text-xs text-secondary flex items-center justify-center gap-1.5 pt-2">
                <Clock className="w-3 h-3 text-orbit-400" />
                Tempo decorrido:{' '}
                <span className="font-mono font-bold text-primary">
                  {elapsedSeconds}s
                </span>
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-rose-500 dark:text-rose-400">
              {error}
            </p>
            <button
              onClick={() => handleNavigate('/')}
              className="px-4 py-2 rounded-xl bg-card border border-border text-xs text-primary hover:bg-accent shadow-sm"
            >
              Voltar para Raiz (/)
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-secondary space-y-3">
            <Folder className="w-12 h-12 stroke-[1.2] text-secondary/50" />
            <p className="text-sm">Nenhum item encontrado nesta pasta</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGoUp}
                className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-primary hover:bg-accent shadow-sm"
              >
                Subir de Pasta
              </button>
              <button
                onClick={() => handleNavigate('/')}
                className="px-3 py-1.5 rounded-xl bg-orbit-500 text-white text-xs font-semibold shadow-md shadow-orbit-500/20"
              >
                Ir para Raiz (/)
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40 font-mono text-xs">
            {filteredItems.map((item) => {
              const safety = getPathSafetyInfo(item.path);
              const filledBlocks = Math.round(item.percentage / 10);
              const emptyBlocks = Math.max(0, 10 - filledBlocks);
              const barGraphic =
                '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

              return (
                <div
                  key={item.path}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 hover:bg-accent/50 transition-colors gap-2"
                >
                  {/* Left: Icon, Name & Safety Badge */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.is_dir ? (
                      <button
                        onClick={() => handleNavigate(item.path)}
                        className="p-1 rounded-lg hover:bg-accent text-amber-500 dark:text-amber-400 transition-colors"
                        title="Explorar pasta"
                      >
                        <Folder className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="p-1">
                        {getItemIcon(item.name, item.is_dir)}
                      </div>
                    )}

                    <span
                      onClick={() => item.is_dir && handleNavigate(item.path)}
                      className={`font-semibold truncate ${
                        item.is_dir
                          ? 'text-primary hover:text-orbit-500 cursor-pointer underline-offset-2 hover:underline'
                          : 'text-primary'
                      }`}
                      title={item.name}
                    >
                      {item.name}
                      {item.is_dir && '/'}
                    </span>

                    {/* Safety Status Pill */}
                    <span
                      className={`text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full border shrink-0 hidden md:inline-block ${
                        safety.level === 'critical'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : safety.level === 'safe'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-accent text-slate-700 dark:text-secondary border-border font-semibold'
                      }`}
                      title={safety.description}
                    >
                      {safety.tag}
                    </span>
                  </div>

                  {/* Middle: NCDU Visual Percentage Bar */}
                  <div className="flex items-center gap-3 shrink-0 sm:w-64">
                    <span className="text-secondary/60 font-mono tracking-tighter text-xs hidden sm:inline">
                      [{barGraphic}]
                    </span>
                    <div className="w-20 sm:w-24 text-right">
                      <span className="font-bold text-primary">
                        {formatBytes(item.size)}
                      </span>
                    </div>
                    <div className="w-12 text-right">
                      <span className="text-secondary text-[11px] font-semibold">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Right: Quick Action Controls */}
                  <div className="flex items-center gap-1 justify-end shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.is_dir ? (
                      <button
                        onClick={() => handleNavigate(item.path)}
                        className="px-2 py-1 rounded bg-accent/80 hover:bg-accent text-orbit-600 dark:text-orbit-400 text-[11px] font-semibold flex items-center gap-1 transition-colors border border-border/70"
                        title="Navegar para este diretório"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : null}

                    <button
                      onClick={() =>
                        navigate(
                          `/terminal?cwd=${encodeURIComponent(item.path)}`
                        )
                      }
                      className="p-1.5 rounded hover:bg-accent text-secondary hover:text-emerald-500 transition-colors"
                      title="Abrir no Terminal"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>

                    {safety.level !== 'critical' && (
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 rounded hover:bg-rose-500/15 text-secondary hover:text-rose-500 transition-colors"
                        title="Mover para a lixeira"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
