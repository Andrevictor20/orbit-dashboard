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
  state: string;
  status: string;
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
 * Computes default web link for a container based on custom links or public ports.
 */
export function getContainerWebLink(c: ContainerLike, customLinks: Record<string, string> = {}): string {
  if (customLinks[c.id]) {
    return resolveWebUrl(customLinks[c.id]);
  }

  if (c.ports && c.ports.length > 0) {
    const publicPort = c.ports.find(p => p.public_port)?.public_port;
    if (publicPort) {
      return resolveWebUrl(publicPort);
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
