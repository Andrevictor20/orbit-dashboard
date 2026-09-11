import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountTab } from '../../components/layout/AccountTab';

describe('AccountTab component', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/2fa/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ enabled: false, recovery_codes_count: 0 }),
        });
      }
      if (url === '/api/auth/2fa/setup') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              secret: 'JBSWY3DPEHPK3PXP',
              otpauth_url: 'otpauth://totp/...',
              qr_data_url: 'data:image/png;base64,...',
              recovery_codes: ['AAAA-1111', 'BBBB-2222'],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders 2FA section in disabled state and opens setup modal', async () => {
    render(<AccountTab />);

    await waitFor(() => {
      expect(screen.getByText('Autenticação de 2 Fatores (2FA)')).toBeInTheDocument();
      expect(screen.getByText('Desativado')).toBeInTheDocument();
      expect(screen.getByText('Configurar 2FA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Configurar 2FA'));

    await waitFor(() => {
      expect(screen.getByText('Configurar Autenticação de 2 Fatores (2FA)')).toBeInTheDocument();
    });
  });

  it('renders 2FA section in active state and opens disable modal', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/auth/2fa/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ enabled: true, recovery_codes_count: 6 }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<AccountTab />);

    await waitFor(() => {
      expect(screen.getByText('Ativado')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('Desativar 2FA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Desativar 2FA'));

    await waitFor(() => {
      expect(screen.getByText('Desativar Autenticação de 2 Fatores')).toBeInTheDocument();
    });
  });
});
