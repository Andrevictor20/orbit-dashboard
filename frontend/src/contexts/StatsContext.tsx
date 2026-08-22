import { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface SystemStats {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disks: { name: string; mount_point: string; used: number; total: number }[];
  network_tx: number;
  network_rx: number;
  temperature: number;
  docker_cpu: number;
  docker_memory: number;
  docker_tx: number;
  docker_rx: number;
  orbit_cpu: number;
  orbit_memory: number;
}

interface StatsContextValue {
  stats: SystemStats | null;
  isConnected: boolean;
}

const StatsContext = createContext<StatsContextValue>({
  stats: null,
  isConnected: false,
});

/**
 * OPT-F1: Single shared WebSocket for all stats consumers.
 * Overview and Metrics pages both subscribe to this context instead of
 * opening separate WebSocket connections, halving the WS overhead.
 */
export function StatsProvider({ children }: { children: ReactNode }) {
  const { stats, isConnected } = useWebSocket('/api/docker/stats');
  return (
    <StatsContext.Provider value={{ stats, isConnected }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  return useContext(StatsContext);
}
