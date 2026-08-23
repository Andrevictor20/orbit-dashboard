import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  X, 
  Film, 
  Maximize, 
  Subtitles, 
  RotateCcw, 
  RotateCw,
  Loader2,
  Download,
  AlertCircle
} from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface SubtitleItem {
  name: string;
  path: string;
  label: string;
  lang: string;
}

interface VideoPlayerModalProps {
  file: FileItem;
  onClose: () => void;
}

export function VideoPlayerModal({ file, onClose }: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesList, setSubtitlesList] = useState<SubtitleItem[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('off');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoSrc = `/api/files/stream?path=${encodeURIComponent(file.path)}`;

  // Fetch companion and embedded subtitles
  useEffect(() => {
    fetch(`/api/files/subtitles?path=${encodeURIComponent(file.path)}`)
      .then(res => res.json())
      .then(data => {
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          setSubtitlesList(data.subtitles);
          const preferred = data.subtitles.find((s: SubtitleItem) => s.lang === 'pt-BR' || s.label.includes('Português')) || data.subtitles[0];
          if (preferred) {
            setActiveSubtitle(preferred.path);
          }
        }
      })
      .catch(() => {});
  }, [file.path]);

  const handleSubtitleChange = (subPath: string) => {
    setActiveSubtitle(subPath);
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        const sub = subtitlesList[i];
        if (sub && sub.path === subPath) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }
  };

  const handleCustomSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileUploaded = e.target.files?.[0];
    if (!fileUploaded) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      
      const vttContent = text.includes('WEBVTT') 
        ? text 
        : `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
      
      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      
      const newSub: SubtitleItem = {
        name: fileUploaded.name,
        path: blobUrl,
        label: `Arquivo (${fileUploaded.name})`,
        lang: 'custom',
      };

      setSubtitlesList(prev => [newSub, ...prev]);
      setActiveSubtitle(blobUrl);

      if (videoRef.current) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = newSub.label;
        track.srclang = 'custom';
        track.src = blobUrl;
        track.default = true;
        videoRef.current.appendChild(track);
        track.track.mode = 'showing';
      }
    };
    reader.readAsText(fileUploaded);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Video event handlers for smooth streaming & buffering
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        try {
          const currentBuf = video.buffered.end(video.buffered.length - 1);
          setBufferedEnd(currentBuf);
        } catch (_) {}
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsBuffering(false);
      video.play().catch(() => {});
    };

    const handleLoadedData = () => {
      setIsBuffering(false);
      video.play().catch(() => {});
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => {
      setIsBuffering(false);
      video.play().catch(() => {});
    };
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setIsBuffering(false);
      setHasError(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = newVol;
          setVolume(newVol);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = newVol;
          setVolume(newVol);
        }
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, duration]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-zinc-950 border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col group aspect-video max-h-[90vh] my-auto"
      >
        {/* Header Overlay */}
        <div className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orbit-500/20 text-orbit-400 border border-orbit-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm md:text-base truncate max-w-md" title={file.name}>
                {file.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                {file.extension.toUpperCase()} {file.extension.toLowerCase() === 'mkv' ? '(Matroska Stream)' : ''}
              </span>
            </div>
          </div>

          <button
            data-testid="close-video-modal"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video Element & Overlays */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black cursor-pointer overflow-hidden" onClick={togglePlay}>
          <video
            ref={videoRef}
            data-testid="video-element"
            src={videoSrc}
            preload="auto"
            autoPlay
            playsInline
            crossOrigin="anonymous"
            className="w-full h-full object-contain"
          >
            {subtitlesList.map((sub, idx) => (
              <track
                key={idx}
                kind="subtitles"
                src={sub.path.startsWith('blob:') ? sub.path : `/api/files/subtitles/vtt?path=${encodeURIComponent(sub.path)}`}
                srcLang={sub.lang}
                label={sub.label}
                default={activeSubtitle === sub.path}
              />
            ))}
          </video>

          {/* Buffering Spinner */}
          {isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-black/70 text-white shadow-2xl border border-white/10">
                <Loader2 className="w-8 h-8 text-orbit-400 animate-spin" />
                <span className="text-xs text-zinc-300 font-medium">Carregando fluxo...</span>
              </div>
            </div>
          )}

          {/* Error Banner (e.g. unsupported container or codec) */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
              <div className="max-w-md p-6 rounded-2xl bg-zinc-900 border border-red-500/30 text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-white">Falha na Decodificação do Vídeo</h4>
                  <p className="text-xs text-zinc-400">
                    O codec de áudio ou vídeo deste arquivo pode não ser compatível nativamente com o navegador. Você pode baixá-lo ou abrir com reprodutor externo (VLC).
                  </p>
                </div>
                <a
                  href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                  download={file.name}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orbit-600 hover:bg-orbit-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-orbit-600/30"
                >
                  <Download className="w-4 h-4" /> Baixar Arquivo
                </a>
              </div>
            </div>
          )}

          {/* Big Center Play Icon when paused and not buffering */}
          {!isPlaying && !isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-5 rounded-full bg-orbit-500/90 text-white shadow-2xl backdrop-blur-sm transform scale-110">
                <Play className="w-10 h-10 fill-current ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls Overlay */}
        <div className={`absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Progress Slider with Buffer Indicator */}
          <div className="relative w-full flex items-center">
            {/* Background & Buffer Bar */}
            <div className="absolute inset-x-0 h-1.5 bg-zinc-800 rounded-lg overflow-hidden pointer-events-none">
              <div 
                className="h-full bg-zinc-600 transition-all duration-200" 
                style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }}
              />
            </div>
            <input
              data-testid="video-progress"
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="relative z-10 w-full h-1.5 bg-transparent rounded-lg appearance-none cursor-pointer accent-orbit-500"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs md:text-sm">
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <button
                data-testid="video-play-btn"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = Math.max(0, currentTime - 10); }}
                className="p-1.5 text-zinc-300 hover:text-white transition-colors"
                title="-10s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = Math.min(duration, currentTime + 10); }}
                className="p-1.5 text-zinc-300 hover:text-white transition-colors"
                title="+10s"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={toggleMute} className="text-zinc-300 hover:text-white transition-colors">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  className="w-16 md:w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
                />
              </div>

              {/* Timestamps */}
              <span className="text-xs text-zinc-300 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls (Subtitles, Speed, Fullscreen) */}
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* Subtitles Dropdown */}
              <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2 py-1 rounded-lg border border-zinc-700/50">
                <Subtitles className="w-4 h-4 text-orbit-400" />
                <select
                  data-testid="subtitle-selector"
                  value={activeSubtitle}
                  onChange={(e) => handleSubtitleChange(e.target.value)}
                  className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-[130px] md:max-w-[200px] truncate"
                >
                  <option value="off" className="bg-zinc-900 text-white">Legendas: Off</option>
                  {subtitlesList.map((sub, idx) => (
                    <option key={idx} value={sub.path} className="bg-zinc-900 text-white">
                      {sub.label} ({sub.name})
                    </option>
                  ))}
                </select>
                <label 
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white cursor-pointer transition-colors"
                  title="Carregar legenda do dispositivo (.srt, .vtt)"
                >
                  <span className="text-[10px] font-mono border border-zinc-600 px-1 py-0.5 rounded">.SRT</span>
                  <input
                    type="file"
                    accept=".srt,.vtt,.ass"
                    onChange={handleCustomSubtitleUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Speed Selector */}
              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  if (videoRef.current) videoRef.current.playbackRate = rate;
                }}
                className="bg-zinc-800/80 text-xs text-white px-2 py-1 rounded-lg border border-zinc-700/50 outline-none cursor-pointer"
              >
                <option value="0.5" className="bg-zinc-900">0.5x</option>
                <option value="1" className="bg-zinc-900">1.0x</option>
                <option value="1.25" className="bg-zinc-900">1.25x</option>
                <option value="1.5" className="bg-zinc-900">1.5x</option>
                <option value="2" className="bg-zinc-900">2.0x</option>
              </select>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Tela Cheia"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
