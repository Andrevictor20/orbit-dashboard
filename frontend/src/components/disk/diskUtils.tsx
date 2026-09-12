import React from 'react';
import {
  Folder,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Archive,
  FileCode,
} from 'lucide-react';

export function getItemIcon(name: string, is_dir: boolean): React.ReactElement {
  if (is_dir) return <Folder className="text-amber-400 w-4 h-4 shrink-0" />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Film className="text-rose-400 w-4 h-4 shrink-0" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext)) {
    return <Music className="text-violet-400 w-4 h-4 shrink-0" />;
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return <ImageIcon className="text-pink-400 w-4 h-4 shrink-0" />;
  }
  if (['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext)) {
    return <Archive className="text-orange-400 w-4 h-4 shrink-0" />;
  }
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'rs',
      'py',
      'json',
      'yaml',
      'yml',
      'sh',
      'html',
      'css',
      'toml',
      'env',
    ].includes(ext)
  ) {
    return <FileCode className="text-emerald-400 w-4 h-4 shrink-0" />;
  }
  return <FileText className="text-sky-400 w-4 h-4 shrink-0" />;
}
