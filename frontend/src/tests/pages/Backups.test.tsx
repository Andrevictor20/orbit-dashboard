import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    target_type: 'single_app',
  },
  {
    filename: 'jellyfin_backup_20260909_130000.tar.gz',
    app_name: 'jellyfin',
    size_bytes: 20971520, // 20MB
    created_at: '2026-09-09 13:00:00 UTC',
    app_dir_exists: false,
    target_type: 'single_app',
  },
  {
    filename: 'orbit_full_backup_20260909_140000.tar.gz',
    app_name: 'orbit_system_full',
    size_bytes: 52428800, // 50MB
    created_at: '2026-09-09 14:00:00 UTC',
    app_dir_exists: false,
    target_type: 'system_full',
    description: 'Sistema Completo Orbit',
  },
  {
    filename: 'orbit_configs_backup_20260909_150000.tar.gz',
    app_name: 'orbit_configs',
    size_bytes: 1048576, // 1MB
    created_at: '2026-09-09 15:00:00 UTC',
    app_dir_exists: false,
    target_type: 'orbit_configs',
    description: 'Configurações e integrações',
  },
];

const mockSchedule = {
  enabled: true,
  interval_hours: 24,
  max_backups_per_app: 5,
  apps: ['nextcloud'],
  schedule_scope: 'full_system',
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

  it('renders backup header, KPI stats and backup list with target types', async () => {
    render(
      <BrowserRouter>
        <Backups />
      </BrowserRouter>
    );

    expect(screen.getByText('Backups & Restauração')).toBeInTheDocument();

    // Check that backups are rendered
    await waitFor(() => {
      expect(screen.getByText('nextcloud_backup_20260909_120000.tar.gz')).toBeInTheDocument();
      expect(screen.getByText('orbit_full_backup_20260909_140000.tar.gz')).toBeInTheDocument();
      expect(screen.getByText('orbit_configs_backup_20260909_150000.tar.gz')).toBeInTheDocument();
    });

    // Check formatted sizes
    expect(screen.getByText('10 MB')).toBeInTheDocument();
    expect(screen.getByText('50 MB')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();

    // Check count of saved snapshots KPI
    expect(screen.getByText('4')).toBeInTheDocument();

    // Check schedule status KPI
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('filters backups by search query', async () => {
    render(
      <BrowserRouter>
        <Backups />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('nextcloud_backup_20260909_120000.tar.gz')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/filtrar por app/i);
    fireEvent.change(searchInput, { target: { value: 'system_full' } });

    expect(screen.getByText('orbit_full_backup_20260909_140000.tar.gz')).toBeInTheDocument();
    expect(screen.queryByText('nextcloud_backup_20260909_120000.tar.gz')).not.toBeInTheDocument();
  });
});
