import React, { useState } from 'react';
import type { FileItem } from '../../types/fileManager';

export function useFileManagerSelection(filteredFiles: FileItem[]) {
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);

  const isSelected = (item: FileItem) => selectedItems.some(i => i.path === item.path);

  const toggleSelect = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    if (isSelected(item)) {
      setSelectedItems(prev => prev.filter(i => i.path !== item.path));
    } else {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const selectAll = () => {
    if (selectedItems.length === filteredFiles.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...filteredFiles]);
    }
  };

  return {
    selectedItems,
    setSelectedItems,
    isSelected,
    toggleSelect,
    selectAll,
  };
}
