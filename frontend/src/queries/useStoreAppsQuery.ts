import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  store: string;
  tagline?: string;
  developer?: string;
  version?: string;
  port?: number;
  architectures?: string[];
}

export interface StoreRepository {
  id: string;
  name: string;
  url: string;
  is_official: boolean;
  enabled: boolean;
}

import { getAuthToken } from '../utils/auth';

export const STORE_APPS_QUERY_KEY = ['store-apps'] as const;
export const STORE_REPOSITORIES_QUERY_KEY = ['store-repositories'] as const;

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchStoreAppsApi(): Promise<AppStoreItem[]> {
  const res = await fetch('/api/store/apps', { headers: getAuthHeaders(), credentials: 'include' });
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

export async function fetchStoreRepositoriesApi(): Promise<StoreRepository[]> {
  const res = await fetch('/api/store/repositories', { headers: getAuthHeaders(), credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to fetch store repositories: ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useStoreRepositoriesQuery() {
  return useQuery({
    queryKey: STORE_REPOSITORIES_QUERY_KEY,
    queryFn: fetchStoreRepositoriesApi,
    staleTime: 60_000,
  });
}

export async function addStoreRepositoryApi(payload: { name: string; url: string }): Promise<StoreRepository> {
  const res = await fetch('/api/store/repositories', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao adicionar repositório (${res.status})`);
  }
  const data = await res.json();
  return data.repository;
}

export async function removeStoreRepositoryApi(id: string): Promise<void> {
  const res = await fetch(`/api/store/repositories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao remover repositório (${res.status})`);
  }
}

export async function toggleStoreRepositoryApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/store/repositories/${id}/toggle`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao alternar status do repositório (${res.status})`);
  }
  const data = await res.json();
  return data.enabled;
}

export function useStoreRepositoryMutations() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: addStoreRepositoryApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_REPOSITORIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STORE_APPS_QUERY_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeStoreRepositoryApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_REPOSITORIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STORE_APPS_QUERY_KEY });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleStoreRepositoryApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_REPOSITORIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STORE_APPS_QUERY_KEY });
    },
  });

  return { addMutation, removeMutation, toggleMutation };
}
