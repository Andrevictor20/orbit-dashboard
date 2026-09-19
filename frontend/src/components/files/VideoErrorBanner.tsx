import { useTranslation } from 'react-i18next';
import { AlertCircle, Clock, Play, Film, Check, Copy, Download, RefreshCw } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface VideoErrorBannerProps {
  file: FileItem;
  videoSrc: string;
  isTranscodeMode: boolean;
  isForceTranscode?: boolean;
  isStalled?: boolean;
  onEnableTranscode: () => void;
  onRetryRemux?: () => void;
  onCopyStreamLink: () => void;
  copied: boolean;
}

export function VideoErrorBanner({
  file,
  videoSrc,
  isTranscodeMode,
  isForceTranscode = false,
  isStalled = false,
  onEnableTranscode,
  onRetryRemux,
  onCopyStreamLink,
  copied,
}: VideoErrorBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`max-w-lg p-6 rounded-3xl bg-zinc-900/95 border ${isStalled ? 'border-amber-500/40' : 'border-red-500/40'} text-center space-y-4 shadow-2xl`}>
        <div className={`w-12 h-12 rounded-2xl ${isStalled ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'} flex items-center justify-center mx-auto`}>
          {isStalled ? <Clock className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
        </div>
        <div className="space-y-1.5">
          <h4 className="font-bold text-white text-base">
            {isStalled 
              ? t('files.video_stalled_title', 'Reprodução Travada ou Lenta')
              : t('files.video_decode_failure', 'Falha na Decodificação do Vídeo')}
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed max-w-md mx-auto">
            {isStalled
              ? t('files.video_stalled_desc', 'O navegador não conseguiu iniciar o fluxo rápido por aceleração de hardware. Escolha como prefere continuar:')
              : t('files.video_codec_incompatible', 'O formato/codec deste vídeo não pôde ser decodificado pelo navegador. Escolha uma opção:')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <a
            href={`vlc://${window.location.origin}${videoSrc}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-semibold transition-all border border-amber-500/40 shadow-sm"
          >
            <Film className="w-4 h-4 text-amber-400" />
            {t('files.open_in_vlc', 'Abrir no VLC (Recomendado)')}
          </a>

          {(!isTranscodeMode || !isForceTranscode) && (
            <button
              onClick={onEnableTranscode}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-saturn-600 hover:bg-saturn-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-saturn-600/25"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {t('files.play_with_transcode', 'Forçar Transcodificação')}
            </button>
          )}

          {onRetryRemux && (
            <button
              onClick={onRetryRemux}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5 text-saturn-400" />
              {t('files.retry_remux', 'Tentar Remux Novamente')}
            </button>
          )}

          <button
            onClick={onCopyStreamLink}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            {copied ? t('common.copied', 'Copiado!') : t('files.copy_stream_url', 'Copiar Link')}
          </button>

          <a
            href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
            download={file.name}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/10"
          >
            <Download className="w-3.5 h-3.5" /> {t('files.download_file', 'Baixar')}
          </a>
        </div>
      </div>
    </div>
  );
}

