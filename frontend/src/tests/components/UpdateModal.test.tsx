import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../i18n';
import { UpdateModal, type SystemUpdateInfo } from '../../components/UpdateModal';

describe('UpdateModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  const mockInfo: SystemUpdateInfo = {
    current_version: '1.0.0',
    latest_version: '1.1.0',
    has_update: true,
    platform: 'linux/arm64',
    arch: 'aarch64',
    release_name: 'Orbit v1.1.0 - Suporte a Multi-Arch e Correções',
    release_notes: 'Fix container restarting loop\n\n- Add explicit chmod +x for orbit-backend in Dockerfile',
    published_at: '2026-08-28T12:00:00Z',
  };

  it('renders update modal with platform, versions and localized changelog badges', () => {
    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={mockInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    expect(screen.getByText('Atualização do Orbit')).toBeInTheDocument();
    expect(screen.getByText(/\[Correção\]/i)).toBeInTheDocument();

    // Click on details tab
    const detailsTab = screen.getByText('Detalhes da Atualização');
    fireEvent.click(detailsTab);

    expect(screen.getByText('ARM64 (Raspberry Pi / ARM)')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
  });

  it('triggers update POST endpoint when clicking update button', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={mockInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    const updateButton = screen.getByText('Atualizar Orbit Agora');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/system/update', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <UpdateModal
        isOpen={true}
        onClose={onClose}
        updateInfo={mockInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    const closeButton = screen.getByLabelText(/Fechar/i);
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
