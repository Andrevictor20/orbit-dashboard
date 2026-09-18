import { useTranslation } from 'react-i18next';
import { AlertCircle, Play, Film, Check, Copy, Download } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface VideoErrorBannerProps {
  file: FileItem;
  videoSrc: string;
  isTranscodeMode: boolean;
  onEnableTranscode: () => void;
  onCopyStreamLink: () => void;
  copied: boolean;
}

export function VideoErrorBanner({
  file,
  videoSrc,
  isTranscodeMode,
  onEnableTranscode,
  onCopyStreamLink,
  copied,
}: VideoErrorBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-w-lg p-6 rounded-2xl bg-zinc-900 border border-red-500/30 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-white">
            {t('files.video_decode_failure', 'Falha na Decodificação do Vídeo')}
          </h4>
          <p className="text-xs text-zinc-400">
            {t(
              'files.video_codec_incompatible',
              'O formato/codec deste vídeo (como MKV ou H.264 10-bit) não é suportado nativamente pelo navegador. Escolha uma opção abaixo:'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {!isTranscodeMode && (
            <button
              onClick={onEnableTranscode}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-saturn-600 hover:bg-saturn-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-saturn-600/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {t('files.play_with_transcode', 'Modo Compatibilidade (Transcodificar)')}
            </button>
          )}

          <a
            href={`vlc://${window.location.origin}${videoSrc}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            {t('files.open_in_vlc', 'Abrir no VLC')}
          </a>

          <button
            onClick={onCopyStreamLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            {copied ? t('common.copied', 'Copiado!') : t('files.copy_stream_url', 'Copiar Link')}
          </button>

          <a
            href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
            download={file.name}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
          >
            <Download className="w-3.5 h-3.5" /> {t('files.download_file', 'Baixar Arquivo')}
          </a>
        </div>
      </div>
    </div>
  );
}
