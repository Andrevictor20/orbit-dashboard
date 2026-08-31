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
    expect(screen.getByText('ARM64 (Raspberry Pi / ARM)')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByText(/\[Correção\]/i)).toBeInTheDocument();
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

  it('renders CI/CD building state with disabled waiting button', () => {
    const buildingInfo: SystemUpdateInfo = {
      ...mockInfo,
      has_update: false,
      ci_status: 'building',
      ci_workflow_url: 'https://github.com/Andrevictor20/orbit-dashboard/actions/runs/12345',
    };

    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={buildingInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Compilando Imagem \(CI\/CD\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Build Multi-Arch em Andamento/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ver CI\/CD/i).length).toBeGreaterThan(0);
  });

  it('renders contextual rich changelogs for known topics', () => {
    const featureInfo: SystemUpdateInfo = {
      ...mockInfo,
      release_notes: '- docker run and compose support with port conflict check\n- telemetria htop cpu usage\n- i18n traduz 11 linguas',
    };

    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={featureInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    expect(screen.getByText(/Instalação com 1-Clique: Docker Run e Compose/i)).toBeInTheDocument();
    expect(screen.getByText(/Telemetria e Monitoramento Preciso de CPU/i)).toBeInTheDocument();
    expect(screen.getByText(/Internacionalização Completa em 11 Idiomas/i)).toBeInTheDocument();
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
