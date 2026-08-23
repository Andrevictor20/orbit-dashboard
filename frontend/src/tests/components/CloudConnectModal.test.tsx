import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CloudConnectModal } from '../../components/files/CloudConnectModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('CloudConnectModal Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: any) => {
      if (url.includes('/api/files/cloud/oauth/auth-url')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            auth_url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
            state: 'state_123',
            provider: 'google_drive',
          }),
        });
      }
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, account: { id: 'account_123' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }));

    vi.stubGlobal('open', vi.fn(() => ({
      closed: true,
    })));
  });

  it('renders OAuth 1-click cloud providers correctly', async () => {
    render(<CloudConnectModal isOpen={true} onClose={vi.fn()} onConnected={vi.fn()} />);

    expect(screen.getByText('Conectar Armazenamento')).toBeInTheDocument();
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Microsoft OneDrive')).toBeInTheDocument();
    expect(screen.getByText('Dropbox')).toBeInTheDocument();
    expect(screen.getByText('Entrar com Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Entrar com Microsoft OneDrive')).toBeInTheDocument();
    expect(screen.getByText('Entrar com Dropbox')).toBeInTheDocument();
  });

  it('switches to network tab and renders SMB and WebDAV protocols', async () => {
    render(<CloudConnectModal isOpen={true} onClose={vi.fn()} onConnected={vi.fn()} />);

    const networkTab = screen.getByText(/Rede Local \/ Servidores/i);
    fireEvent.click(networkTab);

    expect(screen.getByText('Compartilhamento SMB / Samba')).toBeInTheDocument();
    expect(screen.getByText('Servidor WebDAV / Nextcloud')).toBeInTheDocument();
  });

  it('handles Google Drive 1-click login click', async () => {
    const onConnected = vi.fn();
    render(<CloudConnectModal isOpen={true} onClose={vi.fn()} onConnected={onConnected} />);

    const googleBtn = screen.getByText('Entrar com Google Drive');
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/files/cloud/oauth/auth-url?provider=google_drive'));
    });
  });
});
