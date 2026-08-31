import { describe, it, expect } from 'vitest';
import { groupContainers, getContainerGroupName, formatGroupName } from '../../utils/containerGroups';

describe('containerGroups utility', () => {
  const mockContainers = [
    {
      id: 'c1',
      name: 'orbit',
      image: 'ghcr.io/andrevictor20/orbit:latest',
      state: 'running',
      status: 'Up 2 days',
      cpu_percent: 1.5,
      memory_used: 50 * 1024 * 1024,
      ports: [{ private_port: 3000, public_port: 3000, typ: 'tcp' }],
    },
    {
      id: 'c2',
      name: 'overseerr',
      image: 'lscr.io/linuxserver/overseerr:latest',
      state: 'running',
      status: 'Up 2 days',
      cpu_percent: 2.0,
      memory_used: 120 * 1024 * 1024,
      ports: [{ private_port: 5055, public_port: 5055, typ: 'tcp' }],
    },
    // Ar-Saude Stack
    {
      id: 'as1',
      name: 'ar-saude-frontend',
      image: 'ar-saude/frontend:latest',
      state: 'running',
      status: 'Up 1 day',
      cpu_percent: 0.5,
      memory_used: 40 * 1024 * 1024,
      ports: [{ private_port: 80, public_port: 8080, typ: 'tcp' }],
      labels: { 'com.docker.compose.project': 'ar-saude' },
    },
    {
      id: 'as2',
      name: 'ar-saude-coletor',
      image: 'ar-saude/coletor:latest',
      state: 'running',
      status: 'Up 1 day',
      cpu_percent: 5.0,
      memory_used: 150 * 1024 * 1024,
      labels: { 'com.docker.compose.project': 'ar-saude' },
    },
    {
      id: 'as3',
      name: 'ar-saude-postgres',
      image: 'postgres:16',
      state: 'running',
      status: 'Up 1 day',
      cpu_percent: 0.8,
      memory_used: 80 * 1024 * 1024,
      labels: { 'com.docker.compose.project': 'ar-saude' },
    },
    {
      id: 'as4',
      name: 'ar-saude-redis',
      image: 'redis:7',
      state: 'running',
      status: 'Up 1 day',
      cpu_percent: 0.2,
      memory_used: 20 * 1024 * 1024,
      labels: { 'com.docker.compose.project': 'ar-saude' },
    },
    // Prefix based stack without compose label
    {
      id: 'mon1',
      name: 'grafana-server',
      image: 'grafana/grafana:latest',
      state: 'running',
      status: 'Up 3 days',
      cpu_percent: 1.0,
      memory_used: 90 * 1024 * 1024,
      ports: [{ private_port: 3000, public_port: 3001, typ: 'tcp' }],
    },
    {
      id: 'mon2',
      name: 'grafana-loki',
      image: 'grafana/loki:latest',
      state: 'running',
      status: 'Up 3 days',
      cpu_percent: 0.8,
      memory_used: 70 * 1024 * 1024,
    },
    {
      id: 'single1',
      name: 'moodle-tutorial',
      image: 'bitnami/moodle:latest',
      state: 'running',
      status: 'Up 5 hours',
    }
  ];

  it('correctly extracts group name by label or prefix', () => {
    expect(getContainerGroupName(mockContainers[2])).toBe('ar-saude');
    expect(getContainerGroupName(mockContainers[6])).toBe('grafana');
    expect(formatGroupName('ar-saude')).toBe('Ar Saude');
    expect(formatGroupName('grafana')).toBe('Grafana');
  });

  it('groups containers by compose project and prefix when 2+ containers exist', () => {
    const grouped = groupContainers(mockContainers, {});

    // Total grouped items:
    // 1. Orbit (single)
    // 2. Overseerr (single)
    // 3. Ar-Saude (group of 4)
    // 4. Grafana (group of 2)
    // 5. Moodle-Tutorial (single, because only 1 container with moodle prefix)
    expect(grouped.length).toBe(5);

    const arSaudeGroup = grouped.find(g => g.type === 'group' && g.groupKey === 'ar-saude');
    expect(arSaudeGroup).toBeDefined();
    if (arSaudeGroup && arSaudeGroup.type === 'group') {
      expect(arSaudeGroup.name).toBe('Ar Saude');
      expect(arSaudeGroup.containers.length).toBe(4);
      expect(arSaudeGroup.totalCount).toBe(4);
      expect(arSaudeGroup.runningCount).toBe(4);
      expect(arSaudeGroup.allRunning).toBe(true);
      expect(arSaudeGroup.totalCpu).toBeCloseTo(6.5);
      expect(arSaudeGroup.totalMemory).toBe(290 * 1024 * 1024);
      expect(arSaudeGroup.primaryContainer.name).toBe('ar-saude-frontend');
    }

    const grafanaGroup = grouped.find(g => g.type === 'group' && g.groupKey === 'grafana');
    expect(grafanaGroup).toBeDefined();
    if (grafanaGroup && grafanaGroup.type === 'group') {
      expect(grafanaGroup.containers.length).toBe(2);
      expect(grafanaGroup.primaryContainer.name).toBe('grafana-server');
    }

    const moodleSingle = grouped.find(g => g.type === 'single' && g.container.name === 'moodle-tutorial');
    expect(moodleSingle).toBeDefined();
  });

  it('keeps single containers as single type', () => {
    const grouped = groupContainers(mockContainers, {});
    const orbitSingle = grouped.find(g => g.type === 'single' && g.container.name === 'orbit');
    expect(orbitSingle).toBeDefined();
    if (orbitSingle && orbitSingle.type === 'single') {
      expect(orbitSingle.container.id).toBe('c1');
    }
  });
});
