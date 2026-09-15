import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OverviewTelemetryCards } from '../../components/dashboard/OverviewTelemetryCards';

// Mock fetch for /api/system/processes
const mockProcesses = [
  {
    pid: 2057696,
    name: 'python3',
    cmd: ['python3', '-m', 'homeassistant'],
    cpu_usage: 1.6,
    memory_rss: 1850000000,
    memory_vms: 2000000000,
    memory_percent: 24.2,
    status: 'sleeping',
    container_name: 'homeassistant',
    container_id: 'd717f918239a',
    start_time: 0,
    disk_read_bytes: 0,
    disk_written_bytes: 0,
  },
  {
    pid: 10716,
    name: 'Kavita',
    cmd: ['./Kavita'],
    cpu_usage: 0.8,
    memory_rss: 431600000,
    memory_vms: 500000000,
    memory_percent: 5.5,
    status: 'sleeping',
    container_name: 'linuxserver-kavita',
    start_time: 0,
    disk_read_bytes: 0,
    disk_written_bytes: 0,
  },
];

const mockContainers = [
  {
    id: 'd717f918239a',
    name: '/homeassistant',
    image: 'ghcr.io/home-assistant/home-assistant:stable',
  },
  {
    id: 'a1b2c3d4e5f6',
    name: '/linuxserver-kavita',
    image: 'linuxserver/kavita:latest',
  },
];

describe('OverviewTelemetryCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/system/processes') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ processes: mockProcesses }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      })
    );
  });

  const defaultProps = {
    cpuPercent: '25.5',
    tempC: '45.0',
    memoryUsedGB: '4.64',
    memoryTotalGB: '7.64',
    memoryPercent: '60.8',
    netTxSpeed: '10.0 MB/s',
    netRxSpeed: '20.0 MB/s',
    containers: mockContainers,
    runningContainersCount: 2,
    uniqueDisks: [],
    diskPercent: '40.0',
    diskUsedFormatted: '40 GB',
    diskTotalFormatted: '100 GB',
    cpuHistory: [10, 20, 25],
    ramHistory: [50, 55, 60],
    netRxHistory: [5, 10, 20],
    netTxHistory: [2, 5, 10],
    isConnected: true,
    stats: {
      gpu_usage: 12.0,
      gpu_temperature: 42.0,
      network_interface: 'eth0',
      network_interface_type: 'ethernet',
    },
  };

  it('renders default gauge view for CPU and RAM', () => {
    render(
      <BrowserRouter>
        <OverviewTelemetryCards {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Uso de CPU')).toBeTruthy();
    expect(screen.getByText('25.5%')).toBeTruthy();
    expect(screen.getByText('45.0°C')).toBeTruthy();
    expect(screen.getByText('Memória RAM')).toBeTruthy();
    expect(screen.getByText('4.64 GB')).toBeTruthy();
  });

  it('switches CPU card to Top 5 view inside the card upon clicking Top 5 button', async () => {
    render(
      <BrowserRouter>
        <OverviewTelemetryCards {...defaultProps} />
      </BrowserRouter>
    );

    // Find the Top 5 CPU button
    const top5Buttons = screen.getAllByRole('button', { name: /top 5/i });
    expect(top5Buttons.length).toBeGreaterThanOrEqual(2);

    // Click CPU Top 5 button (first one)
    fireEvent.click(top5Buttons[0]);

    // Should display Top 5 header inside CPU card
    await waitFor(() => {
      expect(screen.getByText('Top 5 Processos (CPU)')).toBeTruthy();
    });

    // Verify Home Assistant is resolved as displayName instead of pure python3
    await waitFor(() => {
      expect(screen.getByText('Home Assistant')).toBeTruthy();
      expect(screen.getByText(/python3 • PID 2057696/)).toBeTruthy();
    });

    // RAM card should still remain in gauge view
    expect(screen.getByText('Memória RAM')).toBeTruthy();
    expect(screen.getByText('4.64 GB')).toBeTruthy();

    // Click Back button to return to gauge view
    const backBtn = screen.getByRole('button', { name: /voltar/i });
    fireEvent.click(backBtn);

    // Verify CPU card is back to gauge view
    expect(screen.getByText('Uso de CPU')).toBeTruthy();
    expect(screen.getByText('25.5%')).toBeTruthy();
  });

  it('switches RAM card to Top 5 view inside the card upon clicking RAM Top 5 button', async () => {
    render(
      <BrowserRouter>
        <OverviewTelemetryCards {...defaultProps} />
      </BrowserRouter>
    );

    const top5Buttons = screen.getAllByRole('button', { name: /top 5/i });
    // Click RAM Top 5 button (second one)
    fireEvent.click(top5Buttons[1]);

    await waitFor(() => {
      expect(screen.getByText('Top 5 Processos (RAM)')).toBeTruthy();
    });

    // Should display resolved apps
    await waitFor(() => {
      expect(screen.getByText('Home Assistant')).toBeTruthy();
      expect(screen.getByText('Kavita')).toBeTruthy();
    });

    // CPU card should still remain in gauge view
    expect(screen.getByText('Uso de CPU')).toBeTruthy();
    expect(screen.getByText('25.5%')).toBeTruthy();
  });
});
