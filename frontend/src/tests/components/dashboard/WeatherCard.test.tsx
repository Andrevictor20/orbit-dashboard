import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { WeatherCard } from '../../../components/dashboard/WeatherCard';

describe('WeatherCard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays weather information', async () => {
    const mockWeather = {
      location_name: 'São Paulo',
      temperature_c: 26.4,
      apparent_temperature_c: 27.1,
      humidity: 65,
      wind_speed_kmh: 14.2,
      weather_code: 1,
      is_day: true,
      condition_text: 'Céu Limpo',
      updated_at: '2026-09-09T18:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeather,
    } as any);

    render(<WeatherCard />);

    // Check loading indicator appears
    expect(screen.getByText(/Carregando previsão/i)).toBeInTheDocument();

    // Wait for weather information to be populated
    await waitFor(() => {
      expect(screen.getByText('São Paulo')).toBeInTheDocument();
      expect(screen.getByText('26°C')).toBeInTheDocument();
      expect(screen.getByText('Céu Limpo')).toBeInTheDocument();
      expect(screen.getByText(/Sensação 27°C/i)).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('14 km/h')).toBeInTheDocument();
    });
  });

  it('allows user to customize city and saves to localStorage', async () => {
    const initialWeather = {
      location_name: 'São Paulo',
      temperature_c: 24,
      apparent_temperature_c: 24,
      humidity: 70,
      wind_speed_kmh: 10,
      weather_code: 0,
      is_day: true,
      condition_text: 'Ensolarado',
      updated_at: '2026-09-09T18:00:00Z',
    };

    const updatedWeather = {
      location_name: 'Curitiba',
      temperature_c: 18,
      apparent_temperature_c: 17,
      humidity: 80,
      wind_speed_kmh: 20,
      weather_code: 3,
      is_day: true,
      condition_text: 'Nublado',
      updated_at: '2026-09-09T18:10:00Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialWeather,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updatedWeather,
      } as any);

    render(<WeatherCard />);

    await waitFor(() => {
      expect(screen.getByText('São Paulo')).toBeInTheDocument();
    });

    // Click on city name to edit
    fireEvent.click(screen.getByText('São Paulo'));

    const input = screen.getByPlaceholderText(/Digite o nome da cidade/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Curitiba' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText('Curitiba')).toBeInTheDocument();
      expect(screen.getByText('18°C')).toBeInTheDocument();
      expect(localStorage.getItem('orbit_weather_city')).toBe('Curitiba');
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/system/weather?city=Curitiba');
  });
});
