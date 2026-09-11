import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeInstallModal } from '../../../components/docker/ComposeInstallModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallProvider } from '../../../contexts/InstallContext';

describe('ComposeInstallModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/docker/compose/stacks')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { name: 'my-stack', path: '/data/apps/my-stack', has_compose: true }
            ]),
          });
        }
        if (url.includes('/api/docker/ports/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/api/docker/compose/save')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('ok'),
            json: () => Promise.resolve({ success: true, name: 'test-stack' }),
          });
        }
        return Promise.reject(new Error('Not found'));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal with Compose Editor by default', async () => {
    render(
      <InstallProvider>
        <ComposeInstallModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </InstallProvider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/editor docker compose/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ex: my-custom-app')).toBeInTheDocument();
    expect(screen.getByText('Templates Prontos')).toBeInTheDocument();
  });

  it('allows switching between Compose Editor and Docker Run tabs', async () => {
    render(
      <InstallProvider>
        <ComposeInstallModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </InstallProvider>
    );

    const dockerRunTabBtn = screen.getByRole('button', { name: /docker run/i });
    fireEvent.click(dockerRunTabBtn);

    // Verify Docker Run tab content
    expect(screen.getByPlaceholderText(/docker run -d/i)).toBeInTheDocument();

    const composeEditorTabBtn = screen.getByRole('button', { name: /editor docker compose/i });
    fireEvent.click(composeEditorTabBtn);

    expect(screen.getByPlaceholderText('ex: my-custom-app')).toBeInTheDocument();
  });

  it('handles saving draft stack', async () => {
    render(
      <InstallProvider>
        <ComposeInstallModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </InstallProvider>
    );

    const nameInput = screen.getByPlaceholderText('ex: my-custom-app');
    fireEvent.change(nameInput, { target: { value: 'custom-nginx' } });

    const saveDraftBtn = screen.getByRole('button', { name: /salvar rascunho/i });
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/docker/compose/save',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('calls onClose when close or cancel is clicked', () => {
    render(
      <InstallProvider>
        <ComposeInstallModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </InstallProvider>
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
