import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  RefreshCw, LayoutGrid, List, Layers, Terminal, DownloadCloud 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getIconForImage } from '../../utils/icons';
import { groupContainers, type GroupContainerItem } from '../../utils/containerGroups';
import { AppGroupModal } from './AppGroupModal';
import { DockerInstallModal } from './DockerInstallModal';
import { BatchUpdateModal } from './BatchUpdateModal';
import { useBatchUpdate } from '../../contexts/BatchUpdateContext';
import {
  type Container,
  type PortInfo,
  CustomLinkModal,
  PrimaryContainerModal,
  StackGridCard,
  ContainerGridCard,
  ContainerTableView,
} from './container-list';

export type { Container, PortInfo };

// Global memory cache for instantaneous tab switching (SWR)
let globalContainerCache: Container[] | null = null;

export function resetContainerCache() {
  globalContainerCache = null;
}

export function ContainerList() {
  const { t } = useTranslation();
  const [containers, setContainers] = useState<Container[]>(() => globalContainerCache || []);
  const [loading, setLoading] = useState(() => !globalContainerCache || globalContainerCache.length === 0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [groupByStack, setGroupByStack] = useState<boolean>(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedGroupModal, setSelectedGroupModal] = useState<GroupContainerItem | null>(null);
  const [primarySelectorModal, setPrimarySelectorModal] = useState<{ isOpen: boolean; group: GroupContainerItem | null }>({ isOpen: false, group: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [updatesMap, setUpdatesMap] = useState<Record<string, { has_update: boolean }>>({});
  const { isModalOpen, openModal, closeModal } = useBatchUpdate();
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [linkModal, setLinkModal] = useState<{ isOpen: boolean, containerId: string | null }>({ isOpen: false, containerId: null });
  const [linkInput, setLinkInput] = useState('');
  const [linkMode, setLinkMode] = useState<'builder' | 'raw'>('builder');
  const [linkSubdomain, setLinkSubdomain] = useState('');
  const [linkDomain, setLinkDomain] = useState('');
  const [isDockerInstallOpen, setIsDockerInstallOpen] = useState(false);
  
  // New filtering and sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'cpu' | 'ram' | 'disk'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchContainers = async (showLoading = true) => {
    if (showLoading && (!globalContainerCache || globalContainerCache.length === 0)) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/docker/containers');
      if (res.ok) {
        const data: Container[] = await res.json();
        
        // Update containers immediately with basic fast listing
        setContainers(prev => {
          const updated = data.map(c => {
            const existing = prev.find(p => p.id === c.id);
            return existing 
              ? { ...c, cpu_percent: existing.cpu_percent, memory_used: existing.memory_used, memory_limit: existing.memory_limit }
              : c;
          });
          globalContainerCache = updated;
          return updated;
        });
        setLoading(false);

        // Fetch CPU/RAM stats in the background without stalling the view
        fetch('/api/docker/containers/stats/snapshot')
          .then(r => r.ok ? r.json() : null)
          .then(statsData => {
            if (Array.isArray(statsData)) {
              setContainers(prev => {
                const merged = prev.map(c => {
                  const stat = statsData.find((s: any) => s.id && s.id.startsWith(c.id));
                  if (stat) {
                    return { ...c, cpu_percent: stat.cpu_percent, memory_used: stat.memory_used, memory_limit: stat.memory_limit };
                  }
                  return c;
                });
                globalContainerCache = merged;
                return merged;
              });
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to fetch containers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (e: React.MouseEvent, id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await fetch(`/api/docker/containers/${id}/${action}`, { method: 'POST' });
      await fetchContainers();
    } catch (err) {
      console.error(`Failed to ${action} container`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/docker/links', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomLinks(data);
      }
    } catch (err) {
      console.error('Failed to fetch links', err);
    }
  };

  const handleSetCustomLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const currentLink = customLinks[id] || '';
    setLinkInput(currentLink);

    const savedDomain = localStorage.getItem('orbit_base_domain') || '';
    setLinkDomain(savedDomain);
    setLinkSubdomain('');
    
    if (currentLink && currentLink.startsWith('https://') && savedDomain && currentLink.endsWith(`.${savedDomain}`)) {
      const sub = currentLink.replace('https://', '').replace(`.${savedDomain}`, '');
      if (!sub.includes('/')) {
        setLinkSubdomain(sub);
        setLinkMode('builder');
      } else {
        setLinkMode('raw');
      }
    } else {
      setLinkMode(currentLink ? 'raw' : 'builder');
    }

    setLinkModal({ isOpen: true, containerId: id });
  };

  const handleSaveLink = async () => {
    if (!linkModal.containerId) return;
    const id = linkModal.containerId;
    
    let newLink = '';
    if (linkMode === 'builder') {
      if (linkSubdomain && linkDomain) {
        newLink = `https://${linkSubdomain.trim()}.${linkDomain.trim()}`;
        localStorage.setItem('orbit_base_domain', linkDomain.trim());
      }
    } else {
      newLink = linkInput.trim();
    }
    
    setLinkModal({ isOpen: false, containerId: null });
    
    try {
      const res = await fetch(`/api/docker/links/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newLink })
      });
      if (!res.ok) {
        alert(`Erro ao salvar link: ${res.status} ${res.statusText}`);
      }
      fetchLinks();
    } catch (err) {
      console.error('Failed to set link', err);
      alert(`Erro na rede ao tentar salvar link: ${err}`);
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/docker/containers/check-updates');
      if (res.ok) {
        const data = await res.json();
        setUpdatesMap(data);
      }
    } catch {}
  };

  const pendingUpdatesCount = useMemo(() => {
    return containers.filter(c => updatesMap[c.id]?.has_update).length;
  }, [containers, updatesMap]);

  const handleUpdateAllContainers = () => {
    openModal();
  };

  const handleSelectStackPrimary = (groupKey: string, containerId: string, containerName: string) => {
    localStorage.setItem(`orbit_stack_primary_${groupKey}`, containerId);
    toast.success(t('containers.primary_selected', { name: containerName }));
    setPrimarySelectorModal({ isOpen: false, group: null });
    // Force re-render of groups
    setContainers(prev => [...prev]);
  };

  const handleUpdateContainer = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    openModal(id);
  };

  useEffect(() => {
    const handleContainersUpdated = () => {
      fetchContainers(false);
      fetchUpdates();
    };
    window.addEventListener('orbit:containers-updated', handleContainersUpdated);
    return () => window.removeEventListener('orbit:containers-updated', handleContainersUpdated);
  }, []);

  useEffect(() => {
    fetchContainers();
    fetchLinks();
    fetchUpdates();
    const interval = setInterval(() => {
      if (!actionLoading) {
        fetchContainers(false);
      }
    }, 10000); // refresh every 10s as proposed
    return () => clearInterval(interval);
  }, [actionLoading]);

  // Smart Sorting and Filtering logic
  const query = searchQuery.trim().toLowerCase();
  const filteredAndSortedContainers = [...containers]
    .filter(c => {
      if (!query) return true;

      const name = (c.name || '').toLowerCase();
      const image = (c.image || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      const state = (c.state || '').toLowerCase();

      const portStrings = (c.ports || []).flatMap(p => [
        p.public_port?.toString() || '',
        p.private_port?.toString() || '',
      ]);

      const labelStrings = c.labels ? Object.values(c.labels).map(v => v.toLowerCase()) : [];

      if (
        name.includes(query) ||
        image.includes(query) ||
        id.includes(query) ||
        state.includes(query) ||
        portStrings.some(p => p.includes(query)) ||
        labelStrings.some(l => l.includes(query))
      ) {
        return true;
      }

      // Typo & alias tolerant matching (e.g. "overseer" -> "overseerr", "qbit" -> "qbittorrent")
      if (query === 'overseer' && (name.includes('overseerr') || image.includes('overseerr'))) return true;
      if (query === 'overseerr' && (name.includes('overseer') || image.includes('overseer'))) return true;
      if (query === 'qbit' && (name.includes('qbittorrent') || image.includes('qbittorrent'))) return true;

      return false;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'cpu':
          comparison = (a.cpu_percent || 0) - (b.cpu_percent || 0);
          break;
        case 'ram':
          comparison = (a.memory_used || 0) - (b.memory_used || 0);
          break;
        case 'disk':
          const diskA = (a.size_rw || 0) + (a.size_root_fs || 0);
          const diskB = (b.size_rw || 0) + (b.size_root_fs || 0);
          comparison = diskA - diskB;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const groupedItems = useMemo(() => {
    if (!groupByStack) return null;
    return groupContainers(filteredAndSortedContainers, customLinks, getIconForImage);
  }, [filteredAndSortedContainers, groupByStack, customLinks]);

  const displayItems = useMemo(() => {
    return groupedItems || filteredAndSortedContainers.map(c => ({
      type: 'single' as const,
      id: c.id,
      name: c.name,
      container: c,
      iconUrl: getIconForImage(c.image, c.name),
      webLink: customLinks[c.id],
      isRunning: c.state === 'running',
    }));
  }, [groupedItems, filteredAndSortedContainers, customLinks]);

  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleGroupAction = async (
    e: React.MouseEvent,
    group: GroupContainerItem,
    action: 'start' | 'stop' | 'restart'
  ) => {
    e.stopPropagation();
    setActionLoading(`group:${group.groupKey}:${action}`);
    try {
      await Promise.allSettled(
        group.containers.map(c => fetch(`/api/docker/containers/${c.id}/${action}`, { method: 'POST' }))
      );
      await fetchContainers(false);
    } catch (err) {
      console.error(`Failed to ${action} group ${group.name}`, err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-primary flex items-center gap-2">
            {t('containers.title')}
          </h3>
          <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">{t('containers.subtitle')}</p>
        </div>
        <div className="flex gap-2 items-center self-start sm:self-auto flex-wrap">
          {/* Stack Grouping Toggle */}
          <button
            onClick={() => setGroupByStack(!groupByStack)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              groupByStack 
                ? 'bg-orbit-500/20 text-orbit-300 border-orbit-500/40 shadow-sm' 
                : 'bg-card text-secondary hover:text-primary border-border'
            }`}
            title={t('dashboard.group_managed')}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('dashboard.group_managed')}</span>
          </button>

          <div className="flex bg-card p-1 rounded-md border border-border">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:text-white'}`}
              aria-label="Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:text-white'}`}
              aria-label="Table"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Bulk Update All Containers Button */}
          <button
            onClick={handleUpdateAllContainers}
            className={`px-3 sm:px-4 py-2 rounded-md flex items-center gap-2 transition-all text-xs sm:text-sm font-medium border ${
              pendingUpdatesCount > 0
                ? 'bg-violet-600/25 hover:bg-violet-600/40 text-violet-800 dark:text-violet-300 border-violet-500/50 shadow-sm font-semibold'
                : 'bg-card hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary border-border'
            }`}
            title={t('containers.update_all')}
          >
            <DownloadCloud className={`w-3.5 h-3.5 ${pendingUpdatesCount > 0 ? 'text-violet-600 dark:text-violet-400' : ''}`} />
            <span>{t('containers.update_all')}</span>
            {pendingUpdatesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                {pendingUpdatesCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => fetchContainers(true)}
            className="px-3 sm:px-4 py-2 bg-card hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary rounded-md flex items-center gap-2 transition-colors text-xs sm:text-sm font-medium border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>

          {/* New Docker Install Modal Button */}
          <button
            onClick={() => setIsDockerInstallOpen(true)}
            className="px-3 sm:px-4 py-2 bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm font-semibold shadow-sm shadow-orbit-500/20"
            title={t('docker_install.title')}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('containers.new_container')}</span>
          </button>
        </div>
      </div>
      
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('containers.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all text-primary"
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs sm:text-sm text-slate-600 dark:text-secondary font-medium whitespace-nowrap">{t('common.filter')}:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-orbit-500/50 transition-all text-primary flex-1 sm:flex-none"
          >
            <option value="name">{t('common.name')}</option>
            <option value="cpu">CPU</option>
            <option value="ram">RAM</option>
            <option value="disk">{t('dashboard.storage')}</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-background border border-border rounded-md hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary transition-colors text-sm font-medium"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            aria-label="Sort order"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {loading && containers.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pb-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 bg-background/80 rounded-xl border border-border shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-background/80 rounded w-3/4" />
                  <div className="h-3 bg-background/50 rounded w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
                <div className="h-6 bg-background/50 rounded" />
                <div className="h-6 bg-background/50 rounded" />
                <div className="h-6 bg-background/50 rounded" />
              </div>
              <div className="h-8 bg-background/50 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {filteredAndSortedContainers.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-secondary border border-dashed border-border rounded-lg bg-card/50">
          Nenhum container encontrado.
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pb-4">
          {displayItems.map(item => {
            if (item.type === 'group') {
              return (
                <StackGridCard
                  key={item.id}
                  group={item}
                  actionLoading={actionLoading}
                  onOpenGroupModal={(group) => setSelectedGroupModal(group)}
                  onOpenPrimarySelector={(group) => setPrimarySelectorModal({ isOpen: true, group })}
                  onGroupAction={handleGroupAction}
                />
              );
            }

            return (
              <ContainerGridCard
                key={item.container.id}
                container={item.container}
                customLinks={customLinks}
                updatesMap={updatesMap}
                actionLoading={actionLoading}
                onAction={handleAction}
                onUpdateContainer={handleUpdateContainer}
                onSetCustomLink={handleSetCustomLink}
              />
            );
          })}
        </div>
      )}

      {viewMode === 'table' && containers.length > 0 && (
        <ContainerTableView
          items={displayItems}
          expandedGroups={expandedGroups}
          actionLoading={actionLoading}
          updatesMap={updatesMap}
          customLinks={customLinks}
          onToggleGroupExpanded={toggleGroupExpanded}
          onOpenGroupModal={(group) => setSelectedGroupModal(group)}
          onGroupAction={handleGroupAction}
          onAction={handleAction}
          onUpdateContainer={handleUpdateContainer}
          onSetCustomLink={handleSetCustomLink}
        />
      )}

      {/* App Group / Stack Modal */}
      <AppGroupModal
        group={selectedGroupModal}
        isOpen={Boolean(selectedGroupModal)}
        onClose={() => setSelectedGroupModal(null)}
        onRefresh={() => fetchContainers(false)}
        onEditLink={(id) => handleSetCustomLink({ stopPropagation: () => {} } as any, id)}
        customLinks={customLinks}
      />

      {/* Custom Link Modal */}
      <CustomLinkModal
        isOpen={linkModal.isOpen}
        linkMode={linkMode}
        setLinkMode={setLinkMode}
        linkSubdomain={linkSubdomain}
        setLinkSubdomain={setLinkSubdomain}
        linkDomain={linkDomain}
        setLinkDomain={setLinkDomain}
        linkInput={linkInput}
        setLinkInput={setLinkInput}
        onSave={handleSaveLink}
        onClose={() => setLinkModal({ isOpen: false, containerId: null })}
      />

      {/* Primary Container Selector Modal for Stacks */}
      <PrimaryContainerModal
        isOpen={primarySelectorModal.isOpen}
        group={primarySelectorModal.group}
        customLinks={customLinks}
        onClose={() => setPrimarySelectorModal({ isOpen: false, group: null })}
        onSelectPrimary={handleSelectStackPrimary}
        onEditLink={handleSetCustomLink}
      />

      {/* Docker Run / Compose Auto-Install Modal */}
      <DockerInstallModal
        isOpen={isDockerInstallOpen}
        onClose={() => setIsDockerInstallOpen(false)}
        onSuccess={() => fetchContainers(false)}
      />

      {/* Batch Container Update Modal */}
      <BatchUpdateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        containers={containers}
        updatesMap={updatesMap}
        onUpdateComplete={async () => {
          await fetchContainers(false);
          await fetchUpdates();
        }}
      />
    </div>
  );
}
