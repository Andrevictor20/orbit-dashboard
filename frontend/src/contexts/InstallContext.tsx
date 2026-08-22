import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface InstallTask {
  id: string;
  status: 'starting' | 'preparing' | 'pulling' | 'installing' | 'done' | 'error';
  progress: number;
  logs: string[];
  error?: string;
}

interface InstallContextType {
  taskId: string | null;
  appName: string;
  isModalOpen: boolean;
  task: InstallTask | null;
  startInstall: (taskId: string, appName: string) => void;
  minimize: () => void;
  maximize: () => void;
  clear: () => void;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

export function InstallProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [task, setTask] = useState<InstallTask | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInstall = (id: string, name: string) => {
    setTaskId(id);
    setAppName(name);
    setIsModalOpen(true);
    setTask(null);
  };

  const minimize = () => {
    setIsModalOpen(false);
  };

  const maximize = () => {
    setIsModalOpen(true);
  };

  const clear = () => {
    setTaskId(null);
    setAppName('');
    setIsModalOpen(false);
    setTask(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (!taskId) return;

    const poll = async () => {
      try {
        const token = localStorage.getItem('orbit_token');
        const res = await fetch(`/api/store/install/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: InstallTask = await res.json();
        setTask(data);

        if (data.status === 'done' || data.status === 'error') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll(); // immediate first call
    pollingRef.current = setInterval(poll, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [taskId]);

  return (
    <InstallContext.Provider
      value={{
        taskId,
        appName,
        isModalOpen,
        task,
        startInstall,
        minimize,
        maximize,
        clear
      }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function useInstall() {
  const context = useContext(InstallContext);
  if (context === undefined) {
    throw new Error('useInstall must be used within an InstallProvider');
  }
  return context;
}
