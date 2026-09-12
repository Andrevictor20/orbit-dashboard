/**
 * Navigation and route preloading utilities.
 * Preloads route chunks on hover or focus to make navigation instantaneous.
 */

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Overview'),
  '/metrics': () => import('../pages/Metrics'),
  '/containers': () => import('../pages/Containers'),
  '/store': () => import('../pages/AppStore'),
  '/images': () => import('../pages/Images'),
  '/networks': () => import('../pages/Networks'),
  '/volumes': () => import('../pages/Volumes'),
  '/backups': () => import('../pages/Backups'),
  '/files': () => import('../pages/FileManager'),
  '/disk-analyzer': () => import('../pages/DiskAnalyzer'),
  '/terminal': () => import('../pages/Terminal'),
  '/logs': () => import('../pages/Logs'),
  '/homeassistant': () => import('../pages/HomeAssistant'),
  '/pihole': () => import('../pages/PiHole'),
  '/cloudflare': () => import('../pages/Cloudflare'),
};

const preloadedRoutes = new Set<string>();

export function preloadRoute(path: string): void {
  if (!path) return;
  const cleanPath = path.split('?')[0].split('#')[0];
  if (preloadedRoutes.has(cleanPath)) return;

  const loader = routeLoaders[cleanPath];
  if (loader) {
    preloadedRoutes.add(cleanPath);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        loader().catch(() => {});
      });
    } else {
      setTimeout(() => {
        loader().catch(() => {});
      }, 0);
    }
  }
}
