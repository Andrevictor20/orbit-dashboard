import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeErrorMessage,
  isTunnelOrProxy,
  pollContainerUpdate,
} from '../../utils/batchUpdateRunner';

describe('batchUpdateRunner utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeErrorMessage', () => {
    it('returns default fallback for empty text', () => {
      expect(sanitizeErrorMessage('', 500)).toContain('HTTP 500');
      expect(sanitizeErrorMessage('', 504)).toContain('Gateway Timeout');
    });

    it('identifies Cloudflare / proxy 524 timeout HTML', () => {
      const html = '<html><body>524: A timeout occurred</body></html>';
      expect(sanitizeErrorMessage(html, 524)).toContain('Error 524');
    });

    it('identifies Bad Gateway 502 HTML', () => {
      const html = '<html><body>502 Bad Gateway</body></html>';
      expect(sanitizeErrorMessage(html, 502)).toContain('HTTP 502');
    });

    it('truncates overly long non-html error strings', () => {
      const longText = 'a'.repeat(300);
      const sanitized = sanitizeErrorMessage(longText, 500);
      expect(sanitized.length).toBeLessThanOrEqual(203);
      expect(sanitized.endsWith('...')).toBe(true);
    });
  });

  describe('isTunnelOrProxy', () => {
    it('correctly identifies tunnel and proxy containers', () => {
      expect(isTunnelOrProxy({ id: '1', name: 'cloudflared-orbit', image: 'cloudflare/cloudflared:latest' })).toBe(true);
      expect(isTunnelOrProxy({ id: '2', name: 'my-traefik', image: 'traefik:v2.10' })).toBe(true);
      expect(isTunnelOrProxy({ id: '3', name: 'nginx-proxy-manager', image: 'jc21/nginx-proxy-manager' })).toBe(true);
      expect(isTunnelOrProxy({ id: '4', name: 'caddy-ssl', image: 'caddy:alpine' })).toBe(true);
    });

    it('identifies standard applications as normal containers', () => {
      expect(isTunnelOrProxy({ id: '5', name: 'n8n', image: 'n8nio/n8n:latest' })).toBe(false);
      expect(isTunnelOrProxy({ id: '6', name: 'transmission', image: 'linuxserver/transmission:latest' })).toBe(false);
      expect(isTunnelOrProxy({ id: '7', name: 'postgres', image: 'postgres:16' })).toBe(false);
    });
  });

  describe('pollContainerUpdate', () => {
    it('successfully completes when backend returns status success', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'pulling', step: 'Downloading layer 1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'recreating', step: 'Recreating container' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'success', step: 'Update completed' }),
        });

      globalThis.fetch = fetchMock;

      const steps: string[] = [];
      const statuses: string[] = [];
      const logs: string[] = [];

      const result = await pollContainerUpdate({
        containerId: 'c1',
        cleanName: 'n8n',
        token: 'test-token',
        signal: new AbortController().signal,
        isCancelled: () => false,
        onStep: (step) => steps.push(step),
        onStatusChange: (status) => statuses.push(status),
        addLog: (msg) => logs.push(msg),
        pollIntervalMs: 10,
        inactivityTimeoutMs: 1000,
        maxGlobalTimeoutMs: 5000,
      });

      expect(result.success).toBe(true);
      expect(steps).toContain('Downloading layer 1');
      expect(steps).toContain('Recreating container');
      expect(statuses).toContain('pulling');
      expect(statuses).toContain('recreating');
    });

    it('returns error when backend reports task error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'error',
          error: 'Docker daemon out of disk space',
          details: 'no space left on device',
        }),
      });

      const result = await pollContainerUpdate({
        containerId: 'c2',
        cleanName: 'transmission',
        token: 'test-token',
        signal: new AbortController().signal,
        isCancelled: () => false,
        onStep: () => {},
        onStatusChange: () => {},
        addLog: () => {},
        pollIntervalMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Docker daemon out of disk space');
      expect(result.details).toBe('no space left on device');
    });

    it('handles cancellation gracefully via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await pollContainerUpdate({
        containerId: 'c3',
        cleanName: 'redis',
        token: 'test-token',
        signal: controller.signal,
        isCancelled: () => false,
        onStep: () => {},
        onStatusChange: () => {},
        addLog: () => {},
        pollIntervalMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.wasCancelled).toBe(true);
    });

    it('does NOT timeout when download/extract steps are actively progressing', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 5) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'pulling',
              step: `Extracting layer (${callCount * 50}MB / 250MB)`,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'success',
            step: 'Container updated successfully',
          }),
        });
      });

      const steps: string[] = [];
      const result = await pollContainerUpdate({
        containerId: 'c4',
        cleanName: 'n8n',
        token: 'test-token',
        signal: new AbortController().signal,
        isCancelled: () => false,
        onStep: (s) => steps.push(s),
        onStatusChange: () => {},
        addLog: () => {},
        pollIntervalMs: 20,
        inactivityTimeoutMs: 200, // Short inactivity threshold
        maxGlobalTimeoutMs: 5000,
      });

      expect(result.success).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(4);
    });
  });
});
