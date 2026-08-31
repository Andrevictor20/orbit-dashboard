import { render, screen, fireEvent } from '@testing-library/react';
import { Metrics } from '../../pages/Metrics';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock recharts
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

// Mock StatsContext (Metrics now uses useStats, not useWebSocket directly)
vi.mock('../../contexts/StatsContext', () => ({
  useStats: vi.fn(),
  StatsProvider: ({ children }: any) => children,
}));

// Mock ProcessMonitor inside Metrics tests
vi.mock('../../components/metrics/ProcessMonitor', () => ({
  ProcessMonitor: () => <div data-testid="process-monitor-mock">Process Monitor View</div>
}));

import { useStats } from '../../contexts/StatsContext';

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
      isConnected: false
    });

    render(<Metrics />);
    
    // Check titles
    expect(screen.getByText('Métricas do Sistema')).toBeTruthy();
    expect(screen.getByText('Desconectado')).toBeTruthy();
    
    // Check panels exist
    expect(screen.getByText(/Evolução de CPU/)).toBeTruthy();
    expect(screen.getByText(/Evolução de Memória/)).toBeTruthy();
    expect(screen.getByText(/Tráfego de Rede/)).toBeTruthy();
  });

  it('renders connected state', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 25.5,
        docker_cpu: 10.0,
        memory_used: 1024 * 1024 * 1024, // 1 GB
        docker_memory: 512 * 1024 * 1024, // 512 MB
        memory_total: 4 * 1024 * 1024 * 1024, // 4 GB
        temperature: 45.0,
        network_tx: 10 * 1024 * 1024, // 10 MB
        network_rx: 20 * 1024 * 1024, // 20 MB
        docker_tx: 5 * 1024 * 1024,
        docker_rx: 8 * 1024 * 1024,
        disks: []
      },
      isConnected: true
    });

    render(<Metrics />);
    
    expect(screen.getByText('Real-time')).toBeTruthy();
  });

  it('switches to Processos tab when button is clicked', () => {
    (useStats as any).mockReturnValue({
      stats: null,
      isConnected: true
    });

    render(<Metrics />);

    const processesTabBtn = screen.getByText('Processos');
    expect(processesTabBtn).toBeTruthy();

    fireEvent.click(processesTabBtn);

    expect(screen.getByTestId('process-monitor-mock')).toBeTruthy();
  });
});
