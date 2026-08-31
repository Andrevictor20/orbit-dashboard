import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiskAnalyzer } from '../../pages/DiskAnalyzer';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

const mockStoragesResponse = {
  mounts: [
    { name: 'SSD NVMe', mount_point: '/', fs_type: 'ext4', total_bytes: 920000000000, used_bytes: 480000000000, available_bytes: 440000000000 },
    { name: 'Secondary HDD', mount_point: '/mnt/data', fs_type: 'ext4', total_bytes: 2000000000000, used_bytes: 500000000000, available_bytes: 1500000000000 },
  ]
};

const mockAnalyzeRootResponse = {
  path: '/',
  total_size: 480000000000,
  item_count: 5,
  items: [
    { name: 'var', path: '/var', is_dir: true, size: 280000000000, percentage: 58.3 },
    { name: 'usr', path: '/usr', is_dir: true, size: 120000000000, percentage: 25.0 },
    { name: 'home', path: '/home', is_dir: true, size: 60000000000, percentage: 12.5 },
    { name: 'boot', path: '/boot', is_dir: true, size: 1500000000, percentage: 0.3 },
    { name: 'swapfile', path: '/swapfile', is_dir: false, size: 4000000000, percentage: 0.8 },
  ]
};

const mockAnalyzeVarResponse = {
  path: '/var',
  total_size: 280000000000,
  item_count: 3,
  items: [
    { name: 'lib', path: '/var/lib', is_dir: true, size: 220000000000, percentage: 78.5 },
    { name: 'log', path: '/var/log', is_dir: true, size: 45000000000, percentage: 16.1 },
    { name: 'cache', path: '/var/cache', is_dir: true, size: 15000000000, percentage: 5.4 },
  ]
};

describe('DiskAnalyzer Page Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/files/storages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStoragesResponse),
        });
      }
      if (url.includes('/api/files/analyze')) {
        if (url.includes('path=%2Fvar') || url.includes('path=/var')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAnalyzeVarResponse),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAnalyzeRootResponse),
        });
      }
      if (url.includes('/api/docker/images/prune')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, space_reclaimed: 1024000 }),
        });
      }
      if (url.includes('/api/files/trash')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
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

  it('renders disk mounts, total size summary, and ncdu-style directory items', async () => {
    render(
      <BrowserRouter>
        <DiskAnalyzer />
      </BrowserRouter>
    );

    // Page title and mode badge
    expect(await screen.findByText('Analisador de Espaço em Disco')).toBeTruthy();
    expect(screen.getByText('ncdu-mode')).toBeTruthy();

    // Storage disks
    expect(await screen.findByText('SSD NVMe')).toBeTruthy();
    expect(screen.getByText(/HD Externo/i)).toBeTruthy();

    // Tree breakdown items
    expect(await screen.findByText('var')).toBeTruthy();
    expect(screen.getByText('usr')).toBeTruthy();
    expect(screen.getByText('home')).toBeTruthy();
    expect(screen.getByText('boot')).toBeTruthy();

    // Visual percentage
    expect(screen.getByText('58.3%')).toBeTruthy();
    expect(screen.getByText('25.0%')).toBeTruthy();
  });

  it('drills down into subdirectories upon folder click', async () => {
    render(
      <BrowserRouter>
        <DiskAnalyzer />
      </BrowserRouter>
    );

    // Click on 'var' folder row
    const varFolder = await screen.findByText('var');
    fireEvent.click(varFolder);

    // Should load /var subfolders (lib, log, cache)
    await waitFor(() => {
      expect(screen.getByText('lib')).toBeTruthy();
      expect(screen.getByText('log')).toBeTruthy();
      expect(screen.getByText('cache')).toBeTruthy();
    });
  });

  it('switches between tabs (ncdu tree, smart insights, safety guardrails)', async () => {
    render(
      <BrowserRouter>
        <DiskAnalyzer />
      </BrowserRouter>
    );

    await screen.findByText('Analisador de Espaço em Disco');

    // Switch to Insights tab
    const insightsTabBtn = screen.getByText(/Insights & Dicas/i);
    fireEvent.click(insightsTabBtn);

    expect(await screen.findByText('Imagens e Cache do Docker')).toBeTruthy();
    expect(screen.getByText('Logs Rotacionados & Journals')).toBeTruthy();
    expect(screen.getByText('Caches de Pacotes (APT / npm / pip)')).toBeTruthy();

    // Switch to Safety tab
    const safetyTabBtn = screen.getByText(/O que NÃO Mexer/i);
    fireEvent.click(safetyTabBtn);

    expect(await screen.findByText(/Atenção Máxima: Diretórios Fundamentais do Sistema Linux/i)).toBeTruthy();
    expect(screen.getByText('/var/lib/docker/overlay2')).toBeTruthy();
    expect(screen.getByText('/boot')).toBeTruthy();
    expect(screen.getByText('/etc')).toBeTruthy();
  });
});
