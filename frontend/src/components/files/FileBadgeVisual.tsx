import React from 'react';
import { 
  Folder, 
  File, 
  FileText, 
  Film, 
  Music, 
  Archive, 
  Code 
} from 'lucide-react';
import type { FileItem } from '../../types/fileManager';
import { 
  IMAGE_EXTENSIONS, 
  ARCHIVE_EXTENSIONS, 
  CODE_EXTENSIONS 
} from '../../types/fileManager';

interface FileBadgeVisualProps {
  item: FileItem;
}

export const FileBadgeVisual: React.FC<FileBadgeVisualProps> = ({ item }) => {
  if (item.is_dir) {
    return (
      <div className="relative group-hover:scale-105 transition-transform">
        {/* Modern Folder Graphic */}
        <div className="w-14 h-12 sm:w-16 sm:h-14 relative flex items-center justify-center">
          <div className="absolute top-0 left-1 w-6 h-2 bg-amber-600 rounded-t-md opacity-90" />
          <div className="w-full h-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-2xl shadow-md flex items-center justify-center border border-amber-300/40">
            <Folder className="w-7 h-7 sm:w-8 sm:h-8 text-amber-950/40 fill-amber-950/20" />
          </div>
        </div>
      </div>
    );
  }

  const ext = item.extension.toLowerCase();

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl overflow-hidden bg-neutral-900 border border-border/70 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform relative">
        <img
          src={`/api/files/raw?path=${encodeURIComponent(item.path)}`}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/70 rounded text-[9px] font-bold text-violet-300 uppercase">
          {ext}
        </div>
      </div>
    );
  }

  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-600/30 to-black border border-violet-500/30 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
        <Music className="w-6 h-6 text-violet-400" />
        <span className="text-[9px] font-bold text-violet-300 uppercase mt-0.5">{ext}</span>
      </div>
    );
  }

  if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 via-orange-600/30 to-black border border-rose-500/30 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
        <Film className="w-6 h-6 text-rose-400" />
        <span className="text-[9px] font-bold text-rose-300 uppercase mt-0.5">{ext}</span>
      </div>
    );
  }

  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-600/30 to-black border border-orange-500/30 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
        <Archive className="w-6 h-6 text-orange-400" />
        <span className="text-[9px] font-bold text-orange-300 uppercase mt-0.5">{ext}</span>
      </div>
    );
  }

  if (ext === 'pdf') {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-red-500/20 via-rose-700/30 to-black border border-red-500/30 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
        <FileText className="w-6 h-6 text-red-400" />
        <span className="text-[9px] font-bold text-red-300 uppercase mt-0.5">PDF</span>
      </div>
    );
  }

  if (CODE_EXTENSIONS.includes(ext)) {
    return (
      <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-700/30 to-black border border-emerald-500/30 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
        <Code className="w-6 h-6 text-emerald-400" />
        <span className="text-[9px] font-bold text-emerald-300 uppercase mt-0.5">{ext}</span>
      </div>
    );
  }

  return (
    <div className="w-14 h-12 sm:w-16 sm:h-14 rounded-2xl bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-border/70 flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-transform">
      <File className="w-6 h-6 text-zinc-400" />
      <span className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">{ext || 'FILE'}</span>
    </div>
  );
};
