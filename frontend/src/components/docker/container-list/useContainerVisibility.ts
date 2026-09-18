import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

export function useContainerVisibility() {
  const { isAdmin } = useAuth();
  const [hiddenContainers, setHiddenContainers] = useState<string[]>([]);
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(false);

  const fetchVisibility = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoadingVisibility(true);
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('saturn_token') : null;
      const res = await fetch('/api/docker/visibility', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHiddenContainers(Array.isArray(data) ? data : []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingVisibility(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  const toggleVisibility = useCallback(async (containerId: string) => {
    if (!isAdmin) return;
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('saturn_token') : null;
      const res = await fetch('/api/docker/visibility/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ container_id: containerId }),
      });
      if (res.ok) {
        const data = await res.json();
        const clean = containerId.trim().replace(/^\//, '');
        setHiddenContainers(prev => {
          if (data.hidden) {
            return [...prev, clean];
          } else {
            return prev.filter(h => h.toLowerCase() !== clean.toLowerCase());
          }
        });
        toast.success(data.hidden ? 'Contêiner ocultado para membros.' : 'Contêiner visível para membros.');
      } else {
        toast.error('Falha ao alternar visibilidade.');
      }
    } catch {
      toast.error('Falha ao alternar visibilidade.');
    }
  }, [isAdmin]);

  const isContainerHidden = useCallback((id: string, name?: string) => {
    const cleanId = id.trim().replace(/^\//, '').toLowerCase();
    const cleanName = (name || '').trim().replace(/^\//, '').toLowerCase();
    return hiddenContainers.some(h => {
      const cleanH = h.trim().replace(/^\//, '').toLowerCase();
      return cleanH === cleanId
        || (cleanName !== '' && cleanH === cleanName)
        || (cleanId.length >= 12 && cleanH.startsWith(cleanId.slice(0, 12)));
    });
  }, [hiddenContainers]);

  return {
    isAdmin,
    hiddenContainers,
    isLoadingVisibility,
    fetchVisibility,
    toggleVisibility,
    isContainerHidden,
  };
}
