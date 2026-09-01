import { render, screen } from '@testing-library/react';
import { AlertsPanel } from './AlertsPanel';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../../contexts/AlertsContext', () => ({
  useAlerts: vi.fn()
}));
import { useAlerts } from '../../contexts/AlertsContext';

describe('AlertsPanel', () => {
  it('renders healthy state when no alerts exist', () => {
    (useAlerts as any).mockReturnValue({ alerts: [], loading: false, error: null });
    render(<AlertsPanel />);
    expect(screen.getByText('Sistemas Estáveis')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma anomalia registrada nas últimas 24h.')).toBeInTheDocument();
  });

  it('renders warning alert correctly', () => {
    const mockAlerts = [{
      id: '1',
      timestamp: Date.now(),
      level: 'warning',
      title: 'Alta Temperatura',
      message: 'A temperatura do host atingiu 82°C.',
      source: 'metrics'
    }];
    (useAlerts as any).mockReturnValue({ alerts: mockAlerts, loading: false, error: null });
    render(<AlertsPanel />);
    expect(screen.getByText('Alta Temperatura')).toBeInTheDocument();
    expect(screen.getByText('A temperatura do host atingiu 82°C.')).toBeInTheDocument();
  });

  it('renders critical alert correctly', () => {
    const mockAlerts = [{
      id: '2',
      timestamp: Date.now(),
      level: 'critical',
      title: 'Alto Consumo de RAM',
      message: 'O uso de memória RAM está em 95%.',
      source: 'metrics'
    }];
    (useAlerts as any).mockReturnValue({ alerts: mockAlerts, loading: false, error: null });
    render(<AlertsPanel />);
    expect(screen.getByText('Alto Consumo de RAM')).toBeInTheDocument();
    expect(screen.getByText('O uso de memória RAM está em 95%.')).toBeInTheDocument();
  });
});
