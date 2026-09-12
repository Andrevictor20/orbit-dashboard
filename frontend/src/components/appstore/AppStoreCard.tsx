import { Package, CheckCircle2, ExternalLink, Download, SlidersHorizontal } from 'lucide-react';
import type { AppStoreItem } from '../../queries/useStoreAppsQuery';

interface AppStoreCardProps {
  app: AppStoreItem;
  index: number;
  isInstalled: boolean;
  installing: string | null;
  onExplore: (id: string) => void;
  onManage: () => void;
  onInstall: (id: string, name: string) => void;
  onOpenCustom: (app: AppStoreItem) => void;
}

export function AppStoreCard({
  app,
  index,
  isInstalled,
  installing,
  onExplore,
  onManage,
  onInstall,
  onOpenCustom,
}: AppStoreCardProps) {
  return (
    <div
      key={`${app.store}-${app.id}-${index}`}
      onClick={() => onExplore(app.id)}
      className="group bg-card hover:bg-card border border-border/80 hover:border-orbit-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between h-full cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 relative"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-accent/60 border border-border p-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
            {app.icon ? (
              <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
            ) : (
              <Package className="w-6 h-6 text-secondary" />
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isInstalled && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Instalado</span>
              </span>
            )}
            <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-accent text-primary/80 dark:text-secondary border border-border rounded-full">
              {app.category}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 bg-orbit-500/10 text-orbit-500 border border-orbit-500/20 rounded-full">
              {app.store}
            </span>
          </div>
        </div>

        <h3
          className="font-bold text-base text-primary group-hover:text-orbit-400 transition-colors line-clamp-1"
          title={app.name}
        >
          {app.name}
        </h3>

        <p className="text-secondary text-xs line-clamp-2 mt-1 min-h-[34px] leading-relaxed">
          {app.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40">
        <div className="w-full py-2 bg-accent/70 text-primary/90 hover:text-primary rounded-xl text-xs font-semibold hover:bg-accent transition-all flex items-center justify-center gap-1.5 border border-border/70 shadow-sm">
          <span>Explorar</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </div>

        {isInstalled ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] flex items-center justify-center gap-1.5"
            title="Aplicativo já instalado no sistema. Clique para abrir ou gerenciar no painel."
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Gerenciar</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInstall(app.id, app.name);
              }}
              disabled={installing !== null}
              className="flex-1 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {installing === app.id ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCustom(app);
              }}
              disabled={installing !== null}
              title="Configurar portas, volumes e ambiente antes de instalar"
              className="p-2 bg-accent/80 hover:bg-accent text-secondary hover:text-primary rounded-xl border border-border transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
