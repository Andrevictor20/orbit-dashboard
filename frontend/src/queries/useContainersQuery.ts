import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Container } from '../components/docker/container-list';

export const CONTAINERS_QUERY_KEY = ['containers'] as const;
export const CONTAINER_STATS_QUERY_KEY = ['containers', 'stats'] as const;

export async function fetchContainersApi(): Promise<Container[]> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/docker/containers', { headers, credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch containers: ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchContainerStatsSnapshotApi(): Promise<any[]> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/docker/containers/stats/snapshot', { headers, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useContainersQuery() {
  return useQuery({
    queryKey: CONTAINERS_QUERY_KEY,
    queryFn: fetchContainersApi,
    staleTime: 8_000,
    refetchInterval: 15_000, // Background poll every 15s
  });
}

export function useContainerActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'delete' }) => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const method = action === 'delete' ? 'DELETE' : 'POST';
      const endpoint = action === 'delete' 
        ? `/api/docker/containers/${id}` 
        : `/api/docker/containers/${id}/${action}`;

      const res = await fetch(endpoint, { method, headers, credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to ${action} container`);
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      // Automatically revalidate containers across the whole app
      queryClient.invalidateQueries({ queryKey: CONTAINERS_QUERY_KEY });
    },
  });
}
