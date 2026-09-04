import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../../i18n';
import { UpdateModal, type SystemUpdateInfo } from '../../../components/system/UpdateModal';

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

    expect(screen.getByText('Atualização do Sistema')).toBeInTheDocument();
    expect(screen.getByText('ARM64 (Raspberry Pi / ARM)')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByText(/NOVIDADE/i)).toBeInTheDocument();
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

    const updateButton = screen.getByText(/Atualizar para v1.1.0/i);
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/system/update', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('renders CI/CD building state with disabled waiting button and auto-polls', () => {
    vi.useFakeTimers();
    const onRefreshInfo = vi.fn();
    const buildingInfo: SystemUpdateInfo = {
      ...mockInfo,
      has_update: true,
      ci_status: 'building',
      ci_workflow_url: 'https://github.com/Andrevictor20/orbit-dashboard/actions/runs/12345',
    };

    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={buildingInfo}
        onRefreshInfo={onRefreshInfo}
      />
    );

    expect(screen.getAllByText(/Compilando Imagem/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Compilação Multi-Arch em Andamento/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ver CI\/CD/i).length).toBeGreaterThan(0);

    const buildingButton = screen.getByText(/Compilando Imagem no GitHub/i);
    expect(buildingButton.closest('button')).toBeDisabled();

    // Advance time by 7s to verify auto-polling
    vi.advanceTimersByTime(7500);
    expect(onRefreshInfo).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renders structured bullet release notes', () => {
    const featureInfo: SystemUpdateInfo = {
      ...mockInfo,
      release_notes: '### ✨ Novidades\n- **Novo Painel:** Visual remodelado com bento apps.\n### ⚡ Desempenho\n- **Muito mais rápido:** Sem travamentos.\n### 🛠️ Correções\n- **Discos:** Reconhecimento correto de HDs.',
    };

    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={featureInfo}
        onRefreshInfo={vi.fn()}
      />
    );

    expect(screen.getByText(/Novo Painel/i)).toBeInTheDocument();
    expect(screen.getByText(/Visual remodelado com bento apps/i)).toBeInTheDocument();
    expect(screen.getByText(/Muito mais rápido/i)).toBeInTheDocument();
    expect(screen.getByText(/Discos/i)).toBeInTheDocument();
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

    const closeButtons = screen.getAllByText(/Fechar/i);
    fireEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalled();
  });
});
