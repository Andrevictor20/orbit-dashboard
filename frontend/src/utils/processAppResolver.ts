import { getIconForImage } from './icons';
import { formatGroupName } from './containerGroups';
import type { ProcessInfo } from '../components/metrics/ProcessMonitor';
import type { ContainerLike } from './containerGroups';

export interface ResolvedProcessApp {
  displayName: string;
  iconUrl?: string;
  containerImage?: string;
  isHost: boolean;
  subtitle: string;
  containerName?: string;
}

const WELL_KNOWN_APP_NAMES: Record<string, string> = {
  homeassistant: 'Home Assistant',
  'home-assistant': 'Home Assistant',
  home_assistant: 'Home Assistant',
  pihole: 'Pi-hole',
  'pi-hole': 'Pi-hole',
  'uptime-kuma': 'Uptime Kuma',
  uptimekuma: 'Uptime Kuma',
  'stirling-pdf': 'Stirling PDF',
  stirlingpdf: 'Stirling PDF',
  's-pdf': 'Stirling PDF',
  nextcloud: 'Nextcloud',
  tailscale: 'Tailscale',
  tailscaled: 'Tailscale',
  wireguard: 'WireGuard',
  adguard: 'AdGuard Home',
  adguardhome: 'AdGuard Home',
  'adguard-home': 'AdGuard Home',
  vaultwarden: 'Vaultwarden',
  bitwarden: 'Bitwarden',
  portainer: 'Portainer',
  'portainer-ce': 'Portainer',
  jellyfin: 'Jellyfin',
  kavita: 'Kavita',
  plex: 'Plex',
  emby: 'Emby',
  qbittorrent: 'qBittorrent',
  transmission: 'Transmission',
  deluge: 'Deluge',
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  prowlarr: 'Prowlarr',
  bazarr: 'Bazarr',
  lidarr: 'Lidarr',
  readarr: 'Readarr',
  overseerr: 'Overseerr',
  tautulli: 'Tautulli',
  grafana: 'Grafana',
  prometheus: 'Prometheus',
  nginx: 'Nginx',
  caddy: 'Caddy',
  traefik: 'Traefik',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  redis: 'Redis',
  'redis-server': 'Redis',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  moodle: 'Moodle',
  cloudflare: 'Cloudflare',
  cloudflared: 'Cloudflare',
  metube: 'MeTube',
  n8n: 'n8n',
  gitea: 'Gitea',
  gitlab: 'GitLab',
  immich: 'Immich',
  paperless: 'Paperless-ngx',
  'paperless-ngx': 'Paperless-ngx',
  photoprism: 'PhotoPrism',
  syncthing: 'Syncthing',
  duplicati: 'Duplicati',
  'code-server': 'VS Code Server',
  watchtower: 'Watchtower',
  saturn: 'Saturn',
  'saturn-dashboard': 'Saturn',
  
  dockerd: 'Docker Daemon',
};

function matchWellKnownName(str: string): string | null {
  if (!str) return null;
  const lower = str.toLowerCase();
  for (const [key, value] of Object.entries(WELL_KNOWN_APP_NAMES)) {
    if (lower === key || lower.includes(key)) {
      return value;
    }
  }
  return null;
}

export function resolveProcessAppInfo(
  proc: ProcessInfo,
  containers: ContainerLike[] = []
): ResolvedProcessApp {
  const cName = proc.container_name ? proc.container_name.toLowerCase() : '';
  const cId = proc.container_id ? proc.container_id.toLowerCase() : '';

  // 1. Try finding container in active containers list
  let matchedContainer: ContainerLike | undefined;

  if (cId || cName) {
    matchedContainer = containers.find((c) => {
      const id = (c.id || '').toLowerCase();
      if (cId && (id === cId || id.startsWith(cId) || cId.startsWith(id))) {
        return true;
      }
      const rawName = (c.name || '').replace(/^\//, '').toLowerCase();
      if (cName && (rawName === cName || rawName.includes(cName) || cName.includes(rawName))) {
        return true;
      }
      return false;
    });
  }

  // Case A: Container found in list
  if (matchedContainer) {
    const rawName = (matchedContainer.name || '').replace(/^\//, '');
    const img = matchedContainer.image || '';
    const composeProject =
      matchedContainer.labels?.['com.docker.compose.project'] ||
      matchedContainer.labels?.['com.docker.stack.namespace'] ||
      matchedContainer.labels?.['io.saturn.app.name'];

    // If compose project is present, it defines the application group/stack
    let displayName: string;
    if (composeProject) {
      displayName = matchWellKnownName(composeProject) || formatGroupName(composeProject);
    } else {
      displayName =
        matchWellKnownName(rawName) ||
        matchWellKnownName(img) ||
        formatGroupName(rawName);
    }

    const iconUrl = getIconForImage(img, rawName);
    const procNameLower = proc.name.toLowerCase();
    const displayLower = displayName.toLowerCase();

    const subtitle =
      procNameLower !== displayLower && !displayLower.includes(procNameLower)
        ? `${proc.name} • PID ${proc.pid}`
        : `PID ${proc.pid}`;

    return {
      displayName,
      iconUrl,
      containerImage: img,
      isHost: false,
      subtitle,
      containerName: rawName,
    };
  }

  // Case B: Process has container_name but not found in active containers list
  if (cName) {
    const displayName = matchWellKnownName(cName) || formatGroupName(cName);
    const iconUrl = getIconForImage('', cName);
    const procNameLower = proc.name.toLowerCase();
    const displayLower = displayName.toLowerCase();

    const subtitle =
      procNameLower !== displayLower && !displayLower.includes(procNameLower)
        ? `${proc.name} • PID ${proc.pid}`
        : `PID ${proc.pid}`;

    return {
      displayName,
      iconUrl,
      isHost: false,
      subtitle,
      containerName: cName,
    };
  }

  // Case C: Host process (no container)
  const wellKnownHost = matchWellKnownName(proc.name);
  if (wellKnownHost) {
    const iconUrl = getIconForImage('', proc.name);
    return {
      displayName: wellKnownHost,
      iconUrl,
      isHost: false,
      subtitle: `PID ${proc.pid}`,
    };
  }

  return {
    displayName: proc.name,
    iconUrl: undefined,
    isHost: true,
    subtitle: `PID ${proc.pid}`,
  };
}
