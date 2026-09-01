import { render, screen } from '@testing-library/react';
import { Metrics } from '../../pages/Metrics';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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

vi.mock('../../contexts/StatsContext', () => ({
  useStats: vi.fn(),
  StatsProvider: ({ children }: any) => children,
}));

vi.mock('../../components/metrics/AlertsPanel', () => ({ AlertsPanel: () => <div data-testid='alerts-mock'>Alerts</div> })); vi.mock('../../components/metrics/ProcessMonitor', () => ({
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
});
