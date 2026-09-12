import { useQuery } from '@tanstack/react-query';

export interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  store: string;
}

export const STORE_APPS_QUERY_KEY = ['store-apps'] as const;

export async function fetchStoreAppsApi(): Promise<AppStoreItem[]> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/store/apps', { headers, credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch store apps: ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useStoreAppsQuery() {
  return useQuery({
    queryKey: STORE_APPS_QUERY_KEY,
    queryFn: fetchStoreAppsApi,
    staleTime: 5 * 60_000, // 5 minutes fresh cache
    gcTime: 15 * 60_000,
  });
}
