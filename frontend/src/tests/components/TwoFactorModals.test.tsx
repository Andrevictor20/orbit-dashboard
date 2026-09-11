import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TwoFactorSetupModal } from '../../components/auth/TwoFactorSetupModal';
import { TwoFactorDisableModal } from '../../components/auth/TwoFactorDisableModal';

describe('TwoFactorModals', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/auth/2fa/setup') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              secret: 'JBSWY3DPEHPK3PXP',
              otpauth_url: 'otpauth://totp/Orbit:admin?secret=JBSWY3DPEHPK3PXP',
              qr_data_url: 'data:image/png;base64,mockqr',
              recovery_codes: ['AAAA-1111', 'BBBB-2222', 'CCCC-3333', 'DDDD-4444'],
            }),
        });
      }
      if (url === '/api/auth/2fa/enable') {
        const body = JSON.parse(options.body);
        if (body.code === '123456') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ message: '2fa enabled' }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Invalid code' }),
        });
      }
      if (url === '/api/auth/2fa/disable') {
        const body = JSON.parse(options.body);
        if (body.current_password === 'correct_pass') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ message: '2fa disabled' }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Incorrect password' }),
        });
      }
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('TwoFactorSetupModal', () => {
    it('loads setup data and guides user through scanning and enabling', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(<TwoFactorSetupModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

      // Step 1: Scanning & recovery codes
      await waitFor(() => {
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
        expect(screen.getByText('AAAA-1111')).toBeInTheDocument();
        expect(screen.getByText('BBBB-2222')).toBeInTheDocument();
      });

      // Move to step 2: verification
      fireEvent.click(screen.getByRole('button', { name: /Continuar para Verificação/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      // Input code and enable
      fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Ativar 2FA/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('TwoFactorDisableModal', () => {
    it('submits current password to disable 2FA', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(<TwoFactorDisableModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

      expect(screen.getByText('Desativar Autenticação de 2 Fatores')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'correct_pass' } });
      fireEvent.click(screen.getByRole('button', { name: /Desativar 2FA/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
