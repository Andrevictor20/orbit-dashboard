import { Package, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppStoreItem } from '../../queries/useStoreAppsQuery';

export const HERO_GRADIENTS = [
  'from-blue-600/35 via-indigo-900/40 to-neutral-950',
  'from-purple-600/35 via-orbit-900/40 to-neutral-950',
  'from-emerald-600/35 via-teal-950/40 to-neutral-950',
  'from-rose-600/35 via-amber-950/40 to-neutral-950'
];

interface AppStoreHeroCarouselProps {
  featuredApps: AppStoreItem[];
  heroIndex: number;
  onSetHeroIndex: (index: number | ((prev: number) => number)) => void;
  isAppInstalled: (app: AppStoreItem) => boolean;
  onExplore: (id: string) => void;
}

export function AppStoreHeroCarousel({
  featuredApps,
  heroIndex,
  onSetHeroIndex,
  isAppInstalled,
  onExplore,
}: AppStoreHeroCarouselProps) {
  if (!featuredApps.length) return null;

  const currentApp = featuredApps[heroIndex];
  if (!currentApp) return null;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-border/80 bg-neutral-950 shadow-xl min-h-[250px] sm:min-h-[270px] flex flex-col justify-end p-6 sm:p-8">
      {/* Ambient Backdrop Glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${HERO_GRADIENTS[heroIndex % HERO_GRADIENTS.length]} transition-all duration-700`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_70%)]" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      {/* Carousel Content */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 max-w-xl">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-black/60 border border-white/15 p-3 flex items-center justify-center shrink-0 shadow-2xl backdrop-blur-md">
            {currentApp.icon ? (
              <img
                src={currentApp.icon}
                alt={currentApp.name}
                className="w-full h-full object-contain drop-shadow-md"
              />
            ) : (
              <Package className="w-8 h-8 text-orbit-400" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-orbit-500/30 text-orbit-300 border border-orbit-400/30">
                Destaque
              </span>
              <span className="text-xs text-white/60 font-medium">
                {currentApp.category}
              </span>
              {isAppInstalled(currentApp) && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 rounded-full flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Instalado</span>
                </span>
              )}
            </div>

            <span className="text-2xl sm:text-3xl font-extrabold text-white block tracking-tight drop-shadow-sm">
              {currentApp.name}
            </span>

            <p className="text-xs sm:text-sm text-white/80 line-clamp-2 leading-relaxed max-w-lg">
              {currentApp.description}
            </p>
          </div>
        </div>

        {/* Hero Actions */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <button
            onClick={() => onExplore(currentApp.id)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span>Explorar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Carousel Indicators & Controls */}
      <div className="relative z-10 flex items-center justify-between mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          {featuredApps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onSetHeroIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === heroIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetHeroIndex((prev: number) => (prev === 0 ? featuredApps.length - 1 : prev - 1))}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Previous featured app"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetHeroIndex((prev: number) => (prev + 1) % featuredApps.length)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Next featured app"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
