import { useMemo } from 'react';
import type { AppStoreItem } from '../../queries/useStoreAppsQuery';

export interface DockerContainerLite {
  id: string;
  name: string;
  image: string;
  state: string;
  labels?: Record<string, string>;
}

export function useAppInstalled(installedContainers: DockerContainerLite[]) {
  return useMemo(() => {
    const installedIdentifiers = new Set<string>();
    installedContainers.forEach(c => {
      const cleanName = (c.name || '').replace(/^\//, '').toLowerCase().trim();
      if (cleanName) {
        installedIdentifiers.add(cleanName);
        installedIdentifiers.add(cleanName.replace(/[^a-z0-9]/g, ''));
      }
      if (c.labels) {
        if (c.labels['com.docker.compose.project']) {
          const proj = c.labels['com.docker.compose.project'].toLowerCase().trim();
          installedIdentifiers.add(proj);
          installedIdentifiers.add(proj.replace(/[^a-z0-9]/g, ''));
        }
        if (c.labels['com.docker.compose.service']) {
          const srv = c.labels['com.docker.compose.service'].toLowerCase().trim();
          installedIdentifiers.add(srv);
          installedIdentifiers.add(srv.replace(/[^a-z0-9]/g, ''));
        }
      }
      const rawImage = (c.image || '').split(':')[0].split('/').pop()?.toLowerCase().trim();
      if (rawImage) {
        installedIdentifiers.add(rawImage);
        installedIdentifiers.add(rawImage.replace(/[^a-z0-9]/g, ''));
      }
    });

    return (app: AppStoreItem) => {
      if (!app) return false;
      const id = (app.id || '').toLowerCase().trim();
      const idSimple = id.replace(/[^a-z0-9]/g, '');
      const name = (app.name || '').toLowerCase().trim();
      const nameSimple = name.replace(/[^a-z0-9]/g, '');

      return (
        installedIdentifiers.has(id) || 
        installedIdentifiers.has(idSimple) ||
        installedIdentifiers.has(name) ||
        installedIdentifiers.has(nameSimple)
      );
    };
  }, [installedContainers]);
}
