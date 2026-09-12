import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudflareAddRouteModal, detectBaseDomain } from '../../../components/cloudflare/CloudflareAddRouteModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CloudflareAddRouteModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('detectBaseDomain correctly infers base domain from rules or fallback', () => {
    // Fallback without rules
    expect(detectBaseDomain()).toBe('rasppi.cloud');

    // From existing rules
    const rules = [
      {
        hostname: 'app.rasppi.cloud',
        service: 'http://app:80',
        public_url: 'https://app.rasppi.cloud',
      },
    ];
    expect(detectBaseDomain(rules)).toBe('rasppi.cloud');

    // From localStorage
    localStorage.setItem('orbit_base_domain', 'custom.me');
    expect(detectBaseDomain(rules)).toBe('custom.me');
  });

  it('renders modal with smart builder mode, default domain rasppi.cloud and fetches containers', async () => {
    const mockContainers = [
      { id: 'c1', names: ['/stirling-pdf'], state: 'running', ports: [{ public_port: 8082, private_port: 8082 }] },
      { id: 'c2', names: ['/nginx'], state: 'running', ports: [{ public_port: 80, private_port: 80 }] },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/docker/containers')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockContainers,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <CloudflareAddRouteModal
        isOpen={true}
        onClose={vi.fn()}
        onRouteCreated={vi.fn()}
        tunnelId="tun-123-abc"
      />
    );

    expect(screen.getByText(/Adicionar Nova Rota Ingress/i)).toBeTruthy();
    expect(screen.getByText(/Construtor/i)).toBeTruthy();
    expect(screen.getByText(/Manual/i)).toBeTruthy();

    // Default base domain should be rasppi.cloud
    expect(screen.getByDisplayValue('rasppi.cloud')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/stirling-pdf \(ativo\)/i)).toBeTruthy();
      expect(screen.getByDisplayValue('stirling-pdf')).toBeTruthy();
      expect(screen.getByText(/https:\/\/stirling-pdf\.rasppi\.cloud/i)).toBeTruthy();
    });
  });

  it('switches between container mode and custom manual URL mode', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => [] })
    );

    render(
      <CloudflareAddRouteModal
        isOpen={true}
        onClose={vi.fn()}
        onRouteCreated={vi.fn()}
        tunnelId="tun-123-abc"
      />
    );

    // Switch to URL Manual
    const customModeBtn = screen.getByRole('button', { name: /URL Manual/i });
    fireEvent.click(customModeBtn);

    expect(screen.getByPlaceholderText('http://192.168.1.50:8080')).toBeTruthy();
  });

  it('submits new route with builder mode using rasppi.cloud domain', async () => {
    let submittedPayload: any = null;
    const onRouteCreatedMock = vi.fn();
    const onCloseMock = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/docker/containers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'c1', names: ['/stirling-pdf'], state: 'running', ports: [{ public_port: 8082 }] },
          ],
        });
      }
      if (url.includes('/api/cloudflare/routes') && opts?.method === 'POST') {
        submittedPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: "Rota criada com sucesso!",
            dns_created: false,
            dns_message: "DNS CNAME sugerido",
            route: {
              hostname: "pdf.rasppi.cloud",
              service: "http://stirling-pdf:8082",
              public_url: "https://pdf.rasppi.cloud",
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <CloudflareAddRouteModal
        isOpen={true}
        onClose={onCloseMock}
        onRouteCreated={onRouteCreatedMock}
        tunnelId="tun-123-abc"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('stirling-pdf')).toBeTruthy();
      expect(screen.getByDisplayValue('8082')).toBeTruthy();
    });

    // Change subdomain to "pdf"
    const subInput = screen.getByDisplayValue('stirling-pdf');
    fireEvent.change(subInput, { target: { value: 'pdf' } });

    // Verify computed preview is https://pdf.rasppi.cloud
    expect(screen.getByText(/https:\/\/pdf\.rasppi\.cloud/i)).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: /Criar Rota/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submittedPayload).toEqual({
        hostname: 'pdf.rasppi.cloud',
        service: 'http://stirling-pdf:8082',
      });
      expect(onRouteCreatedMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
      expect(localStorage.getItem('orbit_base_domain')).toBe('rasppi.cloud');
    });
  });

  it('allows manual raw mode input without prefix overlap', async () => {
    let submittedPayload: any = null;
    const onRouteCreatedMock = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/docker/containers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'c1', names: ['/jellyfin'], state: 'running', ports: [{ public_port: 8096 }] },
          ],
        });
      }
      if (url.includes('/api/cloudflare/routes') && opts?.method === 'POST') {
        submittedPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: "Rota criada com sucesso!",
            route: {
              hostname: "jellyfin.rasppi.cloud",
              service: "http://jellyfin:8096",
              public_url: "https://jellyfin.rasppi.cloud",
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <CloudflareAddRouteModal
        isOpen={true}
        onClose={vi.fn()}
        onRouteCreated={onRouteCreatedMock}
        tunnelId="tun-123-abc"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('jellyfin')).toBeTruthy();
      expect(screen.getByDisplayValue('8096')).toBeTruthy();
    });

    // Switch to manual/raw mode
    const rawModeBtn = screen.getByRole('button', { name: /^URL Completa$/i });
    fireEvent.click(rawModeBtn);

    const input = screen.getByPlaceholderText(/ex: app\.rasppi\.cloud/i);
    fireEvent.change(input, { target: { value: 'https://jellyfin.rasppi.cloud' } });

    const submitBtn = screen.getByRole('button', { name: /Criar Rota/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submittedPayload).toEqual({
        hostname: 'jellyfin.rasppi.cloud',
        service: 'http://jellyfin:8096',
      });
    });
  });

  it('displays an explanatory authorization banner when Cloudflare API returns Not authorized', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/docker/containers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'c-pdf',
              names: ['/stirling-pdf'],
              state: 'running',
              ports: [{ public_port: 8082, private_port: 8080 }],
            },
          ],
        });
      }
      if (url.includes('/api/cloudflare/routes') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: "Cloudflare API: Não autorizado (Not authorized). O seu API Token não possui permissão para modificar as configurações do túnel.",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <CloudflareAddRouteModal
        isOpen={true}
        onClose={vi.fn()}
        onRouteCreated={vi.fn()}
        tunnelId="tun-123-abc"
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('stirling-pdf')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: /Criar Rota/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Permissão Insuficiente no Cloudflare/i)).toBeTruthy();
      expect(screen.getByRole('link', { name: /Abrir Tokens da Cloudflare/i })).toBeTruthy();
    });
  });
});
