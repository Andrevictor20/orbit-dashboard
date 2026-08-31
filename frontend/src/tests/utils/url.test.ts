import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveWebUrl } from '../../utils/url';

describe('resolveWebUrl', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      hostname: '192.168.100.17',
      protocol: 'http:',
      host: '192.168.100.17:5172',
      port: '5172',
    } as any;
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('resolves numeric port to active hostname URL', () => {
    expect(resolveWebUrl(8080)).toBe('http://192.168.100.17:8080');
  });

  it('resolves string port to active hostname URL', () => {
    expect(resolveWebUrl('5000')).toBe('http://192.168.100.17:5000');
  });

  it('replaces localhost in saved custom link with active host IP', () => {
    expect(resolveWebUrl('http://localhost:8096/web')).toBe('http://192.168.100.17:8096/web');
  });

  it('replaces 127.0.0.1 with active VPN IP', () => {
    window.location.hostname = '100.90.154.70';
    expect(resolveWebUrl('http://127.0.0.1:3000/dashboard')).toBe('http://100.90.154.70:3000/dashboard');
  });

  it('preserves external and subdomain URLs not using loopback', () => {
    expect(resolveWebUrl('https://my-app.duckdns.org:8443')).toBe('https://my-app.duckdns.org:8443');
  });

  it('handles empty input gracefully', () => {
    expect(resolveWebUrl('')).toBe('');
    expect(resolveWebUrl(null)).toBe('');
    expect(resolveWebUrl(undefined, 80)).toBe('http://192.168.100.17:80');
  });
});
