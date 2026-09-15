import type { IngressRule } from '../../types/cloudflare';

export function detectBaseDomain(existingRules?: IngressRule[]): string {
  // 1. From localStorage
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('orbit_base_domain');
    if (saved && saved.trim()) return saved.trim().toLowerCase();
  }

  // 2. From existing rules in Cloudflare
  if (existingRules && existingRules.length > 0) {
    for (const r of existingRules) {
      if (r.hostname && r.hostname.includes('.')) {
        const parts = r.hostname.toLowerCase().split('.');
        if (parts.length >= 2) {
          const dom = parts.slice(1).join('.');
          if (dom && !dom.includes(':') && dom !== 'local' && dom !== 'lan') return dom;
        }
      }
    }
  }

  // 3. From window.location.hostname
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== 'localhost' && host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) return parts.slice(1).join('.');
    }
  }

  return 'rasppi.cloud';
}

export interface ContainerOption {
  id: string;
  name: string;
  state: string;
  ports: number[];
}

export function parseContainerList(data: any[]): ContainerOption[] {
  return data.map((c: any) => {
    const rawName = Array.isArray(c.names) && c.names[0] ? c.names[0] : c.name || '';
    const cleanName = rawName.replace(/^\//, '');
    const ports: number[] = [];
    if (Array.isArray(c.ports)) {
      c.ports.forEach((p: any) => {
        if (p.public_port && !ports.includes(p.public_port)) ports.push(p.public_port);
        if (p.private_port && !ports.includes(p.private_port)) ports.push(p.private_port);
      });
    }
    return { id: c.id || '', name: cleanName, state: c.state || '', ports };
  });
}
