export interface PortConflictCheckResult {
  port: number;
  inUse: boolean;
  service?: string;
}

export function extractPortsFromYaml(yamlText: string): number[] {
  const ports: number[] = [];
  const lines = yamlText.split('\n');
  let inPortsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('ports:')) {
      inPortsSection = true;
      continue;
    }

    if (inPortsSection) {
      if (trimmed.startsWith('-')) {
        // e.g. - "8080:80" or - 8080:80 or - "127.0.0.1:8080:80"
        const clean = trimmed.replace(/^-\s*["']?/, '').replace(/["']?$/, '');
        const parts = clean.split(':');
        if (parts.length === 2) {
          const hostPort = parseInt(parts[0], 10);
          if (!isNaN(hostPort) && hostPort > 0 && hostPort <= 65535) {
            ports.push(hostPort);
          }
        } else if (parts.length === 3) {
          const hostPort = parseInt(parts[1], 10);
          if (!isNaN(hostPort) && hostPort > 0 && hostPort <= 65535) {
            ports.push(hostPort);
          }
        }
      } else if (trimmed && !trimmed.startsWith('#')) {
        inPortsSection = false;
      }
    }
  }

  return Array.from(new Set(ports));
}

export function validateComposeSyntax(yamlText: string): { valid: boolean; error?: string } {
  if (!yamlText.trim()) {
    return { valid: false, error: 'O conteúdo YAML não pode estar vazio.' };
  }

  if (!yamlText.includes('services:')) {
    return { valid: false, error: 'A raiz do arquivo deve declarar a seção "services:".' };
  }

  // Basic indentation check
  const lines = yamlText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('\t')) {
      return {
        valid: false,
        error: `Linha ${i + 1}: Tabs (\\t) não são permitidos em YAML. Use espaços para indentação.`,
      };
    }
  }

  return { valid: true };
}
