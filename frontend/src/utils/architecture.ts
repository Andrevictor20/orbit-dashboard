export type ArchitectureFamily = 'x86' | 'arm' | 'multi' | 'unknown';

export interface ArchitectureInfo {
  raw: string[];
  supportsX86: boolean;
  supportsArm: boolean;
  isMultiArch: boolean;
  isOnlyX86: boolean;
  isOnlyArm: boolean;
  displayLabel: string;
  family: ArchitectureFamily;
}

/**
 * Normalizes and analyzes CPU architecture support for a store app.
 */
export function parseAppArchitectures(architectures?: string[]): ArchitectureInfo {
  if (!architectures || architectures.length === 0) {
    return {
      raw: [],
      supportsX86: true,
      supportsArm: true,
      isMultiArch: true,
      isOnlyX86: false,
      isOnlyArm: false,
      displayLabel: 'Multi-Arch',
      family: 'multi',
    };
  }

  const lower = architectures.map(a => a.toLowerCase().trim());
  const supportsX86 = lower.some(a =>
    a.includes('amd64') || a.includes('x86_64') || a === 'x86' || a === '386' || a === 'i386'
  );
  const supportsArm = lower.some(a =>
    a.includes('arm64') || a.includes('aarch64') || a === 'arm' || a.startsWith('armv') || a === 'armhf'
  );

  const isMultiArch = supportsX86 && supportsArm;
  const isOnlyX86 = supportsX86 && !supportsArm;
  const isOnlyArm = supportsArm && !supportsX86;

  let displayLabel = 'Multi-Arch';
  let family: ArchitectureFamily = 'multi';

  if (isOnlyX86) {
    displayLabel = 'Apenas x86_64';
    family = 'x86';
  } else if (isOnlyArm) {
    displayLabel = 'Apenas ARM64';
    family = 'arm';
  } else if (!supportsX86 && !supportsArm) {
    displayLabel = architectures.join(', ');
    family = 'unknown';
  }

  return {
    raw: architectures,
    supportsX86,
    supportsArm,
    isMultiArch,
    isOnlyX86,
    isOnlyArm,
    displayLabel,
    family,
  };
}

/**
 * Compares app architecture support with the host server CPU architecture.
 */
export function isArchCompatibleWithHost(
  appArchInfo: ArchitectureInfo,
  hostArch?: string
): {
  isCompatible: boolean;
  severity: 'none' | 'warning' | 'incompatible';
  warningMessage?: string;
} {
  if (!hostArch) {
    if (appArchInfo.isOnlyX86) {
      return {
        isCompatible: true,
        severity: 'warning',
        warningMessage: 'Não compatível com ARM (Requer processador x86_64)',
      };
    }
    if (appArchInfo.isOnlyArm) {
      return {
        isCompatible: true,
        severity: 'warning',
        warningMessage: 'Não compatível com x86 (Requer processador ARM)',
      };
    }
    return { isCompatible: true, severity: 'none' };
  }

  const h = hostArch.toLowerCase().trim();
  const hostIsArm = h.includes('arm') || h.includes('aarch64');
  const hostIsX86 = h.includes('x86') || h.includes('amd64') || h === '386';

  if (hostIsArm && appArchInfo.isOnlyX86) {
    return {
      isCompatible: false,
      severity: 'incompatible',
      warningMessage: 'Incompatível com o seu servidor ARM (Aplicativo exclusivo para x86_64)',
    };
  }

  if (hostIsX86 && appArchInfo.isOnlyArm) {
    return {
      isCompatible: false,
      severity: 'incompatible',
      warningMessage: 'Incompatível com o seu servidor x86_64 (Aplicativo exclusivo para ARM)',
    };
  }

  if (appArchInfo.isOnlyX86) {
    return {
      isCompatible: true,
      severity: 'warning',
      warningMessage: 'Disponível apenas para x86_64 (Sem suporte a processadores ARM)',
    };
  }

  if (appArchInfo.isOnlyArm) {
    return {
      isCompatible: true,
      severity: 'warning',
      warningMessage: 'Disponível apenas para ARM (Sem suporte a processadores x86_64)',
    };
  }

  return { isCompatible: true, severity: 'none' };
}
