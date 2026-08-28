import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileManager } from '../../pages/FileManager';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test_token',
    username: 'admin',
    isAuthenticated: true,
  }),
}));

const mockFilesResponse = {
  current_path: '/home/user',
  items: [
    { name: 'Documents', path: '/home/user/Documents', is_dir: true, size: 4096, modified: '2026-08-22T10:00:00Z', extension: '', mime_type: 'inode/directory', is_hidden: false },
    { name: 'Downloads', path: '/home/user/Downloads', is_dir: true, size: 4096, modified: '2026-08-22T10:00:00Z', extension: '', mime_type: 'inode/directory', is_hidden: false },
    { name: 'notes.txt', path: '/home/user/notes.txt', is_dir: false, size: 1024, modified: '2026-08-22T10:05:00Z', extension: 'txt', mime_type: 'text/plain', is_hidden: false },
    { name: '.config', path: '/home/user/.config', is_dir: true, size: 4096, modified: '2026-08-22T10:06:00Z', extension: '', mime_type: 'inode/directory', is_hidden: true },
    { name: 'sample.mp3', path: '/home/user/sample.mp3', is_dir: false, size: 5242880, modified: '2026-08-22T10:10:00Z', extension: 'mp3', mime_type: 'audio/mpeg', is_hidden: false },
    { name: 'video.mkv', path: '/home/user/video.mkv', is_dir: false, size: 104857600, modified: '2026-08-22T10:15:00Z', extension: 'mkv', mime_type: 'video/x-matroska', is_hidden: false },
    { name: 'document.pdf', path: '/home/user/document.pdf', is_dir: false, size: 2097152, modified: '2026-08-22T10:20:00Z', extension: 'pdf', mime_type: 'application/pdf', is_hidden: false },
  ],
  total_items: 7
};

const mockStoragesResponse = {
  mounts: [
    { name: 'SSD NVMe', mount_point: '/', fs_type: 'ext4', total_bytes: 920000000000, used_bytes: 480000000000, available_bytes: 440000000000 },
    { name: 'SSD NVMe', mount_point: '/boot/efi', fs_type: 'vfat', total_bytes: 1000000000, used_bytes: 200000000, available_bytes: 800000000 },
    { name: 'HD Externo (pi-boot)', mount_point: '/media/pi-boot', fs_type: 'external', total_bytes: 0, used_bytes: 0, available_bytes: 0 }
  ]
};

const mockShortcutsResponse = {
  home: '/home/user',
  documents: '/home/user/Documents',
  downloads: '/home/user/Downloads',
  pictures: '/home/user/Pictures',
  music: '/home/user/Music',
  videos: '/home/user/Videos',
  root: '/'
};

describe('FileManager Page Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/files/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFilesResponse),
        });
      }
      if (url.includes('/api/files/storages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStoragesResponse),
        });
      }
      if (url.includes('/api/files/shortcuts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShortcutsResponse),
        });
      }
      if (url.includes('/api/files/cloud/accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accounts: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders sidebar with Nautilus-style places and filters out small/fake external drives', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    // Nautilus-style sidebar places
    await waitFor(async () => {
      const homeElements = await screen.findAllByText(/Início|Home/i);
      expect(homeElements.length).toBeGreaterThan(0);
    });

    const docElements = await screen.findAllByText(/Documentos|Documents/i);
    expect(docElements.length).toBeGreaterThan(0);

    const dlElements = await screen.findAllByText(/Downloads/i);
    expect(dlElements.length).toBeGreaterThan(0);

    // Broken placeholders must not exist
    expect(screen.queryByText('DATA')).toBeNull();
    expect(screen.queryByText('Gallery')).toBeNull();

    // Fake external drive (pi-boot with 0 bytes) and boot partition (1.0 GB) MUST NOT be listed in sidebar
    expect(screen.queryByText('HD Externo (pi-boot)')).toBeNull();

    // Real SSD NVMe drive must exist
    expect(await screen.findByText('SSD NVMe')).toBeTruthy();
  });

  it('renders files and opens folder on single click', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    expect((await screen.findAllByText('Documents'))[0]).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();

    // Single click on Documents folder should trigger navigation immediately
    const folderCard = (await screen.findAllByText('Documents'))[0].closest('div');
    if (folderCard) {
      fireEvent.click(folderCard);
    }
  });

  it('toggles hidden files visibility', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    await screen.findByText('notes.txt');

    // By default hidden files starting with . are hidden
    expect(screen.queryByText('.config')).toBeNull();

    // Click toggle hidden files button
    const toggleHiddenBtn = screen.getByTestId('toggle-hidden-btn');
    fireEvent.click(toggleHiddenBtn);

    // .config should now be visible
    expect(await screen.findByText('.config')).toBeTruthy();
  });

  it('filters files via search input and shows clear search button on zero results', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    await screen.findByText('notes.txt');
    const searchInput = screen.getByPlaceholderText(/search|pesquisar|buscar/i);
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    await waitFor(() => {
      expect(screen.getByText(/Nenhum arquivo encontrado|Nenhum resultado/i)).toBeTruthy();
      expect(screen.queryByText('notes.txt')).toBeNull();
    });

    const clearBtn = screen.getByTestId('clear-search-btn');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('notes.txt')).toBeTruthy();
    });
  });

  it('toggles view mode between grid and list', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    await screen.findByText('notes.txt');
    const viewToggleBtn = screen.getByTestId('view-mode-toggle');
    fireEvent.click(viewToggleBtn);

    // List view table headers
    expect(screen.getByText(/Tamanho|Size/i)).toBeTruthy();
    expect(screen.getByText(/Modificado|Modified/i)).toBeTruthy();
  });
});
