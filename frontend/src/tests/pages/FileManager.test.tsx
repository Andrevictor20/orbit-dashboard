import { render, screen, fireEvent } from '@testing-library/react';
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
  current_path: '/DATA',
  items: [
    { name: 'Documents', path: '/DATA/Documents', is_dir: true, size: 4096, modified: '2026-08-22T10:00:00Z', extension: '' },
    { name: 'Media', path: '/DATA/Media', is_dir: true, size: 4096, modified: '2026-08-22T10:00:00Z', extension: '' },
    { name: 'notes.txt', path: '/DATA/notes.txt', is_dir: false, size: 1024, modified: '2026-08-22T10:05:00Z', extension: 'txt' },
    { name: 'sample.mp3', path: '/DATA/sample.mp3', is_dir: false, size: 5242880, modified: '2026-08-22T10:10:00Z', extension: 'mp3' },
    { name: 'video.mkv', path: '/DATA/video.mkv', is_dir: false, size: 104857600, modified: '2026-08-22T10:15:00Z', extension: 'mkv' },
    { name: 'document.pdf', path: '/DATA/document.pdf', is_dir: false, size: 2097152, modified: '2026-08-22T10:20:00Z', extension: 'pdf' },
  ],
  total_items: 6
};

const mockStoragesResponse = {
  mounts: [
    { name: 'Root', mount_point: '/', fs_type: 'ext4', total_bytes: 100000000000, used_bytes: 40000000000, available_bytes: 60000000000 },
    { name: 'HD5TB', mount_point: '/mnt/HD5TB', fs_type: 'ext4', total_bytes: 5000000000000, used_bytes: 2500000000000, available_bytes: 2500000000000 }
  ]
};

const mockShortcutsResponse = {
  root: '/',
  data: '/DATA',
  documents: '/DATA/Documents',
  downloads: '/DATA/Downloads',
  gallery: '/DATA/Gallery',
  media: '/DATA/Media'
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

  it('renders sidebar with system shortcuts and mounted storages', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    // Sidebar shortcuts
    expect((await screen.findAllByText('Root'))[0]).toBeTruthy();
    expect((await screen.findAllByText('DATA'))[0]).toBeTruthy();
    expect((await screen.findAllByText('Documents'))[0]).toBeTruthy();
    expect((await screen.findAllByText('Downloads'))[0]).toBeTruthy();
    expect((await screen.findAllByText('Gallery'))[0]).toBeTruthy();
    expect((await screen.findAllByText('Media'))[0]).toBeTruthy();

    // Mounted disks section
    expect(await screen.findByText('HD5TB')).toBeTruthy();
  });

  it('renders files and directories in grid and list view', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    expect((await screen.findAllByText('Documents'))[0]).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();
    expect(screen.getByText('sample.mp3')).toBeTruthy();
    expect(screen.getByText('video.mkv')).toBeTruthy();
    expect(screen.getByText('document.pdf')).toBeTruthy();
  });

  it('filters files via search input', async () => {
    render(
      <BrowserRouter>
        <FileManager />
      </BrowserRouter>
    );

    await screen.findByText('notes.txt');
    const searchInput = screen.getByPlaceholderText(/search|pesquisar|buscar/i);
    fireEvent.change(searchInput, { target: { value: 'video' } });

    expect(screen.getByText('video.mkv')).toBeTruthy();
    expect(screen.queryByText('notes.txt')).toBeNull();
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
