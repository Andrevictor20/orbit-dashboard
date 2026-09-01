/**
 * Returns an icon URL for a Docker image based on its name or container name.
 * Returns special '__orbit__' token for Orbit itself, or falls back to parsed image name.
 */
const IMAGE_ICONS: [string[], string][] = [
  [['orbit-dashboard', 'orbit', 'andrevictor20/orbit'], '__orbit__'],
  [['nginx', 'linuxserver/nginx'], 'nginx'],
  [['redis'], 'redis'],
  [['node-red', 'nodered'], 'node-red'],
  [['postgres', 'postgresql', 'pg'], 'postgresql'],
  [['mysql', 'mariadb'], 'mysql'],
  [['mongo', 'mongodb'], 'mongodb'],
  [['pihole', 'pi-hole', 'big-bear-pihole'], 'pi-hole'],
  [['portainer'], 'portainer'],
  [['plex', 'linuxserver/plex'], 'plex'],
  [['jellyfin', 'linuxserver/jellyfin'], 'jellyfin'],
  [['emby', 'linuxserver/emby'], 'emby'],
  [['overseerr', 'overseer', 'sctx/overseerr'], 'overseerr'],
  [['sonarr', 'linuxserver/sonarr'], 'sonarr'],
  [['radarr', 'linuxserver/radarr'], 'radarr'],
  [['prowlarr', 'linuxserver/prowlarr'], 'prowlarr'],
  [['bazarr', 'linuxserver/bazarr'], 'bazarr'],
  [['lidarr', 'linuxserver/lidarr'], 'lidarr'],
  [['readarr', 'linuxserver/readarr'], 'readarr'],
  [['qbittorrent', 'qbit', 'linuxserver/qbittorrent'], 'qbittorrent'],
  [['transmission', 'linuxserver/transmission'], 'transmission'],
  [['deluge', 'linuxserver/deluge'], 'deluge'],
  [['tautulli', 'linuxserver/tautulli'], 'tautulli'],
  [['adguard', 'adguardhome', 'adguard-home'], 'adguard-home'],
  [['wireguard', 'linuxserver/wireguard'], 'wireguard'],
  [['tailscale'], 'tailscale'],
  [['vaultwarden', 'bitwarden'], 'vaultwarden'],
  [['traefik'], 'traefik'],
  [['caddy'], 'caddy'],
  [['watchtower', 'containrrr/watchtower'], 'watchtower'],
  [['stirling-pdf', 's-pdf', 'frooodle/s-pdf'], 'stirling-pdf'],
  [['uptime-kuma', 'louislam/uptime-kuma'], 'uptime-kuma'],
  [['nextcloud', 'linuxserver/nextcloud'], 'nextcloud'],
  [['homeassistant', 'home-assistant', 'home_assistant'], 'home-assistant'],
  [['moodle', 'bitnami/moodle'], 'moodle'],
  [['cloudflare', 'cloudflared'], 'cloudflare'],
  [['kavita', 'linuxserver/kavita', 'jvm/kavita'], 'kavita'],
  [['metube', 'youtube-dl', 'youtubedl', 'alexta69/metube'], 'metube'],
  [['n8n', 'n8nio/n8n'], 'n8n'],
  [['gitea'], 'gitea'],
  [['gitlab'], 'gitlab'],
  [['grafana'], 'grafana'],
  [['prometheus'], 'prometheus'],
  [['portainer-ce'], 'portainer'],
  [['immich'], 'immich'],
  [['paperless', 'paperless-ngx'], 'paperless-ngx'],
  [['photoprism'], 'photoprism'],
  [['syncthing', 'linuxserver/syncthing'], 'syncthing'],
  [['duplicati'], 'duplicati'],
  [['code-server', 'codercom/code-server'], 'code-server'],
];

const BASE_URL = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png';

export function getIconForImage(image: string, containerName?: string): string {
  const img = (image || '').toLowerCase();
  const cname = (containerName || '').toLowerCase();

  for (const [keywords, icon] of IMAGE_ICONS) {
    if (keywords.some((kw) => img.includes(kw) || cname.includes(kw))) {
      if (icon === '__orbit__') return '__orbit__';
      return `${BASE_URL}/${icon}.png`;
    }
  }

  // Extract from image name (e.g. linuxserver/stirling-pdf:latest -> stirling-pdf)
  const parts = img.split('/');
  let lastPart = parts[parts.length - 1].split(':')[0];
  lastPart = lastPart.replace('docker-', '').replace('-docker', '');

  if (lastPart === 'orbit' || lastPart === 'orbit-dashboard') {
    return '__orbit__';
  }

  return `${BASE_URL}/${lastPart}.png`;
}
