import { useTranslation } from 'react-i18next';
import { Film, X, Copy, Check } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface VideoHeaderOverlayProps {
  file: FileItem;
  showControls: boolean;
  isTranscodeMode: boolean;
  copied: boolean;
  onCopyStreamLink: () => void;
  onClose: () => void;
}

export function VideoHeaderOverlay({
  file,
  showControls,
  isTranscodeMode,
  copied,
  onCopyStreamLink,
  onClose,
}: VideoHeaderOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-saturn-500/20 text-saturn-400 border border-saturn-500/30">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm md:text-base truncate max-w-md" title={file.name}>
            {file.name}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
            {file.extension.toUpperCase()} {isTranscodeMode ? '(Transcoded MP4)' : file.extension.toLowerCase() === 'mkv' ? '(Matroska Stream)' : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCopyStreamLink}
          title={t('files.copy_stream_link', 'Copiar link direto para VLC / player externo')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          <span className="hidden sm:inline">{copied ? t('common.copied', 'Copiado!') : 'VLC / Stream'}</span>
        </button>

        <button
          data-testid="close-video-modal"
          onClick={onClose}
          className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
