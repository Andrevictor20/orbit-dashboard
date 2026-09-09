import { render, screen, fireEvent } from '@testing-library/react';
import { CustomInstallModal } from '../../../components/docker/CustomInstallModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('CustomInstallModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnInstall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/store/apps/test-app/config')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
                volumes: [{ host: '/DATA/AppData', container: '/config' }],
                env: { TZ: 'America/Sao_Paulo' },
              }),
          });
        }
        if (url.includes('/api/docker/ports/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ conflicts: [] }),
          });
        }
        return Promise.reject(new Error('Not found'));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default inputs and handles submit', async () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);

    expect(await screen.findByText(/personalizar instalação/i)).toBeTruthy();

    const hostInput = await screen.findByPlaceholderText('Host');
    expect(hostInput).toBeTruthy();

    const installBtn = screen.getByText('Confirmar e Instalar');
    fireEvent.click(installBtn);

    expect(mockOnInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({ TZ: 'America/Sao_Paulo' }),
        ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
        volumes: [{ host: '/DATA/AppData', container: '/config' }],
      })
    );
  });

  it('can add and remove ports', async () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);

    await screen.findByPlaceholderText('Host');

    const addBtn = screen.getByRole('button', { name: /adicionar/i });
    fireEvent.click(addBtn);

    const hostInputs = screen.getAllByPlaceholderText('Host');
    const containerInputs = screen.getAllByPlaceholderText('Container');

    expect(hostInputs.length).toBe(2);

    fireEvent.change(hostInputs[1], { target: { value: '9090' } });
    fireEvent.change(containerInputs[1], { target: { value: '90' } });

    const installBtn = screen.getByText('Confirmar e Instalar');
    fireEvent.click(installBtn);

    expect(mockOnInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [
          { host: 8080, container: 80, protocol: 'tcp' },
          { host: 9090, container: 90, protocol: 'tcp' },
        ],
      })
    );
  });

  it('can remove a port', async () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);

    await screen.findByPlaceholderText('Host');

    const removeBtns = screen.getAllByTitle('Remover');
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]);

    const installBtn = screen.getByText('Confirmar e Instalar');
    fireEvent.click(installBtn);

    expect(mockOnInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        ports: [],
      })
    );
  });

  it('calls onClose when cancel is clicked', async () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);

    await screen.findByPlaceholderText('Host');

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
