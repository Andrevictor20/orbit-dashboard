import { useTranslation } from 'react-i18next';
import { Film, X, Copy, Check, Zap, RefreshCw } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface VideoHeaderOverlayProps {
  file: FileItem;
  showControls: boolean;
  isTranscodeMode: boolean;
  isForceTranscode: boolean;
  copied: boolean;
  onToggleForceTranscode: () => void;
  onCopyStreamLink: () => void;
  onClose: () => void;
}

export function VideoHeaderOverlay({
  file,
  showControls,
  isTranscodeMode,
  isForceTranscode,
  copied,
  onToggleForceTranscode,
  onCopyStreamLink,
  onClose,
}: VideoHeaderOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
        <div className="p-2 rounded-xl bg-saturn-500/20 text-saturn-400 border border-saturn-500/30 shrink-0">
          <Film className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base truncate max-w-[220px] sm:max-w-md" title={file.name}>
            {file.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-300 font-mono font-medium">
              {file.extension.toUpperCase()}
            </span>
            {isTranscodeMode && (
              <button
                type="button"
                onClick={onToggleForceTranscode}
                title={isForceTranscode 
                  ? t('files.switch_to_remux_tooltip', 'Clique para voltar ao Remux Direto rápido') 
                  : t('files.switch_to_transcode_tooltip', 'Clique para forçar Transcodificação por software')}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium transition-all ${
                  isForceTranscode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
              >
                {isForceTranscode ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Transcode (CPU)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Remux Direto (0% CPU)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onCopyStreamLink}
          title={t('files.copy_stream_link', 'Copiar link direto para VLC / player externo')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          <span className="hidden sm:inline">{copied ? t('common.copied', 'Copiado!') : 'VLC / Stream'}</span>
        </button>

        <button
          data-testid="close-video-modal"
          onClick={onClose}
          className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={t('common.close', 'Fechar')}
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
}

