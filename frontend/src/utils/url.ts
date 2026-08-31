/**
 * Dynamic URL Resolution Utility for Orbit Dashboard
 * 
 * Automatically adapts container and stack web URLs to the active Host IP,
 * VPN (Tailscale/WireGuard), local network IP, or domain used to access Orbit.
 */

export function resolveWebUrl(rawUrlOrPort?: string | number | null, defaultPort?: number): string {
  if (!rawUrlOrPort && !defaultPort) return '';

  const currentHostname = typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';

  const currentProtocol = typeof window !== 'undefined' && window.location?.protocol
    ? window.location.protocol
    : 'http:';

  // If passed a number
  if (typeof rawUrlOrPort === 'number') {
    return `${currentProtocol}//${currentHostname}:${rawUrlOrPort}`;
  }

  const str = (rawUrlOrPort || '').trim();

  // If passed a numeric string e.g. "8080"
  if (/^\d+$/.test(str)) {
    return `${currentProtocol}//${currentHostname}:${str}`;
  }

  if (!str && defaultPort) {
    return `${currentProtocol}//${currentHostname}:${defaultPort}`;
  }

  // If it's a full URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const parsed = new URL(str);
      const isLoopbackOrLocal = 
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0' ||
        parsed.hostname === '::1';

      if (isLoopbackOrLocal) {
        parsed.hostname = currentHostname;
        // Keep port if specified, otherwise default port if any
        return parsed.toString();
      }
      return str;
    } catch {
      return str;
    }
  }

  // If it starts with ":<port>"
  if (str.startsWith(':')) {
    return `${currentProtocol}//${currentHostname}${str}`;
  }

  return str;
}
