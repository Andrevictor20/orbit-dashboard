import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);

  useEffect(() => {
    // Primeiro verificamos se o backend precisa de setup (First Boot)
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        if (data.needs_setup) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        // Se não precisa de setup, checa autenticação normal
        const token = getAuthToken();
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => {
            if (res.ok) {
              setIsAuthenticated(true);
            } else {
              setIsAuthenticated(false);
              clearAuthToken();
            }
          })
          .catch(() => setIsAuthenticated(false))
          .finally(() => setIsLoading(false));
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsLoading(false);
      });
  }, []);

  const login = (token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, needsSetup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
