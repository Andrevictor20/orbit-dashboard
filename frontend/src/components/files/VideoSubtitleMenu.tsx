import React from 'react';
import { Subtitles } from 'lucide-react';

export interface SubtitleItem {
  name: string;
  path: string;
  label: string;
  lang: string;
}

interface VideoSubtitleMenuProps {
  subtitlesList: SubtitleItem[];
  activeSubtitle: string;
  onSubtitleChange: (path: string) => void;
  onCustomSubtitleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VideoSubtitleMenu({
  subtitlesList,
  activeSubtitle,
  onSubtitleChange,
  onCustomSubtitleUpload,
}: VideoSubtitleMenuProps) {
  return (
    <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2 py-1 rounded-lg border border-zinc-700/50">
      <Subtitles className="w-4 h-4 text-orbit-400" />
      <select
        data-testid="subtitle-selector"
        value={activeSubtitle}
        onChange={(e) => onSubtitleChange(e.target.value)}
        className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-[130px] md:max-w-[200px] truncate"
      >
        <option value="off" className="bg-zinc-900 text-white">
          Legendas: Off
        </option>
        {subtitlesList.map((sub, idx) => (
          <option key={idx} value={sub.path} className="bg-zinc-900 text-white">
            {sub.label} ({sub.name})
          </option>
        ))}
      </select>
      <label
        className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white cursor-pointer transition-colors"
        title="Carregar legenda do dispositivo (.srt, .vtt, .ass)"
      >
        <span className="text-[10px] font-mono border border-zinc-600 px-1 py-0.5 rounded">.SRT</span>
        <input
          type="file"
          accept=".srt,.vtt,.ass"
          onChange={onCustomSubtitleUpload}
          className="hidden"
        />
      </label>
    </div>
  );
}
