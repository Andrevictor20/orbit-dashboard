import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchUpdateModal } from '../../../components/docker/BatchUpdateModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ContainerLike } from '../../../utils/containerGroups';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('BatchUpdateModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdateComplete = vi.fn();

  const mockContainers: ContainerLike[] = [
    {
      id: 'c1',
      name: '/nginx-proxy',
      image: 'nginx:alpine',
      state: 'running',
      status: 'Up 2 hours',
      labels: { 'com.docker.compose.project': 'web-stack' }
    },
    {
      id: 'c2',
      name: '/postgres-db',
      image: 'postgres:15',
      state: 'running',
      status: 'Up 5 hours',
      labels: { 'com.docker.compose.project': 'db-stack' }
    },
    {
      id: 'c3',
      name: '/redis-cache',
      image: 'redis:alpine',
      state: 'stopped',
      status: 'Exited (0) 10 minutes ago'
    }
  ];

  const mockUpdatesMap = {
    c1: { has_update: true },
    c2: { has_update: false },
    c3: { has_update: true }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BatchUpdateModal
        isOpen={false}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders container selection list when open', () => {
    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );

    // Filter defaults to outdated (c1 and c3)
    expect(screen.getByText('nginx-proxy')).toBeTruthy();
    expect(screen.getByText('redis-cache')).toBeTruthy();
    expect(screen.getByText(/2 pendente\(s\)/i)).toBeTruthy();
  });

  it('switches between outdated and all containers filter', () => {
    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );

    // Switch to "all containers"
    const allButton = screen.getByRole('button', { name: /Todos os containers/i });
    fireEvent.click(allButton);

    expect(screen.getByText('postgres-db')).toBeTruthy();
  });

  it('handles selecting and deselecting containers', () => {
    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );

    // Click on Deselect All
    const deselectBtn = screen.getByText('Desmarcar Todos');
    fireEvent.click(deselectBtn);

    // Update button should be disabled when 0 selected
    const startBtn = screen.getByRole('button', { name: /Atualizar 0 Container/i });
    expect(startBtn.hasAttribute('disabled')).toBe(true);

    // Click on Select All
    const selectBtn = screen.getByText('Selecionar Todos');
    fireEvent.click(selectBtn);

    const activeStartBtn = screen.getByRole('button', { name: /Atualizar 2 Container/i });
    expect(activeStartBtn.hasAttribute('disabled')).toBe(false);
  });

  it('executes batch update successfully and shows telemetry', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', message: 'Container atualizado com sucesso!' })
    });

    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
        onUpdateComplete={mockOnUpdateComplete}
      />
    );

    const startBtn = screen.getByRole('button', { name: /Atualizar 2 Container/i });
    fireEvent.click(startBtn);

    // Should finish and show summary
    await waitFor(() => {
      expect(screen.getByText(/Resumo da Operação/i)).toBeTruthy();
    });

    // Both containers should finish
    await waitFor(() => {
      expect(screen.getByText(/2 Atualizado com sucesso/i)).toBeTruthy();
    });

    expect(mockOnUpdateComplete).toHaveBeenCalled();
  });

  it('displays detailed error message when a container update fails', async () => {
    (globalThis.fetch as any).mockImplementation((url: string) => {
      if (url.includes('c1')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            status: 'error',
            message: 'Falha ao baixar imagem: rate limit exceeded',
            details: 'Docker Hub 429 Too Many Requests'
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'success', message: 'Container atualizado' })
      });
    });

    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
        onUpdateComplete={mockOnUpdateComplete}
      />
    );

    const startBtn = screen.getByRole('button', { name: /Atualizar 2 Container/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 Falha na atualização/i)).toBeTruthy();
    });

    // Expand error details
    const expandBtn = screen.getByTitle('Ver detalhes do erro');
    fireEvent.click(expandBtn);

    expect(screen.getAllByText(/Falha ao baixar imagem: rate limit exceeded/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Docker Hub 429 Too Many Requests/i)).toBeTruthy();
  });
});
