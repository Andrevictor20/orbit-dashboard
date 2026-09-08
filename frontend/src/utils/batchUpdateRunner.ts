import type { ContainerLike } from './containerGroups';

export type ContainerUpdateState = 'pending' | 'pulling' | 'recreating' | 'success' | 'error' | 'cancelled';

export interface ContainerTaskStatus {
  id: string;
  name: string;
  image: string;
  state: ContainerUpdateState;
  error?: string;
  details?: string;
}

export interface PollContainerUpdateOptions {
  containerId: string;
  cleanName: string;
  token: string | null;
  signal: AbortSignal;
  isCancelled?: () => boolean;
  onStep?: (step: string) => void;
  onStatusChange?: (status: ContainerUpdateState) => void;
  addLog?: (msg: string) => void;
  pollIntervalMs?: number;
  inactivityTimeoutMs?: number;
  maxGlobalTimeoutMs?: number;
  maxNetworkRetries?: number;
  maxIdleHits?: number;
}

export interface PollContainerUpdateResult {
  success: boolean;
  error?: string;
  details?: string;
  wasCancelled?: boolean;
}

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without ANY progress or response
export const MAX_GLOBAL_CONTAINER_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes absolute ceiling for huge images
export const DEFAULT_NETWORK_RETRIES = 45; // 45 * 2s = 90s buffer for tunnel reconnects or high I/O latency
export const DEFAULT_IDLE_HITS = 15; // 15 * 2s = 30s buffer during container recreation

export const sanitizeErrorMessage = (rawText: string, status: number): string => {
  if (!rawText) {
    return status === 504
      ? 'Tempo limite de conexão esgotado (Gateway Timeout)'
      : `Erro ao atualizar container (HTTP ${status})`;
  }

  if (rawText.includes('<!DOCTYPE html') || rawText.includes('<html')) {
    if (status === 524 || rawText.includes('524: A timeout occurred') || rawText.includes('Error 524')) {
      return 'Tempo limite esgotado no proxy/Cloudflare (Error 524). A operação continuará em segundo plano.';
    }
    if (status === 502 || rawText.includes('502 Bad Gateway') || rawText.includes('Bad gateway')) {
      return 'Falha temporária de comunicação com o gateway/tunnel (HTTP 502).';
    }
    if (status === 504 || rawText.includes('504 Gateway Time-out') || rawText.includes('Gateway Timeout')) {
      return 'Tempo limite de conexão esgotado pelo proxy (Gateway Timeout 504).';
    }
    if (status === 403 || rawText.includes('Access denied') || rawText.includes('Attention Required!')) {
      return 'Acesso bloqueado por regras de firewall ou proxy (HTTP 403).';
    }
    const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return `Erro no proxy/rede: ${titleMatch[1].trim()}`;
    }
    return `Erro HTTP ${status} retornado pelo proxy ou rede.`;
  }

  return rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
};

export const isTunnelOrProxy = (c: ContainerLike): boolean => {
  const name = (c.name || '').toLowerCase();
  const img = (c.image || '').toLowerCase();
  return (
    name.includes('cloudflared') ||
    name.includes('tunnel') ||
    name.includes('traefik') ||
    name.includes('nginx-proxy') ||
    name.includes('caddy') ||
    img.includes('cloudflared') ||
    img.includes('traefik') ||
    img.includes('nginx-proxy')
  );
};

export const pollContainerUpdate = async ({
  containerId,
  cleanName,
  token,
  signal,
  isCancelled,
  onStep,
  onStatusChange,
  addLog = () => {},
  pollIntervalMs = 2000,
  inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS,
  maxGlobalTimeoutMs = MAX_GLOBAL_CONTAINER_TIMEOUT_MS,
  maxNetworkRetries = DEFAULT_NETWORK_RETRIES,
  maxIdleHits = DEFAULT_IDLE_HITS,
}: PollContainerUpdateOptions): Promise<PollContainerUpdateResult> => {
  let lastStep = '';
  let consecutiveNetworkErrors = 0;
  let consecutiveIdleHits = 0;
  const startTime = Date.now();
  let lastActivityTime = Date.now();

  while (true) {
    if (signal.aborted || (isCancelled && isCancelled())) {
      return { success: false, wasCancelled: true };
    }

    await new Promise((res) => setTimeout(res, pollIntervalMs));

    if (signal.aborted || (isCancelled && isCancelled())) {
      return { success: false, wasCancelled: true };
    }

    const now = Date.now();

    // Check Inactivity Watchdog: only fails if NO progress occurred for inactivityTimeoutMs
    if (now - lastActivityTime > inactivityTimeoutMs) {
      const timeoutMsg = `Inatividade prolongada no servidor (sem progresso por mais de ${Math.round(
        inactivityTimeoutMs / 60000
      )} minutos).`;
      return { success: false, error: timeoutMsg, details: 'Watchdog timeout due to lack of step progress' };
    }

    // Check absolute global ceiling
    if (now - startTime > maxGlobalTimeoutMs) {
      const maxMsg = `Tempo limite máximo global excedido (${Math.round(maxGlobalTimeoutMs / 60000)} minutos).`;
      return { success: false, error: maxMsg, details: 'Global timeout reached' };
    }

    try {
      const statusRes = await fetch(`/api/docker/containers/${containerId}/update-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });

      if (!statusRes.ok) {
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors % 5 === 0) {
          addLog(`[${cleanName}] Aguardando resposta do servidor (tentativa ${consecutiveNetworkErrors}/${maxNetworkRetries})...`);
        }
        if (consecutiveNetworkErrors > maxNetworkRetries) {
          return {
            success: false,
            error: `Servidor inacessível após ${maxNetworkRetries} tentativas (HTTP ${statusRes.status})`,
          };
        }
        continue;
      }

      // Network request succeeded: reset network error counter and refresh activity
      consecutiveNetworkErrors = 0;
      const task = await statusRes.json().catch(() => null);

      if (!task) continue;

      // Handle 'idle' status — task not found in backend map
      if (task.status === 'idle') {
        consecutiveIdleHits++;
        if (consecutiveIdleHits > maxIdleHits) {
          return {
            success: false,
            error: 'Tarefa não encontrada ou finalizada no servidor (status idle).',
            details: 'Task map did not register this container update',
          };
        }
        continue;
      }

      consecutiveIdleHits = 0;

      // Step progress detection (downloading layers, extracting bytes, etc.)
      if (task.step && task.step !== lastStep) {
        lastStep = task.step;
        lastActivityTime = Date.now(); // Activity confirmed by step change!
        onStep?.(task.step);
        addLog(`[${cleanName}] ${task.step}`);
      }

      if (task.status === 'pulling' || task.status === 'recreating') {
        lastActivityTime = Date.now(); // Activity confirmed by active status!
        onStatusChange?.(task.status);
      } else if (task.status === 'success') {
        return { success: true };
      } else if (task.status === 'error') {
        return {
          success: false,
          error: task.error || 'Falha na atualização do container',
          details: task.details,
        };
      }
    } catch (pollErr: unknown) {
      if (signal.aborted || (isCancelled && isCancelled())) {
        return { success: false, wasCancelled: true };
      }

      consecutiveNetworkErrors++;
      if (consecutiveNetworkErrors % 5 === 0) {
        addLog(`[${cleanName}] Conexão oscilando. Aguardando estabilização do proxy/rede...`);
      }
      if (consecutiveNetworkErrors > maxNetworkRetries) {
        const errMsg = pollErr instanceof Error ? pollErr.message : 'Falha de comunicação persistente com o servidor';
        return { success: false, error: errMsg, details: String(pollErr) };
      }
    }
  }
};
