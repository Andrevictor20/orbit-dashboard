// Safety categories for filesystem paths
export type SafetyLevel = 'critical' | 'warning' | 'safe';

export interface SafetyInfo {
  level: SafetyLevel;
  tag: string;
  description: string;
}

export function getPathSafetyInfo(path: string): SafetyInfo {
  const p = path.toLowerCase();

  // Critical system paths - NEVER TOUCH
  if (
    p === '/boot' ||
    p.startsWith('/boot/') ||
    p === '/etc' ||
    p.startsWith('/etc/') ||
    p === '/lib' ||
    p.startsWith('/lib/') ||
    p === '/lib64' ||
    p.startsWith('/lib64/') ||
    p === '/usr/bin' ||
    p === '/usr/sbin' ||
    p === '/bin' ||
    p === '/sbin' ||
    p === '/proc' ||
    p.startsWith('/proc/') ||
    p === '/sys' ||
    p.startsWith('/sys/') ||
    p === '/dev' ||
    p.startsWith('/dev/') ||
    p.includes('/docker/overlay2') ||
    p.includes('/var/lib/docker/overlay2') ||
    p === '/root'
  ) {
    return {
      level: 'critical',
      tag: 'Crítico do Sistema',
      description:
        'NÃO APAGAR manualmente. Essencial para o funcionamento do kernel e do sistema operacional.',
    };
  }

  // Warning paths - Review before touching
  if (
    p.startsWith('/var/lib') ||
    p.includes('/.config') ||
    p.startsWith('/etc/docker') ||
    p.includes('/docker/volumes')
  ) {
    return {
      level: 'warning',
      tag: 'Cuidado (Revisar)',
      description:
        'Pode conter bancos de dados, volumes de containers ou configurações ativas de aplicações.',
    };
  }

  // Safe paths for cleaning
  if (
    p.startsWith('/tmp') ||
    p.startsWith('/var/tmp') ||
    p.includes('/.cache') ||
    p.includes('/cache/apt') ||
    p.includes('/.local/share/trash') ||
    p.includes('__trash__') ||
    p.endsWith('.gz') ||
    p.endsWith('.log.1') ||
    p.endsWith('.old') ||
    p.endsWith('.bak')
  ) {
    return {
      level: 'safe',
      tag: 'Seguro para Limpeza',
      description:
        'Cache temporário, log rotacionado ou lixeira que pode ser liberado sem afetar o sistema.',
    };
  }

  return {
    level: 'warning',
    tag: 'Dados de Usuário',
    description: 'Arquivos e pastas de usuário ou de aplicações.',
  };
}
