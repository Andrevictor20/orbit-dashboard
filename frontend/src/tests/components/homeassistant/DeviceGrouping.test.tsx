import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { groupAllDevices } from '../../../components/homeassistant/haUtils';
import { DeviceGroupCard } from '../../../components/homeassistant/DeviceGroupCard';
import { DeviceDetailModal } from '../../../components/homeassistant/DeviceDetailModal';
import type { HAEntity, HADeviceGroup } from '../../../components/homeassistant/types';

describe('Home Assistant Device Grouping & Detail Modal', () => {
  const mockEntities: HAEntity[] = [
    // Huawei IGD
    {
      entity_id: 'binary_sensor.huawei_igd_status_wan',
      state: 'detected',
      attributes: { friendly_name: 'Huawei IGD Status WAN' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    {
      entity_id: 'sensor.huawei_igd_external_ip',
      state: '100.66.248.105',
      attributes: { friendly_name: 'Huawei IGD External IP' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    {
      entity_id: 'sensor.huawei_igd_sent_kib_s',
      state: '4.11',
      attributes: { friendly_name: 'Huawei IGD Sent KiB/s', unit_of_measurement: 'KiB/s' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    // Backups
    {
      entity_id: 'event.backup_automatic_backup',
      state: 'unknown',
      attributes: { friendly_name: 'Backup Automatic backup' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    {
      entity_id: 'sensor.backup_manager_state',
      state: 'idle',
      attributes: { friendly_name: 'Backup Backup Manager state' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    // Solar
    {
      entity_id: 'sun.sun',
      state: 'below_horizon',
      attributes: { friendly_name: 'Sun' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    {
      entity_id: 'sensor.sun_next_dawn',
      state: '2026-09-05T08:32:29+00:00',
      attributes: { friendly_name: 'Sun Next Dawn' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    // Light
    {
      entity_id: 'light.sala_principal',
      state: 'on',
      attributes: { friendly_name: 'Luz da Sala', brightness: 255 },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
    {
      entity_id: 'sensor.sala_consumo_w',
      state: '12.5',
      attributes: { friendly_name: 'Consumo Luz Sala', unit_of_measurement: 'W' },
      last_changed: '2026-09-04T20:00:00Z',
      last_updated: '2026-09-04T20:00:00Z',
    },
  ];

  it('agrupa entidades em dispositivos consolidados sem deixar entidades desorganizadas', () => {
    const groups = groupAllDevices(mockEntities);

    // Deve agrupar em Roteador Huawei, Backups, Ciclo Solar e Luz da Sala
    expect(groups.length).toBeGreaterThanOrEqual(4);

    const huawei = groups.find((g) => g.id === 'huawei_igd_router');
    expect(huawei).toBeDefined();
    expect(huawei?.name).toBe('Roteador Huawei IGD');
    expect(huawei?.category).toBe('network');
    expect(huawei?.entities.length).toBe(3);

    const backups = groups.find((g) => g.id === 'system_backups');
    expect(backups).toBeDefined();
    expect(backups?.name).toBe('Backups do Sistema');
    expect(backups?.entities.length).toBe(2);

    const solar = groups.find((g) => g.id === 'sun_astronomy');
    expect(solar).toBeDefined();
    expect(solar?.category).toBe('system');
    expect(solar?.entities.length).toBe(2);

    const light = groups.find((g) => g.primaryEntity.entity_id === 'light.sala_principal');
    expect(light).toBeDefined();
    expect(light?.category).toBe('light');
  });

  it('renderiza o DeviceGroupCard com contagem de entidades e suporta clique para detalhes', () => {
    const device: HADeviceGroup = {
      id: 'huawei_network',
      name: 'Roteador Huawei IGD',
      category: 'network',
      primaryEntity: mockEntities[0],
      entities: [mockEntities[0], mockEntities[1], mockEntities[2]],
      summary: 'WAN: Online • 100.66.248.105',
    };

    const handleClick = vi.fn();
    render(<DeviceGroupCard device={device} onClick={handleClick} />);

    expect(screen.getByText('Roteador Huawei IGD')).toBeInTheDocument();
    expect(screen.getByText('3 entidades agrupadas')).toBeInTheDocument();
    expect(screen.getByText('WAN: Online • 100.66.248.105')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Roteador Huawei IGD'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renderiza o DeviceDetailModal com todas as entidades internas e suporta alternância de ação', async () => {
    const device: HADeviceGroup = {
      id: 'light_sala',
      name: 'Luz da Sala Principal',
      category: 'light',
      primaryEntity: mockEntities[7],
      entities: [mockEntities[7], mockEntities[8]],
    };

    const handleClose = vi.fn();
    const handleToggle = vi.fn().mockResolvedValue(undefined);

    render(
      <DeviceDetailModal
        device={device}
        isOpen={true}
        onClose={handleClose}
        onToggle={handleToggle}
      />
    );

    expect(screen.getByText('Luz da Sala Principal')).toBeInTheDocument();
    expect(screen.getByText('light.sala_principal')).toBeInTheDocument();
    expect(screen.getByText('Consumo Luz Sala')).toBeInTheDocument();
    expect(screen.getByText('12.5 W')).toBeInTheDocument();

    const powerButton = screen.getByTitle(/Desligar|Ligar/i);
    fireEvent.click(powerButton);
    expect(handleToggle).toHaveBeenCalledWith('light.sala_principal', 'on');

    const closeBtn = screen.getByLabelText(/Fechar/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
