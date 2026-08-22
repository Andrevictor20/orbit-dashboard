import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudConnectModal } from '../../components/files/CloudConnectModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('CloudConnectModal Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((_url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, id: 'account_123' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          providers: [
            { id: 'google_drive', name: 'Google Drive', icon: 'google_drive' },
            { id: 'onedrive', name: 'OneDrive', icon: 'onedrive' },
            { id: 'dropbox', name: 'Dropbox', icon: 'dropbox' },
            { id: 'smb', name: 'Armazenamento de Rede (SMB)', icon: 'server' },
          ]
        }),
      });
    }));
  });

  it('renders provider selection and connects Google Drive', async () => {
    const onConnected = vi.fn();
    render(<CloudConnectModal isOpen={true} onClose={vi.fn()} onConnected={onConnected} />);

    expect(await screen.findByText('Google Drive')).toBeTruthy();
    expect(screen.getByText('Dropbox')).toBeTruthy();
    expect(screen.getByText('OneDrive')).toBeTruthy();

    // Select Google Drive
    fireEvent.click(screen.getByText('Google Drive'));

    // Fill form
    const nameInput = screen.getByLabelText(/Nome|Name/i);
    fireEvent.change(nameInput, { target: { value: 'Meu Drive' } });

    const submitBtn = screen.getByTestId('submit-cloud-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalled();
    });
  });
});
