import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileModal } from '../../components/layout/ProfileModal';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('ProfileModal and Settings Tabs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 4 tabs in ProfileModal', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/system/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            server_name: 'Orbit Test',
            port: 5172,
            default_page: '/',
            metrics_refresh_rate: 5,
            show_weather_card: true,
            confirm_dangerous_actions: true,
            integrations: {
              homeassistant: true,
              pihole: true,
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <SettingsProvider>
          <ProfileModal isOpen={true} onClose={vi.fn()} />
        </SettingsProvider>
      </MemoryRouter>
    );

    // Header and Tabs
    expect(await screen.findByText(/Configurações & Perfil/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Conta/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Integrações/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Servidor & Porta/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Aparência/i })).toBeTruthy();
  });

  it('switches to Integrações tab and toggles integration', async () => {
    let currentSettings = {
      server_name: 'Orbit Test',
      port: 5172,
      default_page: '/',
      metrics_refresh_rate: 5,
      show_weather_card: true,
      confirm_dangerous_actions: true,
      integrations: {
        homeassistant: true,
        pihole: true,
      },
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/system/settings')) {
        if (opts?.method === 'POST') {
          currentSettings = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, json: async () => currentSettings });
        }
        return Promise.resolve({ ok: true, json: async () => currentSettings });
      }
      if (url.includes('/api/homeassistant/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true, connected: true, url: 'http://ha.local' }) });
      }
      if (url.includes('/api/pihole/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true, connected: true, url: 'http://pi.hole' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <SettingsProvider>
          <ProfileModal isOpen={true} onClose={vi.fn()} />
        </SettingsProvider>
      </MemoryRouter>
    );

    const integrationsTabBtn = await screen.findByRole('button', { name: /Integrações/i });
    fireEvent.click(integrationsTabBtn);

    // Check Home Assistant and Pi-hole cards
    expect(await screen.findByText('Home Assistant')).toBeTruthy();
    expect(screen.getByText('Pi-hole')).toBeTruthy();

    // Toggle Pi-hole
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(switches[1]); // Pi-hole switch

    await waitFor(() => {
      expect(currentSettings.integrations.pihole).toBe(false);
    });
  });

  it('switches to Servidor & Porta tab and checks port availability', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/system/settings/check-port')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            host_port: 8080,
            container_port: 8080,
            protocol: 'tcp',
            in_use: false,
            suggested_port: 8080,
          }),
        });
      }
      if (url.includes('/api/system/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            server_name: 'Orbit Test',
            port: 5172,
            default_page: '/',
            metrics_refresh_rate: 5,
            show_weather_card: true,
            confirm_dangerous_actions: true,
            integrations: { homeassistant: true, pihole: true },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <SettingsProvider>
          <ProfileModal isOpen={true} onClose={vi.fn()} />
        </SettingsProvider>
      </MemoryRouter>
    );

    const systemTabBtn = await screen.findByRole('button', { name: /Servidor & Porta/i });
    fireEvent.click(systemTabBtn);

    expect(await screen.findByText(/Nome de Exibição do Servidor/i)).toBeTruthy();
    expect(screen.getByText(/Porta Web do Orbit/i)).toBeTruthy();

    const testPortBtn = screen.getByRole('button', { name: /Testar Porta/i });
    fireEvent.click(testPortBtn);

    await waitFor(() => {
      expect(screen.getByText(/Porta livre e pronta para uso!/i)).toBeTruthy();
    });
  });

  it('displays weather city input in Servidor & Porta tab and updates location', async () => {
    let savedPayload: any = null;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/system/settings')) {
        if (opts?.method === 'POST') {
          savedPayload = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, json: async () => savedPayload });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            server_name: 'Orbit Test',
            port: 5172,
            default_page: '/',
            metrics_refresh_rate: 5,
            show_weather_card: true,
            weather_city: 'São Paulo',
            confirm_dangerous_actions: true,
            integrations: { homeassistant: true, pihole: true },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <SettingsProvider>
          <ProfileModal isOpen={true} onClose={vi.fn()} />
        </SettingsProvider>
      </MemoryRouter>
    );

    const systemTabBtn = await screen.findByRole('button', { name: /Servidor & Porta/i });
    fireEvent.click(systemTabBtn);

    const weatherInput = await screen.findByTestId('weather-city-input') as HTMLInputElement;
    expect(weatherInput).toBeTruthy();
    expect(weatherInput.value).toBe('São Paulo');

    fireEvent.change(weatherInput, { target: { value: 'Rio de Janeiro' } });
    expect(weatherInput.value).toBe('Rio de Janeiro');

    const saveBtn = screen.getByRole('button', { name: /Salvar Configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedPayload).toBeTruthy();
      expect(savedPayload.weather_city).toBe('Rio de Janeiro');
    });
  });
});
