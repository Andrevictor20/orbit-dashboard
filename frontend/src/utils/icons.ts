/**
 * Returns an icon URL for a Docker image based on its name.
 * Falls back to the generic Docker icon.
 */
const IMAGE_ICONS: [string[], string][] = [
  [['nginx'], 'nginx'],
  [['redis'], 'redis'],
  [['node'], 'node-red'],
  [['postgres', 'pg'], 'postgresql'],
  [['mysql'], 'mysql'],
  [['mongo'], 'mongodb'],
  [['pihole', 'pi-hole'], 'pihole'],
  [['portainer'], 'portainer'],
  [['plex'], 'plex'],
  [['jellyfin'], 'jellyfin'],
];

const BASE_URL = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png';

export function getIconForImage(image: string): string {
  const img = image.toLowerCase();
  for (const [keywords, icon] of IMAGE_ICONS) {
    if (keywords.some((kw) => img.includes(kw))) {
      return `${BASE_URL}/${icon}.png`;
    }
  }
  return `${BASE_URL}/docker.png`;
}
