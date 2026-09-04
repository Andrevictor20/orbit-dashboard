import { resolveWebUrl } from './url';

export interface PortInfo {
  ip?: string;
  private_port: number;
  public_port?: number;
  typ: string;
}

export interface ContainerLike {
  id: string;
  name: string;
  image: string;
  state?: string;
  status?: string;
  cpu_percent?: number;
  memory_used?: number;
  memory_limit?: number;
  ports?: PortInfo[];
  labels?: Record<string, string>;
  size_rw?: number;
  size_root_fs?: number;
}

export interface SingleContainerItem<T extends ContainerLike = ContainerLike> {
  type: 'single';
  id: string;
  name: string;
  container: T;
  iconUrl: string;
  webLink?: string;
  isRunning: boolean;
}

export interface GroupContainerItem<T extends ContainerLike = ContainerLike> {
  type: 'group';
  id: string;
  name: string;
  groupKey: string;
  containers: T[];
  webContainers: T[];
  primaryContainer: T;
  iconUrl: string;
  webLink?: string;
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  runningCount: number;
  totalCount: number;
  allRunning: boolean;
  anyRunning: boolean;
  hasUpdates?: boolean;
}

export type GroupedContainerItem<T extends ContainerLike = ContainerLike> =
  | SingleContainerItem<T>
  | GroupContainerItem<T>;

/**
 * Normalizes and formats a raw group name into a title-cased friendly name.
 * e.g. "ar-saude" -> "Ar Saude", "home_assistant" -> "Home Assistant", "grafana" -> "Grafana"
 */
