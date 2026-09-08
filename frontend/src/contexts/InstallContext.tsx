import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';

export type TaskType = 
  | 'app_install' 
  | 'prune_volumes' 
  | 'prune_images' 
  | 'prune_networks' 
  | 'file_copy' 
  | 'file_move' 
  | 'file_upload';

export type TaskStatus = 
  | 'starting' 
  | 'preparing' 
  | 'pulling' 
  | 'installing' 
  | 'running' 
  | 'done' 
  | 'error';

export interface InstallTask {
  id: string;
  type?: TaskType;
  title?: string;
  status: TaskStatus;
  progress: number;
  logs: string[];
  error?: string;
  destinationUrl?: string;
  createdAt?: number;
}

export interface TaskHelpers {
  addLog: (line: string) => void;
  setProgress: (percent: number) => void;
  setStatus: (status: TaskStatus) => void;
  setError: (err: string) => void;
  setDone: (finalLog?: string) => void;
}

export interface StartTaskOptions {
  type: TaskType;
  title: string;
  destinationUrl?: string;
  initialLogs?: string[];
  runner?: (helpers: TaskHelpers) => Promise<void>;
  showModal?: boolean;
}

interface TaskContextType {
  taskId: string | null;
  appName: string;
  isModalOpen: boolean;
  task: InstallTask | null;
  tasks: InstallTask[];
  startInstall: (taskId: string, appName: string) => void;
  startTask: (options: StartTaskOptions) => string;
  updateTask: (id: string, updates: Partial<InstallTask>) => void;
  addLog: (id: string, line: string) => void;
  minimize: () => void;
  maximize: (id?: string) => void;
  clear: (id?: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const INSTALL_STORAGE_KEY = 'orbit_install_tasks';
const CURRENT_TASK_ID_KEY = 'orbit_install_current_id';

export function InstallProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<InstallTask[]>(() => {
    try {
      const raw = localStorage.getItem(INSTALL_STORAGE_KEY);
      if (raw) {
        const parsed: InstallTask[] = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CURRENT_TASK_ID_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sincroniza persistência de tarefas no localStorage
  useEffect(() => {
    try {
      if (tasks.length > 0) {
        localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(tasks.slice(0, 10)));
      } else {
        localStorage.removeItem(INSTALL_STORAGE_KEY);
      }
    } catch {}
  }, [tasks]);

  // Sincroniza o ID da tarefa corrente no localStorage
  useEffect(() => {
    try {
      if (currentTaskId) {
        localStorage.setItem(CURRENT_TASK_ID_KEY, currentTaskId);
      } else {
        localStorage.removeItem(CURRENT_TASK_ID_KEY);
      }
    } catch {}
  }, [currentTaskId]);

  // Auto-Resume no mount: detecta se havia tarefa ativa ou consulta backend
  useEffect(() => {
    const hasActiveTask = tasks.some(t => t.status !== 'done' && t.status !== 'error');
    if (hasActiveTask) {
      toast('Recuperando download/instalação de container em andamento...', {
        icon: '📦',
        duration: 4000,
      });
      setIsModalOpen(true);
    }

    // Consulta tarefas ativas no backend para sincronização completa
    const token = localStorage.getItem('orbit_token');
    fetch('/api/store/install/active', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then((activeList: InstallTask[]) => {
        if (Array.isArray(activeList) && activeList.length > 0) {
          activeList.forEach(backendTask => {
            addOrUpdateTask({
              ...backendTask,
              title: backendTask.title || `Instalação ${backendTask.id.slice(0, 8)}`,
              type: 'app_install',
              destinationUrl: '/containers',
            });
          });
          const lastActive = activeList.find(t => t.status !== 'done' && t.status !== 'error');
          if (lastActive) {
            setCurrentTaskId(lastActive.id);
            setIsModalOpen(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  const currentTask = tasks.find(t => t.id === currentTaskId) || null;
  const currentTitle = currentTask ? (currentTask.title || (currentTask as any).appName || 'Tarefa') : '';

  const addOrUpdateTask = (task: InstallTask) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...task };
        return copy;
      }
      return [task, ...prev];
    });
  };

  const updateTask = (id: string, updates: Partial<InstallTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addLog = (id: string, line: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        logs: [...t.logs, line]
      };
    }));
  };

  const startInstall = (id: string, name: string) => {
    const newTask: InstallTask = {
      id,
      type: 'app_install',
      title: `Instalação de ${name}`,
      status: 'starting',
      progress: 0,
      logs: [`[INFO] Iniciando instalação do app ${name}...`],
      destinationUrl: '/containers',
      createdAt: Date.now()
    };

    addOrUpdateTask(newTask);
    setCurrentTaskId(id);
    setIsModalOpen(true);
  };

  const startTask = ({
    type,
    title,
    destinationUrl,
    initialLogs = [],
    runner,
    showModal = true,
  }: StartTaskOptions): string => {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTask: InstallTask = {
      id,
      type,
      title,
      status: 'starting',
      progress: 0,
      logs: initialLogs.length > 0 ? initialLogs : [`[INFO] Iniciando ${title.toLowerCase()}...`],
      destinationUrl,
      createdAt: Date.now()
    };

    addOrUpdateTask(newTask);
    setCurrentTaskId(id);
    if (showModal) {
      setIsModalOpen(true);
    }

    if (runner) {
      const helpers: TaskHelpers = {
        addLog: (line: string) => addLog(id, line),
        setProgress: (progress: number) => updateTask(id, { progress: Math.min(100, Math.max(0, progress)) }),
        setStatus: (status: TaskStatus) => updateTask(id, { status }),
        setError: (err: string) => {
          updateTask(id, { status: 'error', error: err });
          addLog(id, `[ERROR] ${err}`);
        },
        setDone: (finalLog?: string) => {
          updateTask(id, { status: 'done', progress: 100 });
          if (finalLog) {
            addLog(id, `[SUCCESS] ${finalLog}`);
          }
        },
      };

      // Run task asynchronously
      Promise.resolve().then(() => {
        return runner(helpers);
      }).catch(err => {
        helpers.setError(err?.message || 'Ocorreu um erro desconhecido');
      });
    }

    return id;
  };

  const minimize = () => {
    setIsModalOpen(false);
  };

  const maximize = (id?: string) => {
    if (id) {
      setCurrentTaskId(id);
    }
    setIsModalOpen(true);
  };

  const clear = (id?: string) => {
    const targetId = id || currentTaskId;
    if (targetId) {
      setTasks(prev => prev.filter(t => t.id !== targetId));
      if (currentTaskId === targetId) {
        const remaining = tasks.filter(t => t.id !== targetId);
        setCurrentTaskId(remaining.length > 0 ? remaining[0].id : null);
        setIsModalOpen(false);
      }
    } else {
      setTasks([]);
      setCurrentTaskId(null);
      setIsModalOpen(false);
    }
  };

  // Poll for app store install tasks
  useEffect(() => {
    const appInstallTasks = tasks.filter(t => t.type === 'app_install' && t.status !== 'done' && t.status !== 'error');
    if (appInstallTasks.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const token = localStorage.getItem('orbit_token');
        for (const it of appInstallTasks) {
          const res = await fetch(`/api/store/install/status/${it.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data: InstallTask = await res.json();
            updateTask(it.id, {
              status: data.status,
              progress: data.progress,
              logs: data.logs || [],
              error: data.error,
            });
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks]);

  return (
    <TaskContext.Provider
      value={{
        taskId: currentTaskId,
        appName: currentTitle,
        isModalOpen,
        task: currentTask,
        tasks,
        startInstall,
        startTask,
        updateTask,
        addLog,
        minimize,
        maximize,
        clear
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

const defaultTaskContext: TaskContextType = {
  taskId: null,
  appName: '',
  isModalOpen: false,
  task: null,
  tasks: [],
  startInstall: () => {},
  startTask: (opts) => {
    if (opts.runner) {
      opts.runner({
        addLog: () => {},
        setProgress: () => {},
        setStatus: () => {},
        setError: () => {},
        setDone: () => {},
      }).catch(() => {});
    }
    return 'default_id';
  },
  updateTask: () => {},
  addLog: () => {},
  minimize: () => {},
  maximize: () => {},
  clear: () => {},
};

export function useTasks() {
  const context = useContext(TaskContext);
  return context || defaultTaskContext;
}

export function useInstall() {
  return useTasks();
}
