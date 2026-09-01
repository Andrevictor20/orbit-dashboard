import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface SystemAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  source: string;
}

interface AlertsContextType {
  alerts: SystemAlert[];
  fetchAlerts: () => Promise<void>;
  loading: boolean;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/system/alerts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        // Sort alerts by timestamp descending (newest first)
        data.sort((a: SystemAlert, b: SystemAlert) => b.timestamp - a.timestamp);
        setAlerts(data);
      }
    } catch (err) {
      console.error('Failed to fetch system alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, fetchAlerts, loading }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
