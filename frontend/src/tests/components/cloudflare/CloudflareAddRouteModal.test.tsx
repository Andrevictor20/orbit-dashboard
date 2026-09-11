import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudflareAddRouteModal } from '../../../components/cloudflare/CloudflareAddRouteModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CloudflareAddRouteModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal when open and fetches containers', async () => {
    const mockContainers = [
      { id: 'c1', names: ['/jellyfin'], state: 'running', ports: [{ public_port: 8096, private_port: 8096 }] },
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
    expect(screen.getByPlaceholderText(/jellyfin\.meudominio\.com/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/jellyfin \(ativo\)/i)).toBeTruthy();
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

  it('submits new route successfully and calls onRouteCreated', async () => {
    let submittedPayload: any = null;
    const onRouteCreatedMock = vi.fn();
    const onCloseMock = vi.fn();

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
            dns_created: false,
            dns_message: "DNS CNAME sugerido",
            route: {
              hostname: "jellyfin.example.com",
              service: "http://jellyfin:8096",
              public_url: "https://jellyfin.example.com",
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

    const hostnameInput = screen.getByPlaceholderText(/jellyfin\.meudominio\.com/i);
    fireEvent.change(hostnameInput, { target: { value: 'jellyfin.example.com' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('8096')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: /Criar Rota/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submittedPayload).toEqual({
        hostname: 'jellyfin.example.com',
        service: 'http://jellyfin:8096',
      });
      expect(onRouteCreatedMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
