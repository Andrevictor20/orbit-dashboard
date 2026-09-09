import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Backups from '../../pages/Backups';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockBackups = [
  {
    filename: 'nextcloud_backup_20260909_120000.tar.gz',
    app_name: 'nextcloud',
    size_bytes: 10485760, // 10MB
    created_at: '2026-09-09 12:00:00 UTC',
    app_dir_exists: true,
  },
  {
    filename: 'jellyfin_backup_20260909_130000.tar.gz',
    app_name: 'jellyfin',
    size_bytes: 20971520, // 20MB
    created_at: '2026-09-09 13:00:00 UTC',
    app_dir_exists: false,
  },
];

const mockSchedule = {
  enabled: true,
  interval_hours: 24,
  max_backups_per_app: 5,
  apps: ['nextcloud'],
  last_run: '2026-09-09 10:00:00 UTC',
};

describe('Backups Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/backups') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBackups),
          });
        }
        if (url === '/api/backups/schedule') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSchedule),
          });
        }
        if (url === '/api/docker/compose/stacks') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ name: 'nextcloud', path: '/data/apps/nextcloud', has_compose: true }]),
          });
        }
        if (url === '/api/docker/containers') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        return Promise.reject(new Error('Not found'));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders backup header, KPI stats and backup list', async () => {
    render(
      <BrowserRouter>
        <Backups />
      </BrowserRouter>
    );

    expect(screen.getByText('Backups & Restauração')).toBeInTheDocument();

    // Check that backups are rendered
    await waitFor(() => {
      expect(screen.getByText('nextcloud_backup_20260909_120000.tar.gz')).toBeInTheDocument();
      expect(screen.getByText('jellyfin_backup_20260909_130000.tar.gz')).toBeInTheDocument();
    });

    // Check formatted sizes
    expect(screen.getByText('10 MB')).toBeInTheDocument();
    expect(screen.getByText('20 MB')).toBeInTheDocument();

    // Check count of saved snapshots KPI
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check schedule status KPI
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });
});
