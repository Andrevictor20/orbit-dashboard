import { useEffect } from 'react';
import type { FileItem } from '../../types/fileManager';

interface FileManagerShortcutsProps {
  currentPath: string;
  selectedItems: FileItem[];
  hasActiveModal: boolean;
  handleGoBack: () => void;
  handleGoForward: () => void;
  loadFiles: (path: string) => void;
  selectAll: () => void;
  handleMoveToTrash: (items: FileItem[]) => void;
}

export function useFileManagerShortcuts({
  currentPath,
  selectedItems,
  hasActiveModal,
  handleGoBack,
  handleGoForward,
  loadFiles,
  selectAll,
  handleMoveToTrash,
}: FileManagerShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Do not navigate back/forward if any modal preview or file dialog is open
      if (hasActiveModal) {
        return;
      }

      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        handleGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        handleGoForward();
      } else if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        loadFiles(currentPath);
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        handleMoveToTrash(selectedItems);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPath,
    selectedItems,
    hasActiveModal,
    handleGoBack,
    handleGoForward,
    loadFiles,
    selectAll,
    handleMoveToTrash,
  ]);
}
