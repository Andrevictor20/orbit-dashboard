import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export interface DiskStat {
  name: string;
  mount_point: string;
  used: number;
  total: number;
}

export interface SystemStats {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disks: DiskStat[];
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

export interface MetricHistoryPoint {
  time: string;
  timestamp: number;
  cpu: number;
  dockerCpu: number;
  orbitCpu: number;
  memory: number;
  dockerMemory: number;
  orbitMemory: number;
  tx: number;
  rx: number;
  dockerTx: number;
  dockerRx: number;
}

interface StatsContextValue {
  stats: SystemStats | null;
  history: MetricHistoryPoint[];
  isConnected: boolean;
}

const StatsContext = createContext<StatsContextValue>({
  stats: null,
  history: [],
  isConnected: false,
});

/**
 * OPT-F1: Single shared WebSocket for all stats consumers.
 * Retains a global ring-buffer of up to 3600 points (1 hour of continuous metrics)
 * and loads initial history buffer from backend on connection.
 */
export function StatsProvider({ children }: { children: ReactNode }) {
  const { stats, isConnected } = useWebSocket('/api/docker/stats');
  const [history, setHistory] = useState<MetricHistoryPoint[]>([]);

  // Load initial historical snapshot from backend
  useEffect(() => {
    fetch('/api/docker/stats/history?limit=3600')
      .then(res => res.ok ? res.json() : [])
      .then((data: SystemStats[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const now = Date.now();
          const stepMs = 2000;
          const initialPoints: MetricHistoryPoint[] = data.map((item, index) => {
            const pointTime = new Date(now - (data.length - 1 - index) * stepMs);
            const timeStr = `${pointTime.getHours().toString().padStart(2, '0')}:${pointTime.getMinutes().toString().padStart(2, '0')}:${pointTime.getSeconds().toString().padStart(2, '0')}`;
            return {
              time: timeStr,
              timestamp: pointTime.getTime(),
              cpu: item.cpu_usage || 0,
              dockerCpu: item.docker_cpu || 0,
              orbitCpu: item.orbit_cpu || 0,
              memory: item.memory_used || 0,
              dockerMemory: item.docker_memory || 0,
              orbitMemory: item.orbit_memory || 0,
              tx: item.network_tx || 0,
              rx: item.network_rx || 0,
              dockerTx: item.docker_tx || 0,
              dockerRx: item.docker_rx || 0,
            };
          });
          setHistory(initialPoints);
        }
      })
      .catch(() => {});
  }, []);

  // Append new real-time ticks to history
  useEffect(() => {
    if (stats) {
      setHistory(prev => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newPoint: MetricHistoryPoint = {
          time: timeStr,
          timestamp: now.getTime(),
          cpu: stats.cpu_usage,
          dockerCpu: stats.docker_cpu,
          orbitCpu: stats.orbit_cpu,
          memory: stats.memory_used,
          dockerMemory: stats.docker_memory,
          orbitMemory: stats.orbit_memory,
          tx: stats.network_tx,
          rx: stats.network_rx,
          dockerTx: stats.docker_tx,
          dockerRx: stats.docker_rx,
        };

        const updated = [...prev, newPoint];
        if (updated.length > 3600) {
          return updated.slice(updated.length - 3600);
        }
        return updated;
      });
    }
  }, [stats]);

  return (
    <StatsContext.Provider value={{ stats, history, isConnected }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  return useContext(StatsContext);
}
