import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SystemSettings, PortConflictInfo } from '../types/settings';

const DEFAULT_SETTINGS: SystemSettings = {
  server_name: 'Orbit Dashboard',
  port: 5172,
  default_page: '/',
  metrics_refresh_rate: 5,
  show_weather_card: true,
  weather_city: '',
  confirm_dangerous_actions: true,
  integrations: {
    homeassistant: true,
    pihole: true,
  },
};

const STORAGE_KEY = 'orbit_system_settings';

interface SettingsContextValue {
  settings: SystemSettings;
  updateSettings: (partial: Partial<SystemSettings>) => Promise<SystemSettings>;
  checkPortAvailability: (port: number) => Promise<PortConflictInfo>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => DEFAULT_SETTINGS,
  checkPortAvailability: async () => ({
    host_port: 5172,
    container_port: 5172,
    protocol: 'tcp',
    in_use: false,
    suggested_port: 5172,
  }),
  isLoading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system/settings');
      if (res.ok) {
        const data: SystemSettings = await res.json();
        setSettings(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // offline / network error fallback to cached/default
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (partial: Partial<SystemSettings>): Promise<SystemSettings> => {
    const updated: SystemSettings = {
      ...settings,
      ...partial,
      integrations: {
        ...settings.integrations,
        ...(partial.integrations || {}),
      },
    };

    // Optimistic update
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    try {
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update system settings');
      }

      const saved: SystemSettings = await res.json();
      setSettings(saved);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return saved;
    } catch (err) {
      // Revert if API failed
      fetchSettings();
      throw err;
    }
  };

  const checkPortAvailability = async (port: number): Promise<PortConflictInfo> => {
    const res = await fetch('/api/system/settings/check-port', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    });

    if (!res.ok) {
      throw new Error('Failed to verify port availability');
    }

    return res.json();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        checkPortAvailability,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
