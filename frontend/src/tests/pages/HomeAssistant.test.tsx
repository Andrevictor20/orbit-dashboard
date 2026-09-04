import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomeAssistant } from '../../pages/HomeAssistant';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('HomeAssistant Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders setup form when Home Assistant is not configured', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/homeassistant/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: false,
            connected: false,
            url: '',
            version: null,
            location_name: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <MemoryRouter>
        <HomeAssistant />
      </MemoryRouter>
    );

    // Header and setup form should be visible
    expect(await screen.findByText(/Conectar ao Home Assistant/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/192.168.1.50:8123/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Cole seu token/i)).toBeTruthy();
  });

  it('renders connected dashboard with entities and filters when configured', async () => {
    const mockEntities = [
      {
        entity_id: 'light.living_room',
        state: 'on',
        attributes: {
          friendly_name: 'Luz da Sala',
          brightness: 204,
          supported_color_modes: ['brightness'],
        },
      },
      {
        entity_id: 'switch.coffee_maker',
        state: 'off',
        attributes: {
          friendly_name: 'Cafeteira',
        },
      },
      {
        entity_id: 'sensor.living_room_temperature',
        state: '23.4',
        attributes: {
          friendly_name: 'Temperatura Sala',
          unit_of_measurement: '°C',
          device_class: 'temperature',
        },
      },
      {
        entity_id: 'binary_sensor.front_door',
        state: 'off',
        attributes: {
          friendly_name: 'Porta Principal',
          device_class: 'door',
        },
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/homeassistant/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            url: 'http://192.168.1.50:8123',
            version: '2026.3.1',
            location_name: 'Minha Casa',
          }),
        });
      }
      if (url.includes('/api/homeassistant/entities')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockEntities,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <HomeAssistant />
      </MemoryRouter>
    );

    // Should display connected location and version
    expect(await screen.findByText(/Minha Casa/i)).toBeTruthy();
    expect(screen.getByText(/2026.3.1/i)).toBeTruthy();

    // Should display entity friendly names
    expect(screen.getByText('Luz da Sala')).toBeTruthy();
    expect(screen.getByText('Cafeteira')).toBeTruthy();
    expect(screen.getByText('Temperatura Sala')).toBeTruthy();
    expect(screen.getByText(/23.4/i)).toBeTruthy();
  });

  it('allows toggling light or switch state', async () => {
    const mockEntities = [
      {
        entity_id: 'light.desk_lamp',
        state: 'off',
        attributes: {
          friendly_name: 'Abajur',
        },
      },
    ];

    let serviceCallMade = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/homeassistant/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            connected: true,
            url: 'http://192.168.1.50:8123',
            version: '2026.3.1',
            location_name: 'Home',
          }),
        });
      }
      if (url.includes('/api/homeassistant/entities')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockEntities,
        });
      }
      if (url.includes('/api/homeassistant/services/light/turn_on')) {
        serviceCallMade = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <HomeAssistant />
      </MemoryRouter>
    );

    expect(await screen.findByText('Abajur')).toBeTruthy();

    // Find toggle button or click the card button
    const toggleBtn = screen.getByRole('button', { name: /alternar abajur/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(serviceCallMade).toBe(true);
    });
  });
});
