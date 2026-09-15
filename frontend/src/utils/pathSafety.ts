// Safety categories for filesystem paths
export type SafetyLevel = 'critical' | 'warning' | 'safe';

export interface SafetyInfo {
  level: SafetyLevel;
  tag: string;
  description: string;
}

export function getPathSafetyInfo(path: string, t?: (key: string, def?: any) => string): SafetyInfo {
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
      tag: t ? t('disk.safety_critical_tag', 'Crítico do Sistema') : 'Crítico do Sistema',
      description: t
        ? t(
            'disk.safety_critical_desc',
            'NÃO APAGAR manualmente. Essencial para o funcionamento do kernel e do sistema operacional.'
          )
        : 'NÃO APAGAR manualmente. Essencial para o funcionamento do kernel e do sistema operacional.',
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
      tag: t ? t('disk.safety_warning_tag', 'Cuidado (Revisar)') : 'Cuidado (Revisar)',
      description: t
        ? t(
            'disk.safety_warning_desc',
            'Pode conter bancos de dados, volumes de containers ou configurações ativas de aplicações.'
          )
        : 'Pode conter bancos de dados, volumes de containers ou configurações ativas de aplicações.',
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
      tag: t ? t('disk.safety_safe_tag', 'Seguro para Limpeza') : 'Seguro para Limpeza',
      description: t
        ? t(
            'disk.safety_safe_desc',
            'Cache temporário, log rotacionado ou lixeira que pode ser liberado sem afetar o sistema.'
          )
        : 'Cache temporário, log rotacionado ou lixeira que pode ser liberado sem afetar o sistema.',
    };
  }

  return {
    level: 'warning',
    tag: t ? t('disk.safety_user_tag', 'Dados de Usuário') : 'Dados de Usuário',
    description: t
      ? t('disk.safety_user_desc', 'Arquivos e pastas de usuário ou de aplicações.')
      : 'Arquivos e pastas de usuário ou de aplicações.',
  };
}
