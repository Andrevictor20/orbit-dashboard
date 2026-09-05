import { useSyncExternalStore } from 'react';

export interface DiskItemStat {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  percentage: number;
}

export interface DiskAnalysisResponse {
  path: string;
  total_size: number;
  item_count: number;
  items: DiskItemStat[];
}

export interface DiskAnalyzerState {
  isScanning: boolean;
  scannedBytes: number;
  totalBytes: number;
  targetPath: string | null;
  results: DiskAnalysisResponse | null;
  error: string | null;
}

let state: DiskAnalyzerState = {
  isScanning: false,
  scannedBytes: 0,
  totalBytes: 0,
  targetPath: null,
  results: null,
  error: null,
};

let eventSource: EventSource | null = null;
const listeners = new Set<() => void>();

export const diskAnalyzerStore = {
  getState: () => state,
  setState: (partial: Partial<DiskAnalyzerState>) => {
    state = { ...state, ...partial };
    listeners.forEach(l => l());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  
  startAnalysis: (targetPath: string, totalBytes: number) => {
    // Prevent starting if already scanning the same path
    if (state.isScanning && state.targetPath === targetPath) return;

    if (eventSource) {
      eventSource.close();
    }

    diskAnalyzerStore.setState({
      isScanning: true,
      scannedBytes: 0,
      totalBytes,
      targetPath,
      results: null,
      error: null,
    });

    eventSource = new EventSource(`/api/files/analyze?path=${encodeURIComponent(targetPath)}`);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        diskAnalyzerStore.setState({ scannedBytes: data.scanned_bytes });
      } catch (err) {
        console.error('Failed to parse progress', err);
      }
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        const results = JSON.parse(e.data);
        diskAnalyzerStore.setState({ 
          results, 
          isScanning: false,
          // Set scannedBytes to total_size found for accurate final representation
          scannedBytes: results.total_size 
        });
      } catch {
        diskAnalyzerStore.setState({ error: 'Erro ao processar resultados da análise', isScanning: false });
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    });

    eventSource.onerror = () => {
      diskAnalyzerStore.setState({ 
        error: 'Conexão interrompida ou erro na análise', 
        isScanning: false 
      });
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  cancelAnalysis: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    diskAnalyzerStore.setState({ isScanning: false });
  }
};

export function useDiskAnalyzerStore() {
  return useSyncExternalStore(
    diskAnalyzerStore.subscribe,
    diskAnalyzerStore.getState
  );
}
