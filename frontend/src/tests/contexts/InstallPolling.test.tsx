import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { InstallProvider, useInstall } from '../../contexts/InstallContext';

function TestConsumer({ startId = 'task-test' }: { startId?: string }) {
  const { tasks, startInstall } = useInstall();
  return (
    <div>
      <div data-testid="task-count">{tasks.length}</div>
      <div data-testid="task-status">{tasks[0]?.status || 'none'}</div>
      <div data-testid="task-progress">{tasks[0]?.progress ?? 0}</div>
      <div data-testid="task-error">{tasks[0]?.error || 'none'}</div>
      <button onClick={() => startInstall(startId, 'TestApp')}>Start</button>
    </div>
  );
}

describe('InstallContext Polling & Error Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks task as error when status endpoint returns 404 and does not poll endlessly', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/store/install/active')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes('/api/store/install/status/task-404')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Task not found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <InstallProvider>
        <TestConsumer startId="task-404" />
      </InstallProvider>
    );

    act(() => {
      screen.getByText('Start').click();
    });

    // Expect the task to be marked as error once 404 is received
    await waitFor(() => {
      expect(screen.getByTestId('task-status').textContent).toBe('error');
    }, { timeout: 3000 });

    expect(screen.getByTestId('task-error').textContent).toContain('não encontrada');
  });

  it('updates task progress and completes when status is done', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/store/install/active')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/store/install/status/task-ok')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'task-ok',
              status: 'pulling',
              progress: 40,
              logs: ['[PULL] downloading layer 1'],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'task-ok',
            status: 'done',
            progress: 100,
            logs: ['[PULL] downloading layer 1', '[INFO] App installed!'],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <InstallProvider>
        <TestConsumer startId="task-ok" />
      </InstallProvider>
    );

    act(() => {
      screen.getByText('Start').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-status').textContent).toBe('done');
      expect(screen.getByTestId('task-progress').textContent).toBe('100');
    }, { timeout: 3000 });
  });
});
