import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloudflareConfigResponse, CloudflareTunnelsResponse } from '../types/cloudflare';

export const CLOUDFLARE_CONFIG_KEY = ['cloudflare', 'config'] as const;
export const CLOUDFLARE_TUNNELS_KEY = ['cloudflare', 'tunnels'] as const;

export async function fetchCloudflareConfigApi(): Promise<CloudflareConfigResponse> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/cloudflare/config', { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Cloudflare config');
  return res.json();
}

export async function fetchCloudflareTunnelsApi(): Promise<CloudflareTunnelsResponse> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/cloudflare/tunnels', { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Cloudflare tunnels');
  return res.json();
}

export function useCloudflareConfigQuery() {
  return useQuery({
    queryKey: CLOUDFLARE_CONFIG_KEY,
    queryFn: fetchCloudflareConfigApi,
    staleTime: 30_000,
  });
}

export function useCloudflareTunnelsQuery(enabled = true) {
  return useQuery({
    queryKey: CLOUDFLARE_TUNNELS_KEY,
    queryFn: fetchCloudflareTunnelsApi,
    staleTime: 15_000,
    enabled,
  });
}

export function useInvalidateCloudflare() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['cloudflare'] });
  };
}
