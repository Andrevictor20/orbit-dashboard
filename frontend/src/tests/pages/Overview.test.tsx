import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Overview } from '../../pages/Overview';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock recharts to avoid ResizeObserver issues in JSDOM
vi.mock('recharts', () => {
  const Original = vi.importActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    AreaChart: ({ children }: any) => <div>{children}</div>,
    Area: () => <div>Area</div>,
    XAxis: () => <div>XAxis</div>,
    YAxis: () => <div>YAxis</div>,
    CartesianGrid: () => <div>CartesianGrid</div>,
    Tooltip: () => <div>Tooltip</div>,
    defs: ({ children }: any) => <div data-testid="defs">{children}</div>,
    linearGradient: ({ children }: any) => <div data-testid="linearGradient">{children}</div>,
    stop: () => <div data-testid="stop" />
  };
});

// Mock StatsContext (Overview now uses useStats, not useWebSocket directly)
vi.mock('../../contexts/StatsContext', () => ({
  useStats: vi.fn(),
  StatsProvider: ({ children }: any) => children,
}));

import { useStats } from '../../contexts/StatsContext';

describe('Overview Component', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading or disconnected state when stats are missing', () => {
    (useStats as any).mockReturnValue({
      stats: null,
      isConnected: false
    });

    render(
      <BrowserRouter>
        <Overview />
      </BrowserRouter>
    );
    
    // Check titles
    expect(screen.getByText('Orbit Dashboard')).toBeTruthy();
    expect(screen.getByText('Desconectado')).toBeTruthy();
    
    // Check default zeros
    expect(screen.getAllByText('0.0%').length).toBeGreaterThan(0); // CPU and Memory
    expect(screen.getAllByText('0.00 GB').length).toBeGreaterThan(0); // Memory and Disks
  });

  it('renders correct stats and only physical storage without raw path clutter', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 25.5,
        memory_used: 1024 * 1024 * 1024, // 1 GB
        memory_total: 4 * 1024 * 1024 * 1024, // 4 GB
        temperature: 45.0,
        network_tx: 10 * 1024 * 1024, // 10 MB/s
        network_rx: 20 * 1024 * 1024, // 20 MB/s
        network_interface: 'eth0',
        network_interface_type: 'ethernet',
        disks: [
          { name: '/dev/sda1', mount_point: '/', used: 50 * 1024 * 1024 * 1024, total: 100 * 1024 * 1024 * 1024 },
          { name: 'securityfs', mount_point: '/sys/kernel/security', used: 0, total: 0 },
          { name: 'efivarfs', mount_point: '/sys/firmware/efi/efivars', used: 0, total: 0 }
        ]
      },
      isConnected: true
    });

    render(
      <BrowserRouter>
        <Overview />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('25.5%')).toBeTruthy(); // CPU
    expect(screen.getByText('45.0°C')).toBeTruthy(); // Temp
    expect(screen.getByText('1.00 GB')).toBeTruthy(); // Mem used
    expect(screen.getByText(/4.00 GB/)).toBeTruthy(); // Mem total
    expect(screen.getByText('eth0')).toBeTruthy(); // Network interface badge
    expect(screen.getByText('10.0 MB/s')).toBeTruthy(); // TX speed
    expect(screen.getByText('20.0 MB/s')).toBeTruthy(); // RX speed
    
    // Physical disk name displayed
    expect(screen.getByText('SSD / HD Principal')).toBeTruthy();
    expect(screen.getByText('50.00 GB usado')).toBeTruthy();

    // Pseudo filesystems MUST NOT be rendered
    expect(screen.queryByText('securityfs')).toBeNull();
    expect(screen.queryByText('efivarfs')).toBeNull();
  });

  it('consolidates stack containers into one card and opens sub-containers modal on click', async () => {
    (useStats as any).mockReturnValue({
      stats: null,
      isConnected: true,
    });

    const mockContainers = [
      { id: 'c1', name: 'orbit', image: 'orbit:latest', state: 'running', status: 'Up 1 day' },
      { id: 'c2', name: 'overseerr', image: 'overseerr:latest', state: 'running', status: 'Up 1 day' },
      { id: 'as1', name: 'ar-saude-coletor', image: 'coletor:latest', state: 'running', status: 'Up 1 day', labels: { 'com.docker.compose.project': 'ar-saude' } },
      { id: 'as2', name: 'ar-saude-frontend', image: 'frontend:latest', state: 'running', status: 'Up 1 day', labels: { 'com.docker.compose.project': 'ar-saude' } },
      { id: 'as3', name: 'ar-saude-postgres', image: 'postgres:16', state: 'running', status: 'Up 1 day', labels: { 'com.docker.compose.project': 'ar-saude' } },
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/docker/containers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockContainers)
        });
      }
      if (url === '/api/docker/links') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    const { findByText } = render(
      <BrowserRouter>
        <Overview />
      </BrowserRouter>
    );

    // Ar Saude should appear as a single consolidated group
    const groupCard = await findByText('Ar Saude');
    expect(groupCard).toBeTruthy();
    expect(await findByText('3/3 ativos')).toBeTruthy();

    // Individual sub-containers shouldn't be scattered on the overview grid
    expect(screen.queryByText('ar-saude-coletor')).toBeNull();

    // Clicking on Ar Saude opens the modal with sub-containers
    groupCard.click();

    expect(await findByText('Sub-containers do Grupo (3)')).toBeTruthy();
    expect(screen.getByText('ar-saude-coletor')).toBeTruthy();
    expect(screen.getByText('ar-saude-frontend')).toBeTruthy();
    expect(screen.getByText('ar-saude-postgres')).toBeTruthy();
  });

  it('renders multiple storage drives separately (SSDs, HDs and microSD) instead of a unified single bar', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 12.0,
        memory_used: 2 * 1024 * 1024 * 1024,
        memory_total: 8 * 1024 * 1024 * 1024,
        temperature: 40.0,
        network_tx: 1024 * 1024,
        network_rx: 2048 * 1024,
        disks: [
          { name: '/dev/nvme0n1p1', mount_point: '/', used: 120 * 1024 * 1024 * 1024, total: 500 * 1024 * 1024 * 1024 },
          { name: '/dev/sda1', mount_point: '/mnt/media_hd', used: 2048 * 1024 * 1024 * 1024, total: 4096 * 1024 * 1024 * 1024 },
          { name: '/dev/mmcblk0p1', mount_point: '/media/sdcard', used: 16 * 1024 * 1024 * 1024, total: 64 * 1024 * 1024 * 1024 },
        ]
      },
      isConnected: true
    });

    render(
      <BrowserRouter>
        <Overview />
      </BrowserRouter>
    );

    // Badge showing drive count
    expect(screen.getByText('3 unidades')).toBeTruthy();

    // All distinct drives rendered separately
    expect(screen.getByText('SSD NVMe')).toBeTruthy();
    expect(screen.getByText('HD Externo (media_hd)')).toBeTruthy();
    expect(screen.getByText('Cartão microSD')).toBeTruthy();

    // Drive type labels
    expect(screen.getByText('NVMe')).toBeTruthy();
    expect(screen.getByText('HD Externo')).toBeTruthy();
    expect(screen.getByText('microSD')).toBeTruthy();

    // Individual usage numbers
    expect(screen.getAllByText(/120\.00 GB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\.00 TB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/16\.00 GB/).length).toBeGreaterThan(0);
  });
});

