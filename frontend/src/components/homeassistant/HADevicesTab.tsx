import { useTranslation } from 'react-i18next';
import {
  Layers,
  Lightbulb,
  Zap,
  Tv,
  Thermometer,
  Camera,
  Smartphone,
  Globe,
  Database,
  Sliders,
  Activity,
} from 'lucide-react';
import type { HADeviceGroup, DeviceSubFilter } from './types';
import { DeviceGroupCard } from './DeviceGroupCard';

interface HADevicesTabProps {
  filteredDeviceGroups: HADeviceGroup[];
  allDeviceGroupsCount: number;
  totalEntitiesCount: number;
  selectedAreaFilter: string;
  deviceSubFilter: DeviceSubFilter;
  onFilterSubCategory: (filter: DeviceSubFilter) => void;
  onSelectDevice: (device: HADeviceGroup) => void;
  onToggleEntityId: (entityId: string, currentState: string) => Promise<void>;
  isPending: (entityId: string) => boolean;
}

const SUB_CATEGORIES = [
  { id: 'all', labelKey: 'homeassistant.tab_all', defaultLabel: 'Todos', icon: Layers },
  { id: 'lights', labelKey: 'homeassistant.tab_lights', defaultLabel: 'Iluminação', icon: Lightbulb },
  { id: 'switches', labelKey: 'homeassistant.tab_switches', defaultLabel: 'Tomadas & Interruptores', icon: Zap },
  { id: 'media', labelKey: 'homeassistant.media_players', defaultLabel: 'Mídia & TVs', icon: Tv },
  { id: 'climate', labelKey: 'homeassistant.tab_climate', defaultLabel: 'Climatização', icon: Thermometer },
  { id: 'cameras', labelKey: 'homeassistant.cameras', defaultLabel: 'Câmeras', icon: Camera },
  { id: 'mobile', labelKey: 'homeassistant.mobile_devices', defaultLabel: 'Móveis', icon: Smartphone },
  { id: 'network', labelKey: 'homeassistant.tab_network', defaultLabel: 'Rede', icon: Globe },
  { id: 'system', labelKey: 'homeassistant.tab_system_backups', defaultLabel: 'Sistema', icon: Database },
  { id: 'automation', labelKey: 'homeassistant.tab_automations', defaultLabel: 'Automações', icon: Sliders },
  { id: 'sensors', labelKey: 'homeassistant.tab_sensors', defaultLabel: 'Sensores', icon: Activity },
] as const;

export function HADevicesTab({
  filteredDeviceGroups,
  totalEntitiesCount,
  selectedAreaFilter,
  deviceSubFilter,
  onFilterSubCategory,
  onSelectDevice,
  onToggleEntityId,
  isPending,
}: HADevicesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Subcategorias por Tipo de Hardware */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SUB_CATEGORIES.map((sub) => {
            const SubIcon = sub.icon;
            const isActive = deviceSubFilter === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onFilterSubCategory(sub.id as DeviceSubFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 active:scale-95 border ${
                  isActive
                    ? 'bg-orbit-500 text-white shadow-sm font-semibold border-orbit-500'
                    : 'bg-card/50 hover:bg-card text-secondary hover:text-primary border-border/70'
                }`}
              >
                <SubIcon className="w-3.5 h-3.5" />
                <span>{t(sub.labelKey, sub.defaultLabel)}</span>
              </button>
            );
          })}
        </div>

        {/* Contador Sutil Desktop */}
        <div className="text-xs text-secondary shrink-0 hidden lg:flex items-center gap-2">
          <span>
            {t('homeassistant.showing_devices', {
              count: filteredDeviceGroups.length,
              defaultValue: `Exibindo ${filteredDeviceGroups.length} dispositivos consolidados`,
            })}
          </span>
          <span className="font-mono text-[11px] bg-card/60 border border-border/60 px-2 py-0.5 rounded-md">
            {totalEntitiesCount} {t('homeassistant.entities_integrated', { defaultValue: 'entidades agrupadas' })}
          </span>
        </div>
      </div>

      {/* Contador mobile/tablet */}
      <div className="flex lg:hidden items-center justify-between text-xs text-secondary px-1">
        <span>
          {t('homeassistant.showing_devices', {
            count: filteredDeviceGroups.length,
            defaultValue: `Exibindo ${filteredDeviceGroups.length} dispositivos`,
          })}
          {selectedAreaFilter !== 'all' && (
            <span className="ml-1 text-orbit-500 font-medium">({selectedAreaFilter})</span>
          )}
        </span>
        <span className="font-mono text-[11px] bg-card/60 border border-border/60 px-2 py-0.5 rounded-md">
          {totalEntitiesCount} {t('homeassistant.entities_integrated', { defaultValue: 'entidades agrupadas' })}
        </span>
      </div>

      {/* Grid de Cards de Dispositivos Consolidados */}
      {filteredDeviceGroups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border/70 bg-card/30">
          <p className="text-sm text-secondary">
            {t('homeassistant.no_devices_found', { defaultValue: 'Nenhum dispositivo encontrado para este filtro.' })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDeviceGroups.map((device) => (
            <DeviceGroupCard
              key={device.id}
              device={device}
              onClick={() => onSelectDevice(device)}
              onQuickToggle={onToggleEntityId}
              isPending={device.primaryEntity ? isPending(device.primaryEntity.entity_id) : false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
