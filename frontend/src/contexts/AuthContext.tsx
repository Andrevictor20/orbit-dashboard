import React, { createContext, useContext, useState, useEffect } from 'react';

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
        const token = localStorage.getItem('orbit_token');
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
              localStorage.removeItem('orbit_token');
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
    localStorage.setItem('orbit_token', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('orbit_token');
    setIsAuthenticated(false);
    // Em um cenário real, também faríamos um call para /api/auth/logout para limpar o cookie
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
