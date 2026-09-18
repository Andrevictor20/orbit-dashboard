import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { SystemUpdating } from '../../pages/SystemUpdating';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SystemUpdating Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial update screen with Saturn branding, target version and progress bar', () => {
    localStorage.setItem('saturn_target_version', '3.7.6');

    render(
      <MemoryRouter initialEntries={['/updating?version=3.7.6']}>
        <SystemUpdating />
      </MemoryRouter>
    );

    expect(screen.getByText(/Atualizando o Saturn/i)).toBeInTheDocument();
    expect(screen.getByText('v3.7.6')).toBeInTheDocument();
    expect(screen.getByText(/Iniciando download da imagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Logs do contêiner em tempo real/i)).toBeInTheDocument();
  });

  it('toggles real-time container log terminal when clicking toggle button', () => {
    render(
      <MemoryRouter initialEntries={['/updating']}>
        <SystemUpdating />
      </MemoryRouter>
    );

    const toggleButton = screen.getByText(/Logs do contêiner em tempo real/i);
    expect(screen.queryByText(/Docker Service \/ Container Stream/i)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Docker Service \/ Container Stream/i)).toBeInTheDocument();
    expect(screen.getByText(/Inicializando atualização transparente do contêiner/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByText(/Docker Service \/ Container Stream/i)).not.toBeInTheDocument();
  });

  it('polls /api/system/update/status and updates progress dynamically', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/system/update/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'pulling',
            progress: 45,
            current_step: 'Baixando imagem multi-arch (45%)...',
            logs: ['[INFO] Pulling layer 1...', '[INFO] Pulling layer 2...'],
            error: null,
          }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/updating']}>
        <SystemUpdating />
      </MemoryRouter>
    );

    await vi.advanceTimersByTimeAsync(1100);

    expect(fetchMock).toHaveBeenCalledWith('/api/system/update/status', expect.anything());
    expect(screen.getByText(/Baixando imagem multi-arch \(45%\)\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('transitions to healthcheck loop when status is recreating, confirms health and redirects to login', async () => {
    vi.useFakeTimers();
    localStorage.setItem('saturn_updating', 'true');
    localStorage.setItem('saturn_target_version', '3.8.0');
    localStorage.setItem('saturn_token', 'old_session_token');

    let statusCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/system/update/status') {
        statusCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'recreating',
            progress: 95,
            current_step: 'Reiniciando contêiner do sistema...',
            logs: ['[RESTART] Finalizando contêiner anterior...'],
            error: null,
          }),
        });
      }
      if (url === '/api/health') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            status: 'ok',
            version: '3.8.0',
            arch: 'x86_64',
          }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/updating?version=3.8.0']}>
        <SystemUpdating />
      </MemoryRouter>
    );

    // Advance for status poll
    await vi.advanceTimersByTimeAsync(1100);

    // Advance for health check ping
    await vi.advanceTimersByTimeAsync(1100);

    expect(screen.getByText(/Saturn Atualizado!/i)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Verify localStorage cleanup
    expect(localStorage.getItem('saturn_updating')).toBeNull();
    expect(localStorage.getItem('saturn_token')).toBeNull();
    expect(localStorage.getItem('saturn_last_updated_version')).toBe('3.8.0');

    // Advance past redirect delay (1800ms)
    await vi.advanceTimersByTimeAsync(2000);

    expect(mockNavigate).toHaveBeenCalledWith('/login?updated=true&version=3.8.0', { replace: true });
  });

  it('displays error notice when reconnection attempts exceed limit', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/system/update/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'recreating',
            progress: 90,
            current_step: 'Reiniciando...',
            logs: [],
          }),
        });
      }
      if (url === '/api/health' || url === '/health') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/updating']}>
        <SystemUpdating />
      </MemoryRouter>
    );

    // Status poll triggers recreating
    await vi.advanceTimersByTimeAsync(1100);

    // Advance through 60 health check attempts (60 x 1000ms)
    await vi.advanceTimersByTimeAsync(62000);

    expect(screen.getByText(/Tempo limite ao reconectar/i)).toBeInTheDocument();
  });
});