export function formatGroupName(raw: string): string {
  if (!raw) return 'App';
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extracts candidate group key from container labels or name heuristic.
 */
export function getContainerGroupName(c: ContainerLike): string | null {
  // 1. Check standard Docker Compose / Swarm / CasaOS labels
  if (c.labels) {
    const composeProject = c.labels['com.docker.compose.project'] || c.labels['com.docker.stack.namespace'];
    if (composeProject && composeProject.trim()) {
      return composeProject.trim().toLowerCase();
    }

    const casaosApp = c.labels['io.casaos.app.name'] || c.labels['io.casaos.compose.name'];
    if (casaosApp && casaosApp.trim()) {
      return casaosApp.trim().toLowerCase();
    }
  }

  // 2. Name prefix heuristic
  // For names like "ar-saude-coletor", "ar-saude-frontend", "grafana-server", "homeassistant-db"
  const name = (c.name || '').trim().toLowerCase();
  const parts = name.split(/[-_]+/);

  if (parts.length >= 2) {
    // If 3+ parts (e.g. ["ar", "saude", "coletor"] or ["ar", "saude", "motor", "alertas"]),
    // take the first 2 parts as group key: "ar-saude"
    if (parts.length >= 3) {
      return `${parts[0]}-${parts[1]}`;
    }
    // If 2 parts (e.g. ["grafana", "server"] or ["moodle", "tutorial"]),
    // candidate is the first part: "grafana"
    return parts[0];
  }

  return null;
}

/**
 * Resolves the primary/representative container of a group.
 * Prioritizes:
 * 1. User-saved preferred container ID for this group/stack
 * 2. Containers that have public listening web ports + web keyword in name
 * 3. Containers with public listening web ports
 * 4. Containers containing keywords like "frontend", "web", "ui", "app", "dashboard", "server" in name
 * 5. First running container, or first container in the list.
 */
export function getPrimaryContainer<T extends ContainerLike>(
  containers: T[],
  preferredId?: string | null
): T {
  if (containers.length === 1) return containers[0];

  // 0. Check preferred container ID if supplied
  if (preferredId) {
    const matched = containers.find(c => c.id === preferredId || c.name === preferredId);
    if (matched) return matched;
  }

  const webKeywords = ['frontend', 'web', 'ui', 'dashboard', 'app', 'portal', 'client', 'server'];

  // 1. Check for containers with public ports and web keyword
  for (const c of containers) {
    const hasPublicPort = c.ports && c.ports.some(p => Boolean(p.public_port));
    const nameLower = c.name.toLowerCase();
    if (hasPublicPort && webKeywords.some(kw => nameLower.includes(kw))) {
      return c;
    }
  }

  // 2. Check for containers with public ports
  for (const c of containers) {
    if (c.ports && c.ports.some(p => Boolean(p.public_port))) {
      return c;
    }
  }

  // 3. Check for web keyword in name
  for (const c of containers) {
    const nameLower = c.name.toLowerCase();
    if (webKeywords.some(kw => nameLower.includes(kw))) {
      return c;
    }
  }

  // 4. Running container fallback
  const running = containers.find(c => c.state === 'running');
  return running || containers[0];
}

/**
 * Detects well-known web UI port for common container images.
 */
export function detectWellKnownWebPort(image?: string, name?: string): number | null {
  const combined = `${image || ''}/${name || ''}`.toLowerCase();
  if (combined.includes('home-assistant') || combined.includes('homeassistant')) return 8123;
  if (combined.includes('pihole') || combined.includes('pi-hole')) return 80;
  if (combined.includes('jellyfin') || combined.includes('emby')) return 8096;
  if (combined.includes('plex')) return 32400;
  if (combined.includes('adguard')) return 3000;
  if (combined.includes('kavita')) return 5000;
  if (combined.includes('metube')) return 8081;
  if (combined.includes('moodle')) return 80;
  if (combined.includes('n8n')) return 5678;
  if (combined.includes('cloudflared-web') || combined.includes('cloudflared')) return 14333;
  if (combined.includes('node-red') || combined.includes('nodered')) return 1880;
  if (combined.includes('overseerr')) return 5055;
  if (combined.includes('portainer')) return 9000;
  if (combined.includes('syncthing')) return 8384;
  if (combined.includes('qbittorrent')) return 8080;
  if (combined.includes('transmission')) return 9091;
  if (combined.includes('deluge')) return 8112;
  if (combined.includes('uptime-kuma')) return 3001;
  if (combined.includes('wireguard') || combined.includes('wg-easy')) return 51821;
  if (combined.includes('tailscale')) return 8088;
  if (combined.includes('esphome')) return 6052;
  if (combined.includes('zigbee2mqtt')) return 8080;
  if (combined.includes('vaultwarden') || combined.includes('bitwarden')) return 80;
  if (combined.includes('grafana')) return 3000;
  if (combined.includes('prometheus')) return 9090;
  if (combined.includes('radarr')) return 7878;
  if (combined.includes('sonarr')) return 8989;
  if (combined.includes('lidarr')) return 8686;
  if (combined.includes('bazarr')) return 6767;
  if (combined.includes('prowlarr')) return 9696;
  if (combined.includes('readarr')) return 8787;
  if (combined.includes('audiobookshelf')) return 13378;
  if (combined.includes('photoprism')) return 2342;
  if (combined.includes('immich')) return 2283;
  if (combined.includes('paperless')) return 8000;
  if (combined.includes('navidrome')) return 4533;
  if (combined.includes('nginx-proxy-manager') || combined.includes('npm')) return 81;
  if (combined.includes('nginx') || combined.includes('caddy')) return 80;
  if (combined.includes('nextcloud')) return 80;
  if (combined.includes('beszel')) return 8090;
  if (combined.includes('dozzle')) return 8080;
  if (combined.includes('glances')) return 61208;
  if (combined.includes('netdata')) return 19999;
  if (combined.includes('homarr')) return 7575;
  if (combined.includes('homepage')) return 3000;
  if (combined.includes('flaresolverr')) return 8191;
  if (combined.includes('calibre-web')) return 8083;
  if (combined.includes('komga')) return 25600;
  if (combined.includes('mealie')) return 9000;
  if (combined.includes('wikijs')) return 3000;
  if (combined.includes('trilium')) return 8080;
  if (combined.includes('stirling-pdf')) return 8080;
  if (combined.includes('it-tools') || combined.includes('cyberchef')) return 80;
  if (combined.includes('changedetection')) return 5000;
  if (combined.includes('rustdesk')) return 21117;
  if (combined.includes('guacamole')) return 8080;
  if (combined.includes('cockpit')) return 9090;
  return null;
}

/**
 * Detects web port from CasaOS/Traefik labels.
 */
export function detectLabelWebPort(labels?: Record<string, string>): number | null {
  if (!labels) return null;
  const labelKeys = [
    'io.casaos.port.web',
    'io.casaos.app.port',
    'io.casaos.app.main_port',
    'dev.casaos.app.port',
    'webui.port',
    'web.port',
    'port',
    'PORT'
  ];
  for (const k of labelKeys) {
    if (labels[k]) {
      const p = parseInt(labels[k], 10);
      if (p > 0 && !isNaN(p)) return p;
    }
  }
  for (const [k, v] of Object.entries(labels)) {
    if (k.startsWith('traefik.') && k.endsWith('.loadbalancer.server.port')) {
      const p = parseInt(v, 10);
      if (p > 0 && !isNaN(p)) return p;
    }
  }
  return null;
}

export interface PortLike {
  ip?: string;
  public_port?: number;
  private_port: number;
  typ?: string;
}

/**
 * Deduplicates ports (collapsing IPv4 and IPv6 bindings) and sorts with primary Web ports first.
 */
export function getSortedDeduplicatedPorts<P extends PortLike = PortLike>(
  ports?: P[],
  image?: string,
  name?: string,
  labels?: Record<string, string>
): PortLike[] {
  const labelP = detectLabelWebPort(labels);
  const wellKnownP = detectWellKnownWebPort(image, name);

  if (!ports || ports.length === 0) {
    // If no ports, synthesize if label or well-known exists
    const synth = labelP || wellKnownP;
    if (synth) {
      return [{
        ip: '0.0.0.0',
        public_port: synth,
        private_port: synth,
        typ: 'tcp'
      }];
    }
    return [];
  }

  // 1. Deduplicate by (public_port, private_port, typ)
  const dedupMap: P[] = [];
  const seen = new Set<string>();

  for (const p of ports) {
    const typ = (p.typ || 'tcp').toLowerCase();
    const key = `${p.public_port ?? ''}:${p.private_port}:${typ}`;
    if (seen.has(key)) {
      // If previous was :: and this is 0.0.0.0, prefer 0.0.0.0
      if (p.ip === '0.0.0.0') {
        const idx = dedupMap.findIndex(existing => 
          existing.public_port === p.public_port && 
          existing.private_port === p.private_port && 
          (existing.typ || 'tcp').toLowerCase() === typ
        );
        if (idx !== -1) {
          dedupMap[idx] = p;
        }
      }
      continue;
    }
    seen.add(key);
    dedupMap.push(p);
  }

  // If no public ports exist in the list, synthesize from label or well-known if available
  const hasPublicPort = dedupMap.some(p => Boolean(p.public_port));
  if (!hasPublicPort) {
    const synth = labelP || wellKnownP;
    if (synth) {
      const key = `${synth}:${synth}:tcp`;
      if (!seen.has(key)) {
        dedupMap.push({
          ip: '0.0.0.0',
          public_port: synth,
          private_port: synth,
          typ: 'tcp'
        } as unknown as P);
      }
    }
  }

  // 2. Score and sort (Primary web port first)
  const scorePort = (p: P): number => {
    let score = 0;
    const pub = p.public_port;
    const priv = p.private_port;
    const isTcp = (p.typ || 'tcp').toLowerCase() === 'tcp';

    if (labelP && (pub === labelP || priv === labelP)) return 10000;
    if (wellKnownP && (pub === wellKnownP || priv === wellKnownP)) return 8000;

    if (pub) {
      if (isTcp) {
        const standardWebPorts = [80, 443, 8080, 8443, 3000, 8000, 8081, 8096, 8123, 9000, 9443, 5000, 5055, 1880, 5678, 14333, 32400];
        if (standardWebPorts.includes(pub)) {
          score += 5000;
        } else if ([53, 67, 68, 123, 161, 514].includes(pub)) {
          score -= 3000;
        } else {
          score += 2000;
        }

        if (standardWebPorts.includes(priv)) {
          score += 1500;
        }
      } else {
        score -= 1000;
      }
    } else {
      score -= 4000;
    }

    return score;
  };

  return dedupMap.sort((a, b) => {
    const diff = scorePort(b) - scorePort(a);
    if (diff !== 0) return diff;
    return (a.public_port || a.private_port) - (b.public_port || b.private_port);
  });
}

/**
 * Computes default web link for a container based on custom links or public ports.
 */
export function getContainerWebLink(c: ContainerLike, customLinks: Record<string, string> = {}): string {
  if (customLinks[c.id]) {
    return resolveWebUrl(customLinks[c.id]);
  }

  const sortedPorts = getSortedDeduplicatedPorts(c.ports, c.image, c.name, c.labels);
  if (sortedPorts.length > 0) {
    const primaryPort = sortedPorts[0].public_port || sortedPorts[0].private_port;
    if (primaryPort) {
      return resolveWebUrl(primaryPort);
    }
  }

  return '';
}

/**
 * Groups a list of containers into consolidated GroupContainerItems (if >= 2 containers share a group)
 * and SingleContainerItems (for standalone containers).
 */
export function groupContainers<T extends ContainerLike>(
  containers: T[],
  customLinks: Record<string, string> = {},
  getIconFn?: (image: string, name: string) => string
): GroupedContainerItem<T>[] {
  const getIcon = getIconFn || ((image: string, name: string) => `/api/docker/icons/${encodeURIComponent(name || image)}`);

  // Step 1: Bucket containers by their detected group key
  const groupBuckets = new Map<string, T[]>();
  const unassigned: T[] = [];

  for (const c of containers) {
    const groupKey = getContainerGroupName(c);
    if (groupKey) {
      if (!groupBuckets.has(groupKey)) {
        groupBuckets.set(groupKey, []);
      }
      groupBuckets.get(groupKey)!.push(c);
    } else {
      unassigned.push(c);
    }
  }

  const result: GroupedContainerItem<T>[] = [];
  const processedContainerIds = new Set<string>();

  // Step 2: Form groups for keys with 2+ containers
  for (const [groupKey, bucket] of groupBuckets.entries()) {
    if (bucket.length >= 2) {
      const savedPrimaryId = typeof localStorage !== 'undefined' 
        ? localStorage.getItem(`orbit_stack_primary_${groupKey}`) 
        : null;

      const primary = getPrimaryContainer(bucket, savedPrimaryId);
      const webContainers = bucket.filter(c => 
        (c.ports && c.ports.some(p => Boolean(p.public_port))) || Boolean(customLinks[c.id])
      );

      const totalCpu = bucket.reduce((sum, c) => sum + (c.cpu_percent || 0), 0);
      const totalMemory = bucket.reduce((sum, c) => sum + (c.memory_used || 0), 0);
      const totalDisk = bucket.reduce((sum, c) => sum + ((c.size_rw || 0) + (c.size_root_fs || 0)), 0);
      const runningCount = bucket.filter(c => c.state === 'running').length;
      const totalCount = bucket.length;
      const allRunning = runningCount === totalCount && totalCount > 0;
      const anyRunning = runningCount > 0;
      const webLink = getContainerWebLink(primary, customLinks);
      const iconUrl = getIcon(primary.image, primary.name || groupKey);

      result.push({
        type: 'group',
        id: `group:${groupKey}`,
        name: formatGroupName(groupKey),
        groupKey,
        containers: bucket,
        webContainers,
        primaryContainer: primary,
        iconUrl,
        webLink,
        totalCpu,
        totalMemory,
        totalDisk,
        runningCount,
        totalCount,
        allRunning,
        anyRunning,
      });

      bucket.forEach(c => processedContainerIds.add(c.id));
    }
  }

  // Step 3: All remaining containers become single items
  for (const c of containers) {
    if (!processedContainerIds.has(c.id)) {
      const isRunning = c.state === 'running';
      const webLink = getContainerWebLink(c, customLinks);
      const iconUrl = getIcon(c.image, c.name);

      result.push({
        type: 'single',
        id: c.id,
        name: c.name,
        container: c,
        iconUrl,
        webLink,
        isRunning,
      });
    }
  }

  return result;
}
