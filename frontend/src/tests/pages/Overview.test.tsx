import { render, screen } from '@testing-library/react';
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

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

    render(<Overview />);
    
    // Check titles
    expect(screen.getByText('dashboard.title')).toBeTruthy();
    expect(screen.getByText('dashboard.disconnected')).toBeTruthy();
    
    // Check default zeros
    expect(screen.getAllByText('0.0%').length).toBeGreaterThan(0); // CPU and Memory
    expect(screen.getAllByText('0.00 GB').length).toBeGreaterThan(0); // Memory and Disks
  });

  it('renders correct stats when connected', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 25.5,
        memory_used: 1024 * 1024 * 1024, // 1 GB
        memory_total: 4 * 1024 * 1024 * 1024, // 4 GB
        temperature: 45.0,
        network_tx: 10 * 1024 * 1024, // 10 MB
        network_rx: 20 * 1024 * 1024, // 20 MB
        disks: [
          { name: '/dev/sda1', mount_point: '/', used: 50 * 1024 * 1024 * 1024, total: 100 * 1024 * 1024 * 1024 }
        ]
      },
      isConnected: true
    });

    render(<Overview />);
    
    expect(screen.getByText('dashboard.connected')).toBeTruthy();
    expect(screen.getByText('25.5%')).toBeTruthy(); // CPU
    expect(screen.getByText('45.0°C')).toBeTruthy(); // Temp
    expect(screen.getByText('1.00 GB')).toBeTruthy(); // Mem used
    expect(screen.getByText(/4.00 GB/)).toBeTruthy(); // Mem total
    expect(screen.getByText('10.0 MB')).toBeTruthy(); // TX
    expect(screen.getByText('20.0 MB')).toBeTruthy(); // RX
    
    // Disk info
    expect(screen.getByText('/dev/sda1')).toBeTruthy();
    expect(screen.getByText('/')).toBeTruthy();
    expect(screen.getByText('50.00 GB usado')).toBeTruthy();
  });
});
