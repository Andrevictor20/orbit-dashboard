import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useRef, 
  useCallback 
} from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { saveFileToDb, getFileFromDb, removeFileFromDb } from '../utils/uploadDb';

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk for high throughput & low overhead

export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  destinationPath: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  progress: number;
  speedMBs: number;
  status: 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  createdAt: number;
}

interface UploadManagerContextType {
  uploads: UploadItem[];
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (min: boolean) => void;
  enqueueUpload: (file: File, destinationPath: string) => Promise<string>;
  enqueueMultipleUploads: (files: File[], destinationPath: string) => Promise<void>;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => Promise<void>;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
}

const UploadManagerContext = createContext<UploadManagerContextType | undefined>(undefined);

const STORAGE_KEY = 'orbit_active_uploads';

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // In-memory references to active files & abort controllers
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningUploadsRef = useRef<Set<string>>(new Set());

  // Persist uploads list metadata to localStorage
  useEffect(() => {
    try {
      // Keep up to 20 recent uploads in metadata
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads.slice(0, 20)));
    } catch {}
  }, [uploads]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  // Upload runner for a single item
  const processUpload = useCallback(async (item: UploadItem, file: File) => {
    if (runningUploadsRef.current.has(item.id)) return;
    runningUploadsRef.current.add(item.id);

    const controller = new AbortController();
    abortControllersRef.current.set(item.id, controller);

    updateItem(item.id, { status: 'uploading', error: undefined });

    try {
      // 1. Check server status to resume existing chunks
      const token = localStorage.getItem('orbit_token');
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      let currentUploadedChunks = [...item.uploadedChunks];
      try {
        const statusRes = await fetch(`/api/files/upload/status?upload_id=${encodeURIComponent(item.id)}`, {
          headers: authHeaders,
          signal: controller.signal,
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.received_chunks && Array.isArray(statusData.received_chunks)) {
            currentUploadedChunks = Array.from(new Set([...currentUploadedChunks, ...statusData.received_chunks]));
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }

      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      let uploadedCount = currentUploadedChunks.length;
      let lastBytesSent = uploadedCount * CHUNK_SIZE;
      let lastTime = Date.now();

      // 2. Upload missing chunks sequentially
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (controller.signal.aborted) return;

        if (currentUploadedChunks.includes(chunkIndex)) {
          continue;
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, (chunkIndex + 1) * CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunkBlob, file.name);
        formData.append('upload_id', item.id);
        formData.append('chunk_index', chunkIndex.toString());
        formData.append('total_chunks', totalChunks.toString());
        formData.append('filename', file.name);
        formData.append('destination_path', item.destinationPath);

        const chunkRes = await fetch('/api/files/upload/chunk', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
          signal: controller.signal,
        });

        if (!chunkRes.ok) {
          const errText = await chunkRes.text().catch(() => 'Falha no chunk');
          throw new Error(errText || `Falha no envio do bloco ${chunkIndex + 1}`);
        }

        currentUploadedChunks.push(chunkIndex);
        uploadedCount++;

        // Calculate speed
        const now = Date.now();
        const timeDiffSec = (now - lastTime) / 1000;
        let speed = item.speedMBs;
        if (timeDiffSec >= 0.8) {
          const bytesDiff = (uploadedCount * CHUNK_SIZE) - lastBytesSent;
          speed = Math.max(0, parseFloat((bytesDiff / (1024 * 1024 * timeDiffSec)).toFixed(2)));
          lastBytesSent = uploadedCount * CHUNK_SIZE;
          lastTime = now;
        }

        const progressPercent = Math.min(99, Math.round((uploadedCount / totalChunks) * 100));

        updateItem(item.id, {
          uploadedChunks: [...currentUploadedChunks],
          progress: progressPercent,
          speedMBs: speed,
        });
      }

      // 3. Complete and assemble upload on server
      const completeHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders,
      };
      const completeRes = await fetch('/api/files/upload/complete', {
        method: 'POST',
        headers: completeHeaders,
        body: JSON.stringify({
          upload_id: item.id,
          filename: file.name,
          destination_path: item.destinationPath,
          total_chunks: totalChunks,
        }),
        signal: controller.signal,
      });

      if (!completeRes.ok) {
        const err = await completeRes.text().catch(() => 'Erro na montagem do arquivo');
        throw new Error(err || 'Erro na montagem do arquivo no servidor');
      }

      // 4. Mark completed and cleanup
      updateItem(item.id, {
        status: 'completed',
        progress: 100,
        speedMBs: 0,
        uploadedChunks: Array.from({ length: totalChunks }, (_, i) => i),
      });

      await removeFileFromDb(item.id);
      fileCacheRef.current.delete(item.id);

      toast.success(`Upload de "${file.name}" concluído com sucesso!`);
      window.dispatchEvent(new CustomEvent('orbit:files_changed', { detail: { path: item.destinationPath } }));
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Handled by pause/cancel
        return;
      }
      console.error('Upload failed:', err);
      updateItem(item.id, {
        status: 'error',
        error: err?.message || 'Erro inesperado no envio',
        speedMBs: 0,
      });
      toast.error(`Falha no upload de "${item.fileName}": ${err?.message || 'Erro de rede'}`);
    } finally {
      runningUploadsRef.current.delete(item.id);
      abortControllersRef.current.delete(item.id);
    }
  }, [updateItem]);

  // Enqueue a new file
  const enqueueUpload = useCallback(async (file: File, destinationPath: string): Promise<string> => {
    const id = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

    const newItem: UploadItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      destinationPath,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      uploadedChunks: [],
      progress: 0,
      speedMBs: 0,
      status: 'uploading',
      createdAt: Date.now(),
    };

    setUploads((prev) => [newItem, ...prev]);
    setIsDrawerOpen(true);
    setIsMinimized(false);

    // Save to cache & IndexedDB for F5 reload persistence
    fileCacheRef.current.set(id, file);
    await saveFileToDb(id, file);

    // Start upload process
    processUpload(newItem, file);
    return id;
  }, [processUpload]);

  // Enqueue multiple files
  const enqueueMultipleUploads = useCallback(async (files: File[], destinationPath: string) => {
    for (const f of files) {
      await enqueueUpload(f, destinationPath);
    }
  }, [enqueueUpload]);

  // Pause upload
  const pauseUpload = useCallback((id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    runningUploadsRef.current.delete(id);
    updateItem(id, { status: 'paused', speedMBs: 0 });
    toast('Upload pausado', { icon: '⏸️' });
  }, [updateItem]);

  // Resume upload
  const resumeUpload = useCallback(async (id: string) => {
    let file = fileCacheRef.current.get(id);
    if (!file) {
      file = await getFileFromDb(id) || undefined;
      if (file) fileCacheRef.current.set(id, file);
    }

    const item = uploads.find((u) => u.id === id);
    if (!item) return;

    if (!file) {
      toast.error('Arquivo original não encontrado. Por favor, reenvie o arquivo.');
      updateItem(id, { status: 'error', error: 'Arquivo expirado do cache local' });
      return;
    }

    processUpload(item, file);
  }, [uploads, processUpload, updateItem]);

  // Cancel upload
  const cancelUpload = useCallback(async (id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    runningUploadsRef.current.delete(id);
    fileCacheRef.current.delete(id);
    await removeFileFromDb(id);

    setUploads((prev) => prev.filter((u) => u.id !== id));
    toast('Upload cancelado', { icon: '🛑' });
  }, []);

  // Clear completed uploads from list
  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  // On initial mount / F5 reload: auto-hydrate active uploads from IndexedDB & server status
  useEffect(() => {
    const hydrateActiveUploads = async () => {
      for (const item of uploads) {
        if (item.status === 'uploading' || item.status === 'paused') {
          const file = await getFileFromDb(item.id);
          if (file) {
            fileCacheRef.current.set(item.id, file);
            // If it was uploading before F5, auto-resume it!
            if (item.status === 'uploading') {
              processUpload(item, file);
            }
          } else {
            updateItem(item.id, {
              status: 'paused',
              error: 'Página recarregada. Clique em Retomar para continuar o envio.',
            });
          }
        }
      }
    };

    hydrateActiveUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UploadManagerContext.Provider
      value={{
        uploads,
        isDrawerOpen,
        setIsDrawerOpen,
        isMinimized,
        setIsMinimized,
        enqueueUpload,
        enqueueMultipleUploads,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        clearCompleted,
      }}
    >
      {children}
    </UploadManagerContext.Provider>
  );
}

const defaultContextValue: UploadManagerContextType = {
  uploads: [],
  isDrawerOpen: false,
  setIsDrawerOpen: () => {},
  isMinimized: false,
  setIsMinimized: () => {},
  enqueueUpload: async () => '',
  enqueueMultipleUploads: async () => {},
  pauseUpload: () => {},
  resumeUpload: async () => {},
  cancelUpload: () => {},
  clearCompleted: () => {},
};

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  return ctx || defaultContextValue;
}
