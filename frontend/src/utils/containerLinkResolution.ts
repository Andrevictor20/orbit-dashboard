import { resolveWebUrl } from './url';
import type { ContainerLike } from './containerGroups';
import { getSortedDeduplicatedPorts } from './containerGroups';

/**
 * Strips common prefixes and suffixes from container names to extract the core application name.
 * e.g. "linuxserver-kavita-app-1" -> "kavita", "big-bear-pihole" -> "pihole"
 */
export function cleanAppName(name: string): string {
  let s = (name || '').replace(/^\//, '').toLowerCase().trim();

  // Known container prefixes
  const prefixes = [
    'linuxserver-', 'big-bear-', 'bigbear-', 'docker-', 'my-', 'app-',
    'selfhosted-', 'official-', 'server-'
  ];
  for (const p of prefixes) {
    if (s.startsWith(p) && s.length > p.length + 2) {
      s = s.slice(p.length);
      break;
    }
  }

  // Known container suffixes
  const suffixes = [
    '-app-1', '-app', '-frontend', '-server', '-web', '-service',
    '-ui', '-instance', '-main', '-daemon', '-app1', '-1'
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf) && s.length > suf.length + 2) {
      s = s.slice(0, -suf.length);
      break;
    }
  }

  return s.trim();
}

/**
 * Computes default web link for a container based on custom links or public ports.
 */
export function getContainerWebLink(c: ContainerLike, customLinks: Record<string, string> = {}): string {
  const cleanName = (c.name || '').replace(/^\//, '');
  const idShort = c.id && c.id.length >= 12 ? c.id.substring(0, 12) : c.id;
  const composeService = c.labels?.['com.docker.compose.service'];
  const composeProject = c.labels?.['com.docker.compose.project'];

  // 1. Direct key matches
  const directCandidates = [
    c.id,
    idShort,
    cleanName,
    cleanName.toLowerCase(),
    composeService,
    composeService?.toLowerCase(),
    composeProject,
    composeProject?.toLowerCase(),
  ].filter(Boolean) as string[];

  for (const key of directCandidates) {
    if (customLinks[key]) {
      return resolveWebUrl(customLinks[key]);
    }
  }

  // 2. Cleaned app name (stripping prefixes linuxserver-, big-bear-, suffixes -app-1, etc.)
  const stripped = cleanAppName(cleanName);
  if (stripped && customLinks[stripped]) {
    return resolveWebUrl(customLinks[stripped]);
  }

  // 3. Meaningful token matching (e.g. stirling-pdf -> stirling, pdf)
  const tokens = cleanName.toLowerCase().split(/[-_]+/).filter(t => t.length >= 3);
  for (const token of tokens) {
    if (customLinks[token]) {
      return resolveWebUrl(customLinks[token]);
    }
  }

  // 4. Fallback prefix search for IDs and names (strict length >= 12)
  for (const [key, val] of Object.entries(customLinks)) {
    if (!val) continue;
    const keyLower = key.toLowerCase();
    if (c.id && c.id.length >= 12 && key.length >= 12 && (key.startsWith(c.id) || c.id.startsWith(key))) {
      return resolveWebUrl(val);
    }
    if (cleanName && keyLower === cleanName.toLowerCase()) {
      return resolveWebUrl(val);
    }
    if (stripped && keyLower === stripped) {
      return resolveWebUrl(val);
    }
  }

  // 5. Port-based auto-detection fallback
  const sortedPorts = getSortedDeduplicatedPorts(c.ports, c.image, c.name, c.labels);
  if (sortedPorts.length > 0) {
    const primaryPort = sortedPorts[0].public_port || sortedPorts[0].private_port;
    if (primaryPort) {
      return resolveWebUrl(primaryPort);
    }
  }

  return '';
}
