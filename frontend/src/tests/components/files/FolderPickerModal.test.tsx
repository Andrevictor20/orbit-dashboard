import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FolderPickerModal } from '../../../components/files/FolderPickerModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockListResponse = {
  current_path: '/app/data',
  items: [
    { name: 'apps', path: '/app/data/apps', is_dir: true, size: 4096 },
    { name: 'backups', path: '/app/data/backups', is_dir: true, size: 4096 },
    { name: 'config.json', path: '/app/data/config.json', is_dir: false, size: 512 }
  ]
};

const mockSubListResponse = {
  current_path: '/app/data/apps',
  items: [
    { name: 'nextcloud', path: '/app/data/apps/nextcloud', is_dir: true, size: 4096 }
  ]
};

describe('FolderPickerModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/files/storages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            mounts: [{ name: 'DATA', mount_point: '/DATA' }]
          })
        });
      }
      if (url.includes('/api/files/list')) {
        if (url.includes('path=%2Fapp%2Fdata%2Fapps')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSubListResponse)
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockListResponse)
        });
      }
      if (url === '/api/files/mkdir') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.reject(new Error('Not found'));
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal and loads directory folders', async () => {
    render(
      <FolderPickerModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        initialPath="/app/data"
      />
    );

    expect(screen.getByText(/selecionar pasta no servidor/i)).toBeInTheDocument();

    // Folder items should be visible, but non-directory files should NOT be listed
    await waitFor(() => {
      expect(screen.getByText('apps')).toBeInTheDocument();
      expect(screen.getByText('backups')).toBeInTheDocument();
      expect(screen.queryByText('config.json')).not.toBeInTheDocument();
    });
  });

  it('navigates into subfolder when clicked', async () => {
    render(
      <FolderPickerModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        initialPath="/app/data"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('apps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('apps'));

    await waitFor(() => {
      expect(screen.getByText('nextcloud')).toBeInTheDocument();
    });
  });

  it('confirms selection of current path', async () => {
    render(
      <FolderPickerModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        initialPath="/app/data"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('apps')).toBeInTheDocument();
    });

    const selectBtn = screen.getByRole('button', { name: /selecionar esta pasta/i });
    fireEvent.click(selectBtn);

    expect(mockOnSelect).toHaveBeenCalledWith('/app/data');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel is clicked', async () => {
    render(
      <FolderPickerModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        initialPath="/app/data"
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
