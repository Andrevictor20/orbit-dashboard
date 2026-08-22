/**
 * Returns an icon URL for a Docker image based on its name.
 * Falls back to the generic Docker icon.
 */
const IMAGE_ICONS: [string[], string][] = [
  [['nginx'], 'nginx'],
  [['redis'], 'redis'],
  [['node-red', 'nodered'], 'node-red'],
  [['postgres', 'pg'], 'postgresql'],
  [['mysql'], 'mysql'],
  [['mongo'], 'mongodb'],
  [['pihole', 'pi-hole'], 'pihole'],
  [['portainer'], 'portainer'],
  [['plex'], 'plex'],
  [['jellyfin'], 'jellyfin'],
  [['stirling-pdf', 's-pdf'], 'stirling-pdf'],
  [['orbit-dashboard', 'orbit'], 'orbit'],
  [['uptime-kuma'], 'uptime-kuma'],
  [['nextcloud'], 'nextcloud'],
  [['homeassistant', 'home-assistant'], 'home-assistant'],
];

const BASE_URL = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png';

export function getIconForImage(image: string, containerName?: string): string {
  const img = image.toLowerCase();
  const cname = containerName ? containerName.toLowerCase() : '';

  for (const [keywords, icon] of IMAGE_ICONS) {
    if (keywords.some((kw) => img.includes(kw) || cname.includes(kw))) {
      return `${BASE_URL}/${icon}.png`;
    }
  }

  // Extract from image name (e.g. linuxserver/stirling-pdf:latest -> stirling-pdf)
  const parts = img.split('/');
  let lastPart = parts[parts.length - 1].split(':')[0];
  lastPart = lastPart.replace('docker-', '').replace('-docker', '');

  // If we can't find it in custom list, we try the parsed image name
  // The UI will fallback to docker.png if this URL 404s
  return `${BASE_URL}/${lastPart}.png`;
}
