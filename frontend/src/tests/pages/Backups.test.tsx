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
    filename: 'saturn_full_backup_20260909_140000.tar.gz',
    app_name: 'saturn_system_full',
    size_bytes: 52428800, // 50MB
    created_at: '2026-09-09 14:00:00 UTC',
    app_dir_exists: false,
    target_type: 'system_full',
    description: 'Sistema Completo Saturn',
  },
  {
    filename: 'saturn_configs_backup_20260909_150000.tar.gz',
    app_name: 'saturn_configs',
    size_bytes: 1048576, // 1MB
    created_at: '2026-09-09 15:00:00 UTC',
    app_dir_exists: false,
    target_type: 'saturn_configs',
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
      expect(screen.getByText('saturn_full_backup_20260909_140000.tar.gz')).toBeInTheDocument();
      expect(screen.getByText('saturn_configs_backup_20260909_150000.tar.gz')).toBeInTheDocument();
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

  it('opens ApplyBackupModal when clicking the top apply button or table row apply button', async () => {
    render(
      <BrowserRouter>
        <Backups />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('nextcloud_backup_20260909_120000.tar.gz')).toBeInTheDocument();
    });

    // Check prominent header apply button
    const headerApplyBtn = screen.getByText('Restaurar / Aplicar Backup');
    expect(headerApplyBtn).toBeInTheDocument();

    // Check table row apply buttons
    const rowApplyButtons = screen.getAllByText('Aplicar');
    expect(rowApplyButtons.length).toBeGreaterThanOrEqual(1);

    // Click header apply button to open modal
    fireEvent.click(headerApplyBtn);

    // Check modal contents
    expect(screen.getByText('Restaure temas, integrações, rotas e recrie os contêineres Docker')).toBeInTheDocument();
    expect(screen.getByText('Snapshots Salvos no Servidor')).toBeInTheDocument();
    expect(screen.getByText('Do Meu Computador (.tar.gz)')).toBeInTheDocument();
  });
});
