import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Logs } from '../../pages/Logs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Logs Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: [
          '2026-08-31 09:00:00 [INFO] Orbit backend started on port 3000',
          '2026-08-31 09:00:05 [WARN] High memory utilization detected',
          '2026-08-31 09:00:10 [ERROR] Connection timed out on upstream',
        ],
        source: 'orbit',
        available_sources: ['orbit', 'system', 'docker', 'dmesg', 'all'],
        total: 3,
      }),
    } as any);

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders the header and source switcher tabs', async () => {
    render(
      <MemoryRouter>
        <Logs />
      </MemoryRouter>
    );

    expect(screen.getByText('Logs do Sistema e do Orbit')).toBeTruthy();
    expect(screen.getByText('Orbit Backend')).toBeTruthy();
    expect(screen.getByText('Sistema Linux')).toBeTruthy();
    expect(screen.getByText('Docker Daemon')).toBeTruthy();
    expect(screen.getByText('Kernel (dmesg)')).toBeTruthy();
    expect(screen.getByText('Todos (Combinado)')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/Orbit backend started on port 3000/)).toBeTruthy();
      expect(screen.getByText(/High memory utilization detected/)).toBeTruthy();
      expect(screen.getByText(/Connection timed out on upstream/)).toBeTruthy();
    });
  });

  it('filters by log level', async () => {
    render(
      <MemoryRouter>
        <Logs />
      </MemoryRouter>
    );

    const errorFilterBtn = screen.getByRole('button', { name: /Erros/i });
    fireEvent.click(errorFilterBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('level=error'),
        expect.anything()
      );
    });
  });

  it('switches log sources', async () => {
    render(
      <MemoryRouter>
        <Logs />
      </MemoryRouter>
    );

    const dockerTab = screen.getByText('Docker Daemon');
    fireEvent.click(dockerTab);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('source=docker'),
        expect.anything()
      );
    });
  });

  it('copies all logs when copy button is clicked', async () => {
    render(
      <MemoryRouter>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Orbit backend started/)).toBeTruthy();
    });

    const copyBtn = screen.getByTitle('Copiar todos os logs visíveis');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
