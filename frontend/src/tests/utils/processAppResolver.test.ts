import { describe, it, expect } from 'vitest';
import { resolveProcessAppInfo } from '../../utils/processAppResolver';
import type { ProcessInfo } from '../../components/metrics/ProcessMonitor';
import type { ContainerLike } from '../../utils/containerGroups';

describe('processAppResolver', () => {
  const mockContainers: ContainerLike[] = [
    {
      id: 'd717f918239a48bb',
      name: '/homeassistant',
      image: 'ghcr.io/home-assistant/home-assistant:stable',
      labels: {},
    },
    {
      id: 'a1b2c3d4e5f6',
      name: '/linuxserver-kavita',
      image: 'linuxserver/kavita:latest',
      labels: {
        'com.docker.compose.project': 'kavita',
      },
    },
    {
      id: '998877665544',
      name: '/stirling-pdf',
      image: 'frooodle/s-pdf:latest',
      labels: {},
    },
    {
      id: '123456789abc',
      name: '/ar-saude-redis',
      image: 'redis:alpine',
      labels: {
        'com.docker.compose.project': 'ar-saude',
      },
    },
    {
      id: 'moodle12345',
      name: '/moodle_app',
      image: 'bitnami/moodle:latest',
      labels: {},
    },
  ];

  it('resolves Home Assistant with friendly name and icon for python3 process', () => {
    const proc: ProcessInfo = {
      pid: 2057696,
      name: 'python3',
      cmd: ['python3', '-m', 'homeassistant'],
      cpu_usage: 1.2,
      memory_rss: 1850000000,
      memory_vms: 2000000000,
      memory_percent: 24.2,
      status: 'sleeping',
      container_name: 'homeassistant',
      container_id: 'd717f918239a',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('Home Assistant');
    expect(resolved.iconUrl).toContain('home-assistant.png');
    expect(resolved.isHost).toBe(false);
    expect(resolved.subtitle).toContain('python3');
    expect(resolved.subtitle).toContain('2057696');
  });

  it('resolves Kavita for container process', () => {
    const proc: ProcessInfo = {
      pid: 10716,
      name: 'Kavita',
      cmd: ['./Kavita'],
      cpu_usage: 0.5,
      memory_rss: 431600000,
      memory_vms: 500000000,
      memory_percent: 5.5,
      status: 'sleeping',
      container_name: 'linuxserver-kavita',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('Kavita');
    expect(resolved.iconUrl).toContain('kavita.png');
    expect(resolved.isHost).toBe(false);
    expect(resolved.subtitle).toContain('10716');
  });

  it('resolves Stirling PDF when process is java inside stirling-pdf container', () => {
    const proc: ProcessInfo = {
      pid: 2298953,
      name: 'java',
      cmd: ['java', '-jar', 'Stirling-PDF.jar'],
      cpu_usage: 0.4,
      memory_rss: 259700000,
      memory_vms: 300000000,
      memory_percent: 3.3,
      status: 'sleeping',
      container_name: 'stirling-pdf',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('Stirling PDF');
    expect(resolved.iconUrl).toContain('stirling-pdf.png');
    expect(resolved.isHost).toBe(false);
    expect(resolved.subtitle).toContain('java');
    expect(resolved.subtitle).toContain('2298953');
  });

  it('resolves compose project name when available (ar-saude)', () => {
    const proc: ProcessInfo = {
      pid: 6131,
      name: 'node',
      cmd: ['node', 'server.js'],
      cpu_usage: 1.6,
      memory_rss: 120000000,
      memory_vms: 200000000,
      memory_percent: 1.5,
      status: 'sleeping',
      container_name: 'ar-saude-redis',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('Ar Saude');
    expect(resolved.isHost).toBe(false);
    expect(resolved.subtitle).toContain('node');
  });

  it('resolves container info even if containers list is empty, falling back to container_name', () => {
    const proc: ProcessInfo = {
      pid: 9999,
      name: 'jellyfin',
      cmd: ['/usr/bin/jellyfin'],
      cpu_usage: 2.5,
      memory_rss: 239700000,
      memory_vms: 300000000,
      memory_percent: 3.1,
      status: 'running',
      container_name: 'jellyfin',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, []);

    expect(resolved.displayName).toBe('Jellyfin');
    expect(resolved.iconUrl).toContain('jellyfin.png');
    expect(resolved.isHost).toBe(false);
  });

  it('identifies pure host process correctly without container', () => {
    const proc: ProcessInfo = {
      pid: 1,
      name: 'systemd',
      cmd: ['/sbin/init'],
      cpu_usage: 0.1,
      memory_rss: 15000000,
      memory_vms: 25000000,
      memory_percent: 0.2,
      status: 'sleeping',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('systemd');
    expect(resolved.isHost).toBe(true);
    expect(resolved.subtitle).toContain('1');
  });

  it('identifies known host daemon like dockerd or saturn', () => {
    const proc: ProcessInfo = {
      pid: 999,
      name: 'saturn',
      cmd: ['/app/saturn'],
      cpu_usage: 0.8,
      memory_rss: 45000000,
      memory_vms: 80000000,
      memory_percent: 0.6,
      status: 'running',
      start_time: 0,
      disk_read_bytes: 0,
      disk_written_bytes: 0,
    };

    const resolved = resolveProcessAppInfo(proc, mockContainers);

    expect(resolved.displayName).toBe('Saturn');
    expect(resolved.iconUrl).toBe('__saturn__');
  });
});
