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
      history: [],
      isConnected: false
    });

    render(<Metrics />);
    
    // Check titles
    expect(screen.getByText('Métricas do Sistema')).toBeTruthy();
    expect(screen.getByText('Desconectado')).toBeTruthy();
    
    // Check panels exist
    expect(screen.getByText(/CPU/i)).toBeTruthy();
    expect(screen.getByText(/Memória/i)).toBeTruthy();
    expect(screen.getByText(/Rede/i)).toBeTruthy();
  });

  it('renders connected state', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 25.5,
        docker_cpu: 10.0,
        orbit_cpu: 1.25,
        memory_used: 1024 * 1024 * 1024, // 1 GB
        docker_memory: 512 * 1024 * 1024, // 512 MB
        orbit_memory: 64 * 1024 * 1024, // 64 MB
        memory_total: 4 * 1024 * 1024 * 1024, // 4 GB
        temperature: 45.0,
        network_tx: 10 * 1024 * 1024, // 10 MB
        network_rx: 20 * 1024 * 1024, // 20 MB
        docker_tx: 5 * 1024 * 1024,
        docker_rx: 8 * 1024 * 1024,
        disks: []
      },
      history: [
        { time: '12:00:00', timestamp: Date.now(), cpu: 20, dockerCpu: 10, orbitCpu: 1, memory: 1000, dockerMemory: 500, orbitMemory: 60, tx: 0, rx: 0, dockerTx: 0, dockerRx: 0 },
        { time: '12:00:02', timestamp: Date.now(), cpu: 25, dockerCpu: 10, orbitCpu: 1.25, memory: 1024, dockerMemory: 512, orbitMemory: 64, tx: 0, rx: 0, dockerTx: 0, dockerRx: 0 }
      ],
      isConnected: true
    });

    render(<Metrics />);
    
    expect(screen.getByText('Ao vivo')).toBeTruthy();
  });

  it('renders time range buttons and allows changing time range', () => {
    (useStats as any).mockReturnValue({
      stats: null,
      history: [],
      isConnected: true
    });

    render(<Metrics />);

    expect(screen.getByText('1 min')).toBeTruthy();
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('1 hora')).toBeTruthy();

    fireEvent.click(screen.getByText('15 min'));
    expect(screen.getByText('15 min').className).toContain('bg-accent');
  });

  it('switches to Orbit tab and renders consolidated consumption info', () => {
    (useStats as any).mockReturnValue({
      stats: {
        cpu_usage: 25.5,
        docker_cpu: 10.0,
        orbit_cpu: 2.34,
        memory_used: 1024 * 1024 * 1024,
        docker_memory: 512 * 1024 * 1024,
        orbit_memory: 75 * 1024 * 1024, // 75 MB
        memory_total: 4 * 1024 * 1024 * 1024,
        temperature: 45.0,
        network_tx: 0,
        network_rx: 0,
        docker_tx: 0,
        docker_rx: 0,
        disks: []
      },
      history: [],
      isConnected: true
    });

    render(<Metrics />);

    const orbitTabBtn = screen.getByRole('button', { name: /Orbit/i });
    fireEvent.click(orbitTabBtn);

    expect(screen.getByText('Consumo Orbit (Backend + Frontend)')).toBeTruthy();
    expect(screen.getByText('2.34%')).toBeTruthy();
    expect(screen.getByText('75 MB')).toBeTruthy();
  });

  it('switches to Processos tab when button is clicked', () => {
    (useStats as any).mockReturnValue({
      stats: null,
      history: [],
      isConnected: true
    });

    render(<Metrics />);

    const processesTabBtn = screen.getByRole('button', { name: /Processos/i });
    expect(processesTabBtn).toBeTruthy();

    fireEvent.click(processesTabBtn);

    expect(screen.getByTestId('process-monitor-mock')).toBeTruthy();
  });
});
