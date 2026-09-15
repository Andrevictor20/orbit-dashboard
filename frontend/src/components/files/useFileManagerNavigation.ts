import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function useFileManagerNavigation() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPath = searchParams.get('path');
  const isTrashView = urlPath === '__trash__';
  const [currentPath, setCurrentPath] = useState<string>(isTrashView ? '/' : (urlPath || '/'));

  // History navigation stack
  const [history, setHistory] = useState<string[]>([currentPath]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Manual path editing
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [manualPathInput, setManualPathInput] = useState<string>(currentPath);

  // Sync with URL query parameter
  useEffect(() => {
    if (urlPath && urlPath !== '__trash__' && urlPath !== currentPath) {
      setCurrentPath(urlPath);
    }
  }, [urlPath]);

  const navigateTo = (newPath: string) => {
    if (newPath === currentPath) return;
    const cleanPath = newPath.replace(/\/+/g, '/') || '/';
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(cleanPath);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentPath(cleanPath);
    setSearchParams({ path: cleanPath });
  };

  const navigateToTrash = () => {
    setSearchParams({ path: '__trash__' });
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevPath = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(prevPath);
      setSearchParams({ path: prevPath });
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextPath = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(nextPath);
      setSearchParams({ path: nextPath });
    }
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPathInput.trim()) {
      navigateTo(manualPathInput.trim());
    }
  };

  // Current folder name & item count
  const currentFolderName = useMemo(() => {
    if (isTrashView) return t('files.trash') || 'Lixeira';
    if (currentPath === '/' || !currentPath) return 'Raiz (/)';
    const parts = currentPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Arquivos';
  }, [currentPath, isTrashView, t]);

  // Breadcrumbs calculation
  const breadcrumbSegments = () => {
    if (isTrashView) {
      return [{ label: 'Lixeira do Sistema', path: '__trash__' }];
    }
    if (currentPath === '/' || !currentPath) {
      return [{ label: 'Raiz', path: '/' }];
    }
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: 'Raiz', path: '/' }];
    let accum = '';
    parts.forEach((p) => {
      accum += `/${p}`;
      crumbs.push({ label: p, path: accum });
    });
    return crumbs;
  };

  return {
    urlPath,
    isTrashView,
    currentPath,
    setCurrentPath,
    history,
    historyIndex,
    isEditingPath,
    setIsEditingPath,
    manualPathInput,
    setManualPathInput,
    navigateTo,
    navigateToTrash,
    handleGoBack,
    handleGoForward,
    handleManualPathSubmit,
    currentFolderName,
    breadcrumbSegments,
  };
}
