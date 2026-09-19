import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/auth';

export interface UserProfile {
  id?: string;
  username: string;
  display_name?: string | null;
  role: 'admin' | 'member';
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  user: UserProfile | null;
  role: 'admin' | 'member';
  isAdmin: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<'admin' | 'member'>('admin');

  const fetchUser = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const userRole: 'admin' | 'member' = data.role === 'member' ? 'member' : 'admin';
        setUser({
          id: data.uid,
          username: data.username,
          display_name: data.display_name,
          role: userRole,
        });
        setRole(userRole);
        setIsAuthenticated(true);
        return true;
      } else {
        clearAuthToken();
        setUser(null);
        setIsAuthenticated(false);
        return false;
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      await fetchUser(token);
    }
  }, [fetchUser]);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(async data => {
        if (data.needs_setup) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        const token = getAuthToken();
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        await fetchUser(token);
        setIsLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsLoading(false);
      });
  }, [fetchUser]);

  const login = async (token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
    await fetchUser(token);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setRole('admin');
    setIsAuthenticated(false);
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, needsSetup, user, role, isAdmin, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      isAuthenticated: true,
      isLoading: false,
      needsSetup: false,
      user: { id: 'admin', username: 'admin', display_name: 'Admin', role: 'admin' },
      role: 'admin',
      isAdmin: true,
      login: async () => {},
      logout: () => {},
      refreshUser: async () => {},
    };
  }
  return context;
}

