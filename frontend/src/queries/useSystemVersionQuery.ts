import { useQuery } from '@tanstack/react-query';
import { getAuthToken } from '../utils/auth';

export interface SystemVersionResponse {
  version: string;
  platform?: string;
  arch?: string;
}

export const SYSTEM_VERSION_QUERY_KEY = ['system-version'] as const;

export async function fetchSystemVersionApi(): Promise<SystemVersionResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/system/version', {
      headers,
      credentials: 'include',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }

  try {
    const healthRes = await fetch('/health');
    if (healthRes.ok) {
      return await healthRes.json();
    }
  } catch {
    // ignore
  }

  return { version: 'unknown', arch: undefined };
}

export function useSystemVersionQuery() {
  return useQuery({
    queryKey: SYSTEM_VERSION_QUERY_KEY,
    queryFn: fetchSystemVersionApi,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
}
