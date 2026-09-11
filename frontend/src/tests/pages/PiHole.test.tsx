import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PiHole } from '../../pages/PiHole';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('PiHole Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders connect call-to-action when Pi-hole is not configured', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/pihole/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: false,
            connected: false,
            url: '',
            status: null,
            error: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PiHole />
      </MemoryRouter>
    );

    // Main header should be rendered
    expect(await screen.findByText(/Pi-hole/i)).toBeTruthy();
    // Banner CTA should be present
    expect(screen.getByText(/Conecte sua instância do Pi-hole/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Conectar Pi-hole/i })).toBeTruthy();
  });

  it('renders telemetry metrics and domain tabs when configured and connected', async () => {
    const mockStats = {
      domains_being_blocked: 154200,
      dns_queries_today: 12450,
      ads_blocked_today: 2840,
      ads_percentage_today: 22.8,
      unique_clients: 8,
      status: 'enabled',
      top_queries: {
        'github.com': 150,
        'google.com': 120,
      },
      top_ads: {
        'telemetry.app.com': 90,
        'ads.doubleclick.net': 75,
      },
      top_clients: [
        { ip: '192.168.1.50', name: 'MacBook-Pro', count: 1200, percentage: 45.0 },
        { ip: '192.168.1.100', name: 'iPhone', count: 800, percentage: 30.0 },
      ],
      upstreams: [
        { destination: '1.1.1.1', name: 'Cloudflare DNS', count: 2000, percentage: 80.0 },
      ],
      query_types: {
        A: 1500,
        AAAA: 600,
      },
      recent_queries: [
        {
          timestamp: 1726000000,
          time: '18:34:10',
          query_type: 'A',
          domain: 'api.github.com',
          client: '192.168.1.50',
          status: 'forwarded',
        },
      ],
    };

    const mockDomains = [
      { domain: 'safe.internal', list_type: 'white', enabled: true },
      { domain: 'malware.bad', list_type: 'black', enabled: true },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/pihole/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            url: 'http://pi.hole',
            status: 'enabled',
            error: null,
          }),
        });
      }
      if (url.includes('/api/pihole/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockStats,
        });
      }
      if (url.includes('/api/pihole/domains')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockDomains,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PiHole />
      </MemoryRouter>
    );

    // Status connected badge
    expect(await screen.findByText(/Conectado/i)).toBeTruthy();
    // Blocking active button
    expect(screen.getByText(/Bloqueio Ativo/i)).toBeTruthy();

    // Stats values
    expect(await screen.findByText(/12[.,]450/)).toBeTruthy();
    expect(screen.getByText(/2[.,]840/)).toBeTruthy();
    expect(screen.getByText(/22[.,]8%/)).toBeTruthy();
    expect(screen.getByText(/154[.,]200/)).toBeTruthy();

    // Top Domains
    expect(screen.getByText('github.com')).toBeTruthy();
    expect(screen.getByText('telemetry.app.com')).toBeTruthy();

    // Top Clients
    expect(screen.getByText('MacBook-Pro')).toBeTruthy();
    expect(screen.getByText('192.168.1.100')).toBeTruthy();

    // Network Analytics (Upstreams & Query Types)
    expect(screen.getByText('Cloudflare DNS')).toBeTruthy();
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('AAAA')).toBeTruthy();

    // Recent Queries
    expect(screen.getByText('api.github.com')).toBeTruthy();
  });

  it('handles toggle blocking action', async () => {
    let blockingState = 'enabled';

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/pihole/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            url: 'http://pi.hole',
            status: blockingState,
          }),
        });
      }
      if (url.includes('/api/pihole/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dns_queries_today: 100,
            ads_blocked_today: 10,
            ads_percentage_today: 10,
            domains_being_blocked: 5000,
            status: blockingState,
          }),
        });
      }
      if (url.includes('/api/pihole/blocking')) {
        const body = JSON.parse(opts?.body || '{}');
        blockingState = body.enable ? 'enabled' : 'disabled';
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: blockingState,
            message: `Blocking ${blockingState}`,
          }),
        });
      }
      if (url.includes('/api/pihole/domains')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PiHole />
      </MemoryRouter>
    );

    const activeBtn = await screen.findByText(/Bloqueio Ativo/i);
    expect(activeBtn).toBeTruthy();

    fireEvent.click(activeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Bloqueio Desativado/i)).toBeTruthy();
    });
  });

  it('switches to domains tab and manages whitelist/blacklist', async () => {
    const mockDomains = [
      { domain: 'safe.internal', list_type: 'white', enabled: true },
      { domain: 'adtracker.org', list_type: 'black', enabled: true },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/pihole/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            url: 'http://pi.hole',
            status: 'enabled',
          }),
        });
      }
      if (url.includes('/api/pihole/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dns_queries_today: 50,
            status: 'enabled',
          }),
        });
      }
      if (url.includes('/api/pihole/domains')) {
        if (opts?.method === 'POST') {
          const body = JSON.parse(opts?.body || '{}');
          mockDomains.push({ domain: body.domain, list_type: body.list_type, enabled: true });
          return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
        }
        if (opts?.method === 'DELETE') {
          return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockDomains,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PiHole />
      </MemoryRouter>
    );

    const domainsTab = await screen.findByRole('button', { name: /Gerenciamento de Domínios/i });
    fireEvent.click(domainsTab);

    // Whitelist active by default
    expect(await screen.findByText('safe.internal')).toBeTruthy();

    // Switch to Blacklist
    const blacklistTab = screen.getByRole('button', { name: /Blacklist/i });
    fireEvent.click(blacklistTab);
    expect(await screen.findByText('adtracker.org')).toBeTruthy();
  });
});
