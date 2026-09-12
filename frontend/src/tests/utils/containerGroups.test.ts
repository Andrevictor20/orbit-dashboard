import { describe, it, expect } from 'vitest';
import { 
  groupContainers, 
  getContainerGroupName, 
  formatGroupName,
  getSortedDeduplicatedPorts,
  getContainerWebLink,
  cleanAppName
} from '../../utils/containerGroups';

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
      expect(arSaudeGroup.webLink).toContain(':8080');
      expect(arSaudeGroup.webContainers.length).toBe(1);
      expect(arSaudeGroup.webContainers[0].name).toBe('ar-saude-frontend');
    }

    const grafanaGroup = grouped.find(g => g.type === 'group' && g.groupKey === 'grafana');
    expect(grafanaGroup).toBeDefined();
    if (grafanaGroup && grafanaGroup.type === 'group') {
      expect(grafanaGroup.totalCount).toBe(2);
      expect(grafanaGroup.webLink).toContain(':3001');
      expect(grafanaGroup.webContainers.length).toBe(1);
    }
  });

  it('honors saved preferred primary container in group', () => {
    localStorage.setItem('orbit_stack_primary_ar-saude', 'as2');
    const groups = groupContainers(mockContainers);
    const arSaudeGroup = groups.find(g => g.type === 'group' && g.id === 'group:ar-saude') as any;
    expect(arSaudeGroup?.primaryContainer.id).toBe('as2');
    localStorage.removeItem('orbit_stack_primary_ar-saude');
  });

  it('keeps single containers as single type', () => {
    const groups = groupContainers(mockContainers);
    const singleItems = groups.filter(g => g.type === 'single');
    expect(singleItems.length).toBe(3); // orbit, overseerr, moodle-tutorial
    expect(singleItems.some((s: any) => s.container.name === 'orbit')).toBe(true);
    expect(singleItems.some((s: any) => s.container.name === 'overseerr')).toBe(true);
    expect(singleItems.some((s: any) => s.container.name === 'moodle-tutorial')).toBe(true);
  });

  describe('getSortedDeduplicatedPorts & getContainerWebLink', () => {
    it('deduplicates duplicate IPv4 and IPv6 bindings and prioritizes web ports', () => {
      const rawPorts = [
        { ip: '0.0.0.0', private_port: 67, public_port: 67, typ: 'udp' },
        { ip: '0.0.0.0', private_port: 80, public_port: 8080, typ: 'tcp' },
        { ip: '::', private_port: 80, public_port: 8080, typ: 'tcp' },
      ];

      const sorted = getSortedDeduplicatedPorts(rawPorts, 'pihole/pihole:latest', 'pihole');
      expect(sorted.length).toBe(2);
      expect(sorted[0].public_port).toBe(8080);
      expect(sorted[1].public_port).toBe(67);

      const link = getContainerWebLink({
        id: 'pihole-1',
        name: 'pihole',
        image: 'pihole/pihole:latest',
        ports: rawPorts,
      });
      expect(link).toContain(':8080');
    });

    it('synthesizes and discovers web ports for host-network containers (Home Assistant)', () => {
      const haPorts = getSortedDeduplicatedPorts(
        [],
        'ghcr.io/home-assistant/home-assistant:stable',
        'homeassistant'
      );
      expect(haPorts.length).toBe(1);
      expect(haPorts[0].public_port).toBe(8123);

      const haLink = getContainerWebLink({
        id: 'ha-1',
        name: 'homeassistant',
        image: 'ghcr.io/home-assistant/home-assistant:stable',
        ports: [],
      });
      expect(haLink).toContain(':8123');
    });

    it('synthesizes and discovers web port 14333 for cloudflared-web', () => {
      const cloudflaredPorts = getSortedDeduplicatedPorts(
        [],
        'wisdomsky/cloudflared-web:latest',
        'cloudflared'
      );
      expect(cloudflaredPorts.length).toBe(1);
      expect(cloudflaredPorts[0].public_port).toBe(14333);

      const cloudflaredLink = getContainerWebLink({
        id: 'cf-1',
        name: 'cloudflared',
        image: 'wisdomsky/cloudflared-web:latest',
        ports: [],
      });
      expect(cloudflaredLink).toContain(':14333');
    });

    it('honors CasaOS labels (io.casaos.port.web) and user customLinks', () => {
      const labels = { 'io.casaos.port.web': '9090' };
      const ports = getSortedDeduplicatedPorts([], 'custom/service', 'custom-service', labels);
      expect(ports.length).toBe(1);
      expect(ports[0].public_port).toBe(9090);

      // User custom link overrides auto-detected link
      const customLink = getContainerWebLink(
        {
          id: 'custom-1',
          name: 'custom',
          image: 'custom/service',
          ports: [{ private_port: 9090, public_port: 9090, typ: 'tcp' }],
        },
        { 'custom-1': 'https://custom.myhomelab.net' }
      );
      expect(customLink).toBe('https://custom.myhomelab.net');
    });

    it('resolves custom links associated via Cloudflare by short ID, container name or compose service', () => {
      const fullId = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
      const shortId = 'a1b2c3d4e5f6';

      // 1. Matched by 12-char short ID when container has full ID
      const linkFromShortId = getContainerWebLink(
        {
          id: fullId,
          name: 'stirling-pdf',
          image: 'froodle/s-pdf:latest',
          ports: [{ private_port: 8080, public_port: 8080, typ: 'tcp' }],
        },
        { [shortId]: 'https://stirling-pdf.rasppi.cloud' }
      );
      expect(linkFromShortId).toBe('https://stirling-pdf.rasppi.cloud');

      // 2. Matched by container name (with leading slash on container)
      const linkFromName = getContainerWebLink(
        {
          id: 'c-diff-id',
          name: '/stirling-pdf',
          image: 'froodle/s-pdf:latest',
          ports: [{ private_port: 8080, public_port: 8080, typ: 'tcp' }],
        },
        { 'stirling-pdf': 'https://stirling-pdf.rasppi.cloud' }
      );
      expect(linkFromName).toBe('https://stirling-pdf.rasppi.cloud');

      // 3. Matched by com.docker.compose.service label
      const linkFromCompose = getContainerWebLink(
        {
          id: 'c-compose-id',
          name: 'mystack_web_1',
          image: 'nginx:alpine',
          ports: [{ private_port: 80, public_port: 80, typ: 'tcp' }],
          labels: { 'com.docker.compose.service': 'web' },
        },
        { 'web': 'https://web.rasppi.cloud' }
      );
      expect(linkFromCompose).toBe('https://web.rasppi.cloud');
    });

    it('cleans container app names by removing prefixes and suffixes', () => {
      expect(cleanAppName('linuxserver-kavita-app-1')).toBe('kavita');
      expect(cleanAppName('big-bear-pihole')).toBe('pihole');
      expect(cleanAppName('/orbit-dashboard')).toBe('orbit-dashboard');
      expect(cleanAppName('forumhub-frontend')).toBe('forumhub');
    });

    it('resolves links by stripped app name, token overlap and compose project', () => {
      // 1. By cleaned app name (linuxserver-kavita-app-1 -> kavita)
      const linkKavita = getContainerWebLink(
        {
          id: 'kavita-id',
          name: 'linuxserver-kavita-app-1',
          image: 'lscr.io/linuxserver/kavita:latest',
          ports: [{ private_port: 5000, public_port: 5000, typ: 'tcp' }],
        },
        { 'kavita': 'https://kavita.rasppi.cloud' }
      );
      expect(linkKavita).toBe('https://kavita.rasppi.cloud');

      // 2. By token overlap (stirling-pdf -> 'pdf' token matches 'pdf')
      const linkPdf = getContainerWebLink(
        {
          id: 'pdf-id',
          name: 'stirling-pdf',
          image: 'froodle/s-pdf:latest',
          ports: [{ private_port: 8080, public_port: 8080, typ: 'tcp' }],
        },
        { 'pdf': 'https://pdf.rasppi.cloud' }
      );
      expect(linkPdf).toBe('https://pdf.rasppi.cloud');

      // 3. By compose project label
      const linkComposeProj = getContainerWebLink(
        {
          id: 'proj-id',
          name: 'coletor',
          image: 'coletor:latest',
          ports: [],
          labels: { 'com.docker.compose.project': 'ar-saude' },
        },
        { 'ar-saude': 'https://saude.rasppi.cloud' }
      );
      expect(linkComposeProj).toBe('https://saude.rasppi.cloud');
    });

    it('resolves group webLink when customLink matches stack groupKey or sibling container', () => {
      const stackContainers = [
        {
          id: 'stack-c1',
          name: 'ar-saude-coletor',
          image: 'coletor:latest',
          state: 'running',
          labels: { 'com.docker.compose.project': 'ar-saude' },
        },
        {
          id: 'stack-c2',
          name: 'ar-saude-frontend',
          image: 'frontend:latest',
          state: 'running',
          ports: [{ private_port: 80, public_port: 3002, typ: 'tcp' }],
          labels: { 'com.docker.compose.project': 'ar-saude' },
        },
      ];

      const grouped = groupContainers(stackContainers, {
        'ar-saude': 'https://saude.rasppi.cloud',
      });
      expect(grouped.length).toBe(1);
      expect(grouped[0].type).toBe('group');
      if (grouped[0].type === 'group') {
        expect(grouped[0].webLink).toBe('https://saude.rasppi.cloud');
      }
    });
  });
});

