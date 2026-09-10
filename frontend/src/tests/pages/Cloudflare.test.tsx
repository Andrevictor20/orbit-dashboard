import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Cloudflare } from '../../pages/Cloudflare';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('Cloudflare Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then shows header', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/cloudflare/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: false,
            account_id: '',
            tunnel_id: '',
            api_token: '',
            has_api_token: false,
            auto_sync_links: true,
            enabled: true,
            detected: null,
          }),
        });
      }
      if (url.includes('/api/cloudflare/tunnels')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: {
              configured: false,
              connected: false,
              mode: 'none',
              routes_count: 0,
            },
            rules: [],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <Cloudflare />
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(await screen.findByText(/Cloudflare Tunnels/i)).toBeTruthy();
    expect(screen.getByText(/Desconectado/i)).toBeTruthy();
  });

  it('renders detected container banner and applies credentials', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/cloudflare/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: false,
            account_id: '',
            tunnel_id: '',
            api_token: '',
            has_api_token: false,
            auto_sync_links: true,
            enabled: true,
            detected: {
              container_id: 'cf_123',
              container_name: 'my-cloudflared',
              account_id: 'acc_auto_999',
              tunnel_id: 'tun_auto_888',
              has_token: true,
              local_config_path: '/etc/cloudflared/config.yml',
              status: 'running',
            },
          }),
        });
      }
      if (url.includes('/api/cloudflare/tunnels')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: {
              configured: false,
              connected: false,
              mode: 'none',
              routes_count: 0,
            },
            rules: [],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <Cloudflare />
      </MemoryRouter>
    );

    // Detected container banner should be visible
    expect(await screen.findByText(/Contêiner cloudflared detectado no Docker!/i)).toBeTruthy();
    expect(screen.getByText('my-cloudflared')).toBeTruthy();

    // Click Apply Credentials
    const applyBtn = screen.getByRole('button', { name: /Preencher Credenciais/i });
    fireEvent.click(applyBtn);

    // Configuration form should open with pre-filled inputs
    await waitFor(() => {
      const accountInput = screen.getByDisplayValue('acc_auto_999');
      const tunnelInput = screen.getByDisplayValue('tun_auto_888');
      expect(accountInput).toBeTruthy();
      expect(tunnelInput).toBeTruthy();
    });
  });

  it('renders ingress rules table and triggers link sync', async () => {
    const mockRules = [
      {
        hostname: 'jellyfin.example.com',
        service: 'http://jellyfin:8096',
        public_url: 'https://jellyfin.example.com',
        matched_container_id: 'jellyfin_id',
        matched_container_name: 'jellyfin',
      },
      {
        hostname: 'sonarr.example.com',
        service: 'http://192.168.1.10:8989',
        public_url: 'https://sonarr.example.com',
        matched_container_id: null,
        matched_container_name: null,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/cloudflare/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            account_id: 'acc_123',
            tunnel_id: 'tun_123',
            api_token: 'cf_tok••••1234',
            has_api_token: true,
            auto_sync_links: true,
            enabled: true,
            detected: null,
          }),
        });
      }
      if (url.includes('/api/cloudflare/tunnels')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: {
              configured: true,
              connected: true,
              mode: 'remote',
              tunnel_name: 'homelab-tunnel',
              routes_count: 2,
            },
            rules: mockRules,
          }),
        });
      }
      if (url.includes('/api/cloudflare/sync-links') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            synced_count: 1,
            synced_links: { jellyfin_id: 'https://jellyfin.example.com' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <Cloudflare />
      </MemoryRouter>
    );

    // Hostname and service should be visible
    expect(await screen.findByText('jellyfin.example.com')).toBeTruthy();
    expect(screen.getByText('http://jellyfin:8096')).toBeTruthy();
    expect(screen.getByText('Vinculado')).toBeTruthy();
    expect(screen.getByText('Sem contêiner detectado')).toBeTruthy();

    // Click Sync Links
    const syncBtn = screen.getByRole('button', { name: /Sincronizar Links/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/cloudflare/sync-links', expect.objectContaining({ method: 'POST' }));
    });
  });
});
