import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';

import {
  DeviceCardSystem,
  RawEntitiesTable,
  DeviceDetailModal,
  HAConnectView,
  HAHeader,
  HAToolbar,
  HADevicesTab,
  HAQuickScenes,
} from '../components/homeassistant';

import { useHomeAssistant } from '../components/homeassistant/useHomeAssistant';

export function HomeAssistant() {
  const { t } = useTranslation();

  const {
    loadingConfig, config,
    urlInput, setUrlInput, tokenInput, setTokenInput, showToken, setShowToken,
    isConnecting, connectError, entities, loadingEntities, entitiesError,
    activeTab, setActiveTab, deviceSubFilter, selectedAreaFilter, setSelectedAreaFilter,
    setSelectedDevice, deviceSearchQuery, setDeviceSearchQuery,
    fetchConfig, fetchEntities, handleConnect, handleDisconnect,
    handleToggle, handleToggleEntityId, handleGenericServiceCall,
    allDeviceGroups, activeSelectedDevice, dynamicAreas, filteredDeviceGroups,
    grouped, stats, formattedDate, handleSubFilterChange, isPending, startTransition,
    isPendingAction,
  } = useHomeAssistant();

  useEffect(() => {
    fetchConfig();
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchEntities(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleRunSpeedtest = () => {
    handleGenericServiceCall('homeassistant', 'update_entity', {
      entity_id: grouped.systemMetrics.speedtestDownload?.entity_id || 'sensor.speedtest_download',
    });
  };

  if (loadingConfig) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-saturn-500" />
          <span className="text-xs text-secondary font-medium tracking-wide">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!config || !config.configured) {
    return (
      <HAConnectView
        urlInput={urlInput} setUrlInput={setUrlInput}
        tokenInput={tokenInput} setTokenInput={setTokenInput}
        showToken={showToken} setShowToken={setShowToken}
        isConnecting={isConnecting} connectError={connectError}
        onConnect={handleConnect}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <HAHeader
        config={config} stats={stats} loadingEntities={loadingEntities}
        onFilterSubCategory={handleSubFilterChange}
        onSync={() => fetchEntities(true)}
        onDisconnect={handleDisconnect}
      />

      <HAQuickScenes
        formattedDate={formattedDate}
        activeDevicesCount={stats.lightsOn + stats.switchesOn}
        quickBooleans={grouped.quickBooleans}
        isPending={isPending}
        onToggle={handleToggle}
      />

      <div className="space-y-3">
        <HAToolbar
          activeTab={activeTab}
          setActiveTab={(tab) => startTransition(() => setActiveTab(tab))}
          devicesCount={allDeviceGroups.length}
          dynamicAreas={dynamicAreas}
          selectedAreaFilter={selectedAreaFilter}
          setSelectedAreaFilter={(area) => startTransition(() => setSelectedAreaFilter(area))}
          deviceSearchQuery={deviceSearchQuery}
          setDeviceSearchQuery={setDeviceSearchQuery}
          allDeviceGroupsCount={allDeviceGroups.length}
        />

        {entitiesError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{entitiesError}</span>
            </div>
            <button onClick={() => fetchEntities(true)} className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-colors">
              {t('homeassistant.retry')}
            </button>
          </div>
        )}

        {loadingEntities && entities.length === 0 ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-saturn-500" />
          </div>
        ) : (
          <>
            {activeTab === 'devices' && (
              <HADevicesTab
                filteredDeviceGroups={filteredDeviceGroups}
                allDeviceGroupsCount={allDeviceGroups.length}
                totalEntitiesCount={entities.length}
                selectedAreaFilter={selectedAreaFilter}
                deviceSubFilter={deviceSubFilter}
                onFilterSubCategory={handleSubFilterChange}
                onSelectDevice={setSelectedDevice}
                onToggleEntityId={handleToggleEntityId}
                isPending={isPending}
              />
            )}
            {activeTab === 'system' && (
              <div className="animate-in fade-in duration-300">
                <DeviceCardSystem metrics={grouped.systemMetrics} isPending={isPending} onRunSpeedtest={handleRunSpeedtest} />
              </div>
            )}
            {activeTab === 'raw' && (
              <div className="animate-in fade-in duration-300">
                <RawEntitiesTable entities={entities} isPending={isPending} onToggle={handleToggle} />
              </div>
            )}
          </>
        )}
      </div>

      <DeviceDetailModal
        device={activeSelectedDevice}
        isOpen={!!activeSelectedDevice}
        onClose={() => setSelectedDevice(null)}
        onToggle={handleToggleEntityId}
        onServiceCall={handleGenericServiceCall}
        isPendingAction={isPendingAction}
      />
    </div>
  );
}

export default HomeAssistant;
