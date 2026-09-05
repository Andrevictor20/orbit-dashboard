import { render, screen, fireEvent } from '@testing-library/react';
import { Metrics } from '../../pages/Metrics';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    Area: (props: any) => (
      <div 
        data-testid={`area-${props.dataKey}`} 
        data-name={props.name}
        data-stroke={props.stroke}
      />
    ),
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
  };
});

vi.mock('../../contexts/StatsContext', () => ({
  useStats: vi.fn(),
  StatsProvider: ({ children }: any) => children,
}));

vi.mock('../../components/metrics/AlertsPanel', () => ({ 
  AlertsPanel: () => <div data-testid="alerts-mock">Alerts</div> 
}));

vi.mock('../../components/metrics/ProcessMonitor', () => ({
  ProcessMonitor: () => <div data-testid="process-monitor-mock">Process Monitor View</div>
}));

import { useStats } from '../../contexts/StatsContext';
import { MemoryRouter } from 'react-router-dom';

describe('Metrics Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders disconnected state when stats are missing', () => {
    (useStats as any).mockReturnValue({
      stats: null,
      history: [],
      isConnected: false
    });

    render(<MemoryRouter><Metrics /></MemoryRouter>);
    expect(screen.getByText('Métricas do Sistema')).toBeTruthy();
  });

  it('renders both Host and Containers network monitoring with live rates and area series', async () => {
    const mockStats = {
      cpu_usage: 12.5,
      memory_used: 4 * 1024 * 1024 * 1024,
      memory_total: 16 * 1024 * 1024 * 1024,
      disks: [],
      network_tx: 512 * 1024, // 512 KB/s
      network_rx: 1024 * 1024, // 1 MB/s
      temperature: 45.0,
      docker_cpu: 8.0,
      docker_memory: 2 * 1024 * 1024 * 1024,
      docker_tx: 256 * 1024, // 256 KB/s
      docker_rx: 200 * 1024, // 200 KB/s
      orbit_cpu: 0.5,
      orbit_memory: 50 * 1024 * 1024,
      network_interface: 'eth0',
      network_interface_type: 'ethernet',
    };

    const mockHistory = [
      {
        time: '12:00:00',
        timestamp: Date.now() - 1000,
        cpu: 12.5,
        dockerCpu: 8.0,
        orbitCpu: 0.5,
        memory: 4000000000,
        dockerMemory: 2000000000,
        orbitMemory: 50000000,
        tx: 512 * 1024,
        rx: 1024 * 1024,
        dockerTx: 256 * 1024,
        dockerRx: 200 * 1024,
      }
    ];

    (useStats as any).mockReturnValue({
      stats: mockStats,
      history: mockHistory,
      isConnected: true
    });

    render(<MemoryRouter><Metrics /></MemoryRouter>);

    // Verify network interface badge is present
    expect(screen.getByText(/eth0/i)).toBeTruthy();

    // Verify both Host and Containers areas are rendered
    const hostRxArea = screen.getByTestId('area-rx');
    const hostTxArea = screen.getByTestId('area-tx');
    const dockerRxArea = screen.getByTestId('area-dockerRx');
    const dockerTxArea = screen.getByTestId('area-dockerTx');

    expect(hostRxArea).toBeTruthy();
    expect(hostRxArea.getAttribute('data-name')).toBe('Host Download');
    expect(hostTxArea.getAttribute('data-name')).toBe('Host Upload');
    expect(dockerRxArea.getAttribute('data-name')).toBe('Containers Download');
    expect(dockerTxArea.getAttribute('data-name')).toBe('Containers Upload');

    // In 'overview' tab, all series have non-transparent stroke
    expect(hostRxArea.getAttribute('data-stroke')).toBe('#38bdf8');
    expect(hostTxArea.getAttribute('data-stroke')).toBe('#818cf8');
    expect(dockerRxArea.getAttribute('data-stroke')).toBe('#fb923c');
    expect(dockerTxArea.getAttribute('data-stroke')).toBe('#f43f5e');

    // Verify live rate labels in header
    expect(screen.getByText('Host:')).toBeTruthy();
    expect(screen.getByText('Containers:')).toBeTruthy();

    // Switch to 'Host' tab
    const hostTabButton = screen.getByRole('button', { name: /host/i });
    fireEvent.click(hostTabButton);

    // In 'system' tab, Host areas remain visible, while Containers areas become transparent
    expect(screen.getByTestId('area-rx').getAttribute('data-stroke')).toBe('#38bdf8');
    expect(screen.getByTestId('area-tx').getAttribute('data-stroke')).toBe('#818cf8');
    expect(screen.getByTestId('area-dockerRx').getAttribute('data-stroke')).toBe('transparent');
    expect(screen.getByTestId('area-dockerTx').getAttribute('data-stroke')).toBe('transparent');
  });
});
