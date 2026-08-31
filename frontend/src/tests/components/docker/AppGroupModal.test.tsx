import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AppGroupModal } from '../../../components/docker/AppGroupModal';
import type { GroupContainerItem } from '../../../utils/containerGroups';

describe('AppGroupModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockContainer1 = {
    id: 'c11111111111',
    name: 'moodle_app',
    image: 'bitnami/moodle:latest',
    state: 'running',
    status: 'Up 2 hours',
    cpu_percent: 2.1,
    memory_used: 350 * 1024 * 1024,
    ports: [{ private_port: 8080, public_port: 8080, typ: 'tcp' }],
  };

  const mockContainer2 = {
    id: 'c22222222222',
    name: 'moodle_postgres',
    image: 'bitnami/postgresql:latest',
    state: 'running',
    status: 'Up 2 hours',
    cpu_percent: 1.4,
    memory_used: 162 * 1024 * 1024,
    ports: [{ private_port: 5432, typ: 'tcp' }],
  };

  const mockGroup: GroupContainerItem = {
    id: 'group:moodle',
    groupKey: 'stack:moodle',
    name: 'Moodle',
    type: 'group',
    iconUrl: '/api/docker/icons/moodle',
    primaryContainer: mockContainer1,
    totalCount: 2,
    runningCount: 2,
    allRunning: true,
    anyRunning: true,
    totalCpu: 3.5,
    totalMemory: 512 * 1024 * 1024,
    totalDisk: 1024 * 1024 * 1024,
    webContainers: [mockContainer1],
    containers: [mockContainer1, mockContainer2],
  };

  it('renders app group modal with name, count, and sub-containers', () => {
    render(
      <BrowserRouter>
        <AppGroupModal
          group={mockGroup}
          isOpen={true}
          onClose={vi.fn()}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Moodle')).toBeInTheDocument();
    expect(screen.getByText('2 containers')).toBeInTheDocument();
    expect(screen.getByText('2/2 ativos')).toBeInTheDocument();
    expect(screen.getByText('3.5%')).toBeInTheDocument();
    expect(screen.getByText('moodle_app')).toBeInTheDocument();
    expect(screen.getByText('moodle_postgres')).toBeInTheDocument();
  });

  it('triggers container action when clicking restart button', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onRefresh = vi.fn();

    render(
      <BrowserRouter>
        <AppGroupModal
          group={mockGroup}
          isOpen={true}
          onClose={vi.fn()}
          onRefresh={onRefresh}
        />
      </BrowserRouter>
    );

    const restartButtons = screen.getAllByTitle('Reiniciar container');
    expect(restartButtons.length).toBeGreaterThan(0);
    fireEvent.click(restartButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/docker/containers/c11111111111/restart',
        { method: 'POST' }
      );
    });
  });

  it('triggers bulk restart action when clicking top restart button', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onRefresh = vi.fn();

    render(
      <BrowserRouter>
        <AppGroupModal
          group={mockGroup}
          isOpen={true}
          onClose={vi.fn()}
          onRefresh={onRefresh}
        />
      </BrowserRouter>
    );

    const bulkRestart = screen.getByTitle('Reiniciar todos os containers do grupo');
    fireEvent.click(bulkRestart);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/docker/containers/c11111111111/restart',
        { method: 'POST' }
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/docker/containers/c22222222222/restart',
        { method: 'POST' }
      );
    });
  });

  it('triggers onEditLink when clicking the settings/edit route button for a sub-container', () => {
    const onEditLink = vi.fn();

    render(
      <BrowserRouter>
        <AppGroupModal
          group={mockGroup}
          isOpen={true}
          onClose={vi.fn()}
          onEditLink={onEditLink}
        />
      </BrowserRouter>
    );

    const editButtons = screen.getAllByTitle('Configurar Link');
    expect(editButtons.length).toBe(2);
    fireEvent.click(editButtons[0]);

    expect(onEditLink).toHaveBeenCalledWith('c11111111111');
  });
});
