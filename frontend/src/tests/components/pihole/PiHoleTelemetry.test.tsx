import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PiHoleTopClients } from '../../../components/pihole/PiHoleTopClients';
import { PiHoleNetworkAnalytics } from '../../../components/pihole/PiHoleNetworkAnalytics';
import { PiHoleRecentQueries } from '../../../components/pihole/PiHoleRecentQueries';

describe('PiHole Telemetry Components', () => {
  it('renders PiHoleTopClients with client items and empty state', () => {
    // 1. Empty state
    const { rerender } = render(<PiHoleTopClients clients={[]} loading={false} />);
    expect(screen.getByText(/Nenhum dado registrado/i)).toBeTruthy();

    // 2. Populated state
    const clients = [
      { ip: '192.168.1.50', name: 'Desktop-PC', count: 1500, percentage: 50.0 },
      { ip: '192.168.1.100', name: 'iPhone-User', count: 900, percentage: 30.0 },
    ];
    rerender(<PiHoleTopClients clients={clients} loading={false} />);
    expect(screen.getByText('Desktop-PC')).toBeTruthy();
    expect(screen.getByText('192.168.1.50')).toBeTruthy();
    expect(screen.getByText('1.500')).toBeTruthy();
    expect(screen.getByText('(50.0%)')).toBeTruthy();
    expect(screen.getByText('iPhone-User')).toBeTruthy();
  });

  it('renders PiHoleNetworkAnalytics with query types and upstream servers', () => {
    const queryTypes = { A: 1000, AAAA: 400, HTTPS: 200 };
    const upstreams = [
      { destination: '1.1.1.1', name: 'Cloudflare DNS', count: 1200, percentage: 80.0 },
      { destination: '8.8.8.8', name: 'Google DNS', count: 300, percentage: 20.0 },
    ];

    render(
      <PiHoleNetworkAnalytics
        queryTypes={queryTypes}
        upstreams={upstreams}
        loading={false}
      />
    );

    expect(screen.getByText('Cloudflare DNS')).toBeTruthy();
    expect(screen.getByText('80.0%')).toBeTruthy();
    expect(screen.getByText('Google DNS')).toBeTruthy();
    expect(screen.getByText('20.0%')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('AAAA')).toBeTruthy();
    expect(screen.getByText('HTTPS')).toBeTruthy();
  });

  it('renders PiHoleRecentQueries and triggers whitelist/blacklist actions', async () => {
    const onAddDomain = vi.fn().mockResolvedValue(undefined);
    const queries = [
      {
        timestamp: 1726000000,
        time: '18:30:00',
        query_type: 'A',
        domain: 'track.adserver.com',
        client: '192.168.1.50',
        status: 'blocked',
      },
      {
        timestamp: 1726000010,
        time: '18:30:10',
        query_type: 'A',
        domain: 'cdn.github.com',
        client: '192.168.1.50',
        status: 'forwarded',
      },
    ];

    render(
      <PiHoleRecentQueries
        queries={queries}
        onAddDomain={onAddDomain}
        loading={false}
      />
    );

    expect(screen.getByText('track.adserver.com')).toBeTruthy();
    expect(screen.getByText('cdn.github.com')).toBeTruthy();
    expect(screen.getByText('Bloqueado')).toBeTruthy();
    expect(screen.getByText('Permitido')).toBeTruthy();

    // Whitelist action on blocked query
    const allowBtn = screen.getByRole('button', { name: /Permitir/i });
    await act(async () => {
      fireEvent.click(allowBtn);
    });
    expect(onAddDomain).toHaveBeenCalledWith('track.adserver.com', 'white');

    // Blacklist action on forwarded query
    const blockBtn = screen.getByRole('button', { name: /Bloquear/i });
    await act(async () => {
      fireEvent.click(blockBtn);
    });
    expect(onAddDomain).toHaveBeenCalledWith('cdn.github.com', 'black');
  });
});
