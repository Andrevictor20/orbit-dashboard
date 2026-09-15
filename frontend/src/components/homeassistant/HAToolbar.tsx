import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Activity, Sliders, MapPin, ChevronDown, X, Search } from 'lucide-react';
import type { MainTabType } from './types';

interface HAToolbarProps {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  devicesCount: number;
  dynamicAreas: [string, number][];
  selectedAreaFilter: string;
  setSelectedAreaFilter: (area: string) => void;
  deviceSearchQuery: string;
  setDeviceSearchQuery: (query: string) => void;
  allDeviceGroupsCount: number;
}

export function HAToolbar({
  activeTab,
  setActiveTab,
  devicesCount,
  dynamicAreas,
  selectedAreaFilter,
  setSelectedAreaFilter,
  deviceSearchQuery,
  setDeviceSearchQuery,
  allDeviceGroupsCount,
}: HAToolbarProps) {
  const { t } = useTranslation();
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setIsAreaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
      {/* Segmented Switcher de Abas */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card/60 border border-border/70 backdrop-blur-xl w-fit">
        {(
          [
            { id: 'devices', label: t('homeassistant.tab_devices'), icon: Layers, count: devicesCount },
            { id: 'system', label: t('homeassistant.tab_system'), icon: Activity },
            { id: 'raw', label: t('homeassistant.tab_raw_entities'), icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                isActive
                  ? 'bg-orbit-500 text-white shadow-sm shadow-orbit-500/25'
                  : 'text-secondary hover:text-primary hover:bg-card/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {'count' in tab && tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-accent text-secondary'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Controles de Área e Busca (Aba de Dispositivos) */}
      {activeTab === 'devices' && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dropdown de Áreas Dinâmicas */}
          {dynamicAreas.length > 0 && (
            <div className="relative" ref={areaDropdownRef}>
              <button
                onClick={() => setIsAreaDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                  selectedAreaFilter !== 'all'
                    ? 'bg-orbit-500/15 border-orbit-500/40 text-orbit-700 dark:text-orbit-300 font-semibold'
                    : 'bg-card/60 border-border/70 text-secondary hover:text-primary hover:bg-card'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-orbit-500 shrink-0" />
                <span className="truncate max-w-[130px]">
                  {selectedAreaFilter === 'all'
                    ? t('homeassistant.all_areas', 'Todas as Áreas')
                    : selectedAreaFilter}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-accent text-secondary font-mono">
                  {selectedAreaFilter === 'all'
                    ? allDeviceGroupsCount
                    : dynamicAreas.find(([a]) => a.toLowerCase() === selectedAreaFilter.toLowerCase())?.[1] || 0}
                </span>
                <ChevronDown className={`w-3 h-3 text-secondary transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Dropdown de Áreas */}
              {isAreaDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-56 max-h-72 overflow-y-auto rounded-xl bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 scrollbar-thin">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-secondary uppercase tracking-wider">
                    {t('homeassistant.dynamic_areas', 'Áreas Detectadas')} ({dynamicAreas.length})
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAreaFilter('all');
                      setIsAreaDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedAreaFilter === 'all'
                        ? 'bg-orbit-500 text-white font-semibold'
                        : 'text-secondary hover:text-primary hover:bg-accent/60'
                    }`}
                  >
                    <span>{t('homeassistant.all_areas', 'Todas as Áreas')}</span>
                    <span className="text-[10px] opacity-75 font-mono">{allDeviceGroupsCount}</span>
                  </button>
                  <div className="h-px bg-border/60 my-1" />
                  {dynamicAreas.map(([areaName, count]) => (
                    <button
                      key={areaName}
                      onClick={() => {
                        setSelectedAreaFilter(areaName);
                        setIsAreaDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        selectedAreaFilter.toLowerCase() === areaName.toLowerCase()
                          ? 'bg-orbit-500 text-white font-semibold'
                          : 'text-secondary hover:text-primary hover:bg-accent/60'
                      }`}
                    >
                      <span className="truncate">{areaName}</span>
                      <span className="text-[10px] opacity-75 font-mono">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Se houver área selecionada, botão de limpar */}
          {selectedAreaFilter !== 'all' && (
            <button
              onClick={() => setSelectedAreaFilter('all')}
              className="p-1.5 rounded-lg border border-border/60 bg-card/50 text-secondary hover:text-primary transition-colors text-xs"
              title={t('homeassistant.clear_area_filter', 'Limpar filtro de área')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Campo de Busca Compacto */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={deviceSearchQuery}
              onChange={(e) => setDeviceSearchQuery(e.target.value)}
              placeholder={t('homeassistant.search_placeholder', 'Buscar dispositivos...')}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-border/70 bg-card/70 text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all"
            />
            {deviceSearchQuery && (
              <button
                onClick={() => setDeviceSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
