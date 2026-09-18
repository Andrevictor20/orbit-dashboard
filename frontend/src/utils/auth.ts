/**
 * Unified authentication and token storage utilities for Saturn.
 */

export const SATURN_TOKEN_KEY = 'saturn_token';
export const LEGACY_TOKEN_KEY = 'token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  return (
    localStorage.getItem(SATURN_TOKEN_KEY) ||
    localStorage.getItem(LEGACY_TOKEN_KEY) ||
    null
  );
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.setItem(SATURN_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.removeItem(SATURN_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}
