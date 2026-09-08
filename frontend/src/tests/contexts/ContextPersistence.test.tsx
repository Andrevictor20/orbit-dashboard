import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BatchUpdateProvider, useBatchUpdate } from '../../contexts/BatchUpdateContext';
import { InstallProvider, useInstall } from '../../contexts/InstallContext';

// Componente auxiliar para inspecionar estado do BatchUpdate
function BatchConsumer() {
  const { isUpdating, taskStatuses, completedTasks, totalTasks } = useBatchUpdate();
  return (
    <div>
      <div data-testid="is-updating">{isUpdating ? 'yes' : 'no'}</div>
      <div data-testid="completed-tasks">{completedTasks}</div>
      <div data-testid="total-tasks">{totalTasks}</div>
      <div data-testid="container-c1">{taskStatuses['c1']?.state || 'none'}</div>
    </div>
  );
}

// Componente auxiliar para inspecionar estado do InstallContext
function InstallConsumer() {
  const { tasks, taskId } = useInstall();
  return (
    <div>
      <div data-testid="current-task-id">{taskId || 'none'}</div>
      <div data-testid="tasks-count">{tasks.length}</div>
      <div data-testid="first-task-status">{tasks[0]?.status || 'none'}</div>
    </div>
  );
}

describe('Context Persistence & F5 Auto-Resume', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores batch update session from localStorage on mount after F5', async () => {
    const fakeSession = {
      orderedTargets: [
        { id: 'c1', name: 'web-app', image: 'nginx:latest' },
        { id: 'c2', name: 'database', image: 'postgres:16' }
      ],
      startIndex: 0,
      taskStatuses: {
        c1: { id: 'c1', name: 'web-app', image: 'nginx:latest', state: 'pulling' },
        c2: { id: 'c2', name: 'database', image: 'postgres:16', state: 'pending' }
      },
      logs: ['[INFO] Retomando lote...'],
      activeContainerName: 'web-app',
      timestamp: Date.now()
    };

    localStorage.setItem('orbit_batch_update_session', JSON.stringify(fakeSession));

    // Mock fetch to prevent network calls from erroring during auto-resume
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/docker/containers/c1/update-status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'pulling', step: 'Downloading layer' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'success' })
      });
    });

    render(
      <BatchUpdateProvider>
        <BatchConsumer />
      </BatchUpdateProvider>
    );

    // Deve hidratar imediatamente com os containers da sessão salva
    await waitFor(() => {
      expect(screen.getByTestId('total-tasks').textContent).toBe('2');
    });
    expect(screen.getByTestId('container-c1').textContent).toBe('pulling');
  });

  it('restores store install tasks from localStorage on mount after F5', async () => {
    const fakeTasks = [
      {
        id: 'install-task-123',
        type: 'app_install',
        title: 'Instalação de Nextcloud',
        status: 'pulling',
        progress: 45,
        logs: ['[INFO] Pulling nextcloud image...'],
        createdAt: Date.now()
      }
    ];

    localStorage.setItem('orbit_install_tasks', JSON.stringify(fakeTasks));
    localStorage.setItem('orbit_install_current_id', 'install-task-123');

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/store/install/active')) {
        return Promise.resolve({
          ok: true,
          json: async () => fakeTasks
        });
      }
      if (url.includes('/api/store/install/status/install-task-123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...fakeTasks[0],
            progress: 50
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <InstallProvider>
        <InstallConsumer />
      </InstallProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-task-id').textContent).toBe('install-task-123');
      expect(screen.getByTestId('tasks-count').textContent).toBe('1');
      expect(screen.getByTestId('first-task-status').textContent).toBe('pulling');
    });
  });
});
