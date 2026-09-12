import { useMemo } from 'react';
import type { Container } from './types';
import { groupContainers, type GroupedContainerItem } from '../../../utils/containerGroups';
import { getIconForImage } from '../../../utils/icons';

export function useFilteredContainers(
  containers: Container[],
  searchQuery: string,
  sortBy: 'name' | 'cpu' | 'ram' | 'disk',
  sortOrder: 'asc' | 'desc',
  groupByStack: boolean,
  customLinks: Record<string, string>
) {
  const filteredAndSortedContainers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...containers]
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

        // Typo & alias tolerant matching
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
  }, [containers, searchQuery, sortBy, sortOrder]);

  const groupedItems = useMemo(() => {
    if (!groupByStack) return null;
    return groupContainers(filteredAndSortedContainers, customLinks, getIconForImage);
  }, [filteredAndSortedContainers, groupByStack, customLinks]);

  const displayItems = useMemo((): GroupedContainerItem<Container>[] => {
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

  return {
    filteredAndSortedContainers,
    displayItems,
  };
}
