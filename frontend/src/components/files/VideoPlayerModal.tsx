import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Play, Loader2 } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';
import { VideoControls } from './VideoControls';
import { VideoSubtitleMenu, type SubtitleItem } from './VideoSubtitleMenu';
import { VideoErrorBanner } from './VideoErrorBanner';
import { VideoHeaderOverlay } from './VideoHeaderOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { parseWebVtt, formatVideoTime, convertTextToVttBlob, type SubtitleCue } from '../../utils/vttParser';

export type { SubtitleItem };

interface VideoPlayerModalProps {
  file: FileItem;
  onClose: () => void;
}

export function VideoPlayerModal({ file, onClose }: VideoPlayerModalProps) {
  const { t } = useTranslation();
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
  const [copied, setCopied] = useState(false);

  const isDirectSupported = (ext: string) => {
    const e = ext.toLowerCase();
    return e === 'mp4' || e === 'webm';
  };

  const [isTranscodeMode, setIsTranscodeMode] = useState(() => !isDirectSupported(file.extension));
  const [transcodeSeekTime, setTranscodeSeekTime] = useState<number | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentCueText, setCurrentCueText] = useState<string>('');

  const isTranscodeModeRef = useRef(isTranscodeMode);
  useEffect(() => {
    isTranscodeModeRef.current = isTranscodeMode;
  }, [isTranscodeMode]);

  const cuesRef = useRef<SubtitleCue[]>([]);
  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  const transcodeSeekRef = useRef(transcodeSeekTime);
  useEffect(() => {
    transcodeSeekRef.current = transcodeSeekTime;
  }, [transcodeSeekTime]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('saturn_token') || localStorage.getItem('token') || '')
    : '';

  const baseStreamUrl = isTranscodeMode
    ? `/api/files/stream/transcode?path=${encodeURIComponent(file.path)}${transcodeSeekTime !== null && transcodeSeekTime > 0 ? `&start=${transcodeSeekTime}` : ''}`
    : `/api/files/stream?path=${encodeURIComponent(file.path)}`;
  const videoSrc = `${baseStreamUrl}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

  const handleCopyStreamLink = () => {
    const fullUrl = `${window.location.origin}${videoSrc}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Fetch available companion and embedded subtitle tracks
  useEffect(() => {
    const queryToken = token ? `&token=${encodeURIComponent(token)}` : '';
    fetch(`/api/files/subtitles?path=${encodeURIComponent(file.path)}${queryToken}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          setSubtitlesList(data.subtitles);
          const preferred = data.subtitles.find((s: SubtitleItem) => 
            s.lang === 'pt-BR' || s.lang === 'por' || s.label.toLowerCase().includes('portugu') || s.label.toLowerCase().includes('brazil')
          ) || data.subtitles[0];
          if (preferred) {
            setActiveSubtitle(preferred.path);
          }
        }
      })
      .catch(() => {});
  }, [file.path, token]);

  // Fetch active subtitle VTT text and parse cues for high-fidelity overlay
  useEffect(() => {
    if (activeSubtitle === 'off') {
      setCues([]);
      setCurrentCueText('');
      return;
    }

    const currentTrack = subtitlesList.find(s => s.path === activeSubtitle);
    if (!currentTrack) return;

    if (currentTrack.path.startsWith('blob:')) {
      fetch(currentTrack.path)
        .then(res => res.text())
        .then(text => setCues(parseWebVtt(text)))
        .catch(() => setCues([]));
      return;
    }

    const trackUrl = `/api/files/subtitles/vtt?path=${encodeURIComponent(currentTrack.path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    fetch(trackUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => setCues(parseWebVtt(text)))
      .catch(() => setCues([]));
  }, [activeSubtitle, subtitlesList, token]);

  const handleSubtitleChange = (subPath: string) => {
    setActiveSubtitle(subPath);
  };

  const handleCustomSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileUploaded = e.target.files?.[0];
    if (!fileUploaded) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const blobUrl = URL.createObjectURL(convertTextToVttBlob(text));
      const newSub: SubtitleItem = {
        name: fileUploaded.name,
        path: blobUrl,
        label: t('files.custom_subtitle_file', { name: fileUploaded.name, defaultValue: `Arquivo (${fileUploaded.name})` }),
        lang: 'custom',
      };
      setSubtitlesList(prev => [newSub, ...prev]);
      setActiveSubtitle(blobUrl);
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

  // Video event handlers for streaming, buffering & subtitle sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const vTime = video.currentTime;
      const offset = (isTranscodeModeRef.current && transcodeSeekRef.current !== null) ? transcodeSeekRef.current : 0;
      const actualTime = offset + vTime;
      setCurrentTime(actualTime);

      if (video.buffered.length > 0) {
        try {
          const currentBuf = video.buffered.end(video.buffered.length - 1);
          setBufferedEnd(offset + currentBuf);
        } catch {}
      }

      // Sync active subtitle cue
      const activeCues = cuesRef.current;
      if (activeCues.length > 0) {
        const match = activeCues.find(c => actualTime >= c.start && actualTime <= c.end);
        setCurrentCueText(match ? match.text : '');
      } else {
        setCurrentCueText('');
      }
    };
    
    const handleLoadedMetadata = () => {
      if (!isTranscodeModeRef.current || duration === 0) {
        setDuration(video.duration || 0);
      }
      setIsBuffering(false);
    };

    const handleLoadedData = () => setIsBuffering(false);
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setIsBuffering(false);
      if (!isTranscodeModeRef.current) {
        setIsTranscodeMode(true);
        setIsBuffering(true);
        setHasError(false);
      } else {
        setHasError(true);
      }
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
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
    };
  }, [duration]);

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (isTranscodeModeRef.current) {
      setTranscodeSeekTime(Math.floor(time));
      setIsBuffering(true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSkip = useCallback((seconds: number) => {
    const current = currentTime;
    const target = seconds < 0 
      ? Math.max(0, current + seconds)
      : Math.min(duration, current + seconds);
    setCurrentTime(target);
    if (isTranscodeModeRef.current) {
      setTranscodeSeekTime(Math.floor(target));
      setIsBuffering(true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  }, [currentTime, duration]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip(5);
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
  }, [togglePlay, handleSkip, isMuted, volume, onClose]);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
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
        <VideoHeaderOverlay
          file={file}
          showControls={showControls}
          isTranscodeMode={isTranscodeMode}
          copied={copied}
          onCopyStreamLink={handleCopyStreamLink}
          onClose={onClose}
        />

        {/* Video Element & Overlays */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black cursor-pointer overflow-hidden" onClick={togglePlay}>
          <video
            ref={videoRef}
            data-testid="video-element"
            src={videoSrc}
            preload="metadata"
            autoPlay
            playsInline
            crossOrigin="anonymous"
            className="w-full h-full object-contain"
          >
            {activeSubtitle !== 'off' && (() => {
              const currentTrack = subtitlesList.find(s => s.path === activeSubtitle);
              if (!currentTrack) return null;
              const trackSrc = currentTrack.path.startsWith('blob:') 
                ? currentTrack.path 
                : `/api/files/subtitles/vtt?path=${encodeURIComponent(currentTrack.path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

              return (
                <track
                  key={currentTrack.path}
                  kind="subtitles"
                  src={trackSrc}
                  srcLang={currentTrack.lang || 'und'}
                  label={currentTrack.label}
                  default
                  onLoad={(e) => {
                    const trackElem = e.currentTarget as HTMLTrackElement;
                    if (trackElem.track) {
                      trackElem.track.mode = 'showing';
                    }
                  }}
                />
              );
            })()}
          </video>

          {/* Dedicated Subtitle Overlay with High Contrast & Perfect Sync */}
          <SubtitleOverlay currentCue={currentCueText} />

          {/* Buffering Spinner */}
          {isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-black/70 text-white shadow-2xl border border-white/10">
                <Loader2 className="w-8 h-8 text-saturn-400 animate-spin" />
                <span className="text-xs text-zinc-300 font-medium">{t('files.optimizing_stream', 'Otimizando fluxo...')}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {hasError && (
            <VideoErrorBanner
              file={file}
              videoSrc={videoSrc}
              isTranscodeMode={isTranscodeMode}
              onEnableTranscode={() => {
                setHasError(false);
                setIsBuffering(true);
                setIsTranscodeMode(true);
              }}
              onCopyStreamLink={handleCopyStreamLink}
              copied={copied}
            />
          )}

          {/* Big Center Play Icon when paused and not buffering */}
          {!isPlaying && !isBuffering && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-5 rounded-full bg-saturn-500/90 text-white shadow-2xl backdrop-blur-sm transform scale-110">
                <Play className="w-10 h-10 fill-current ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Modular Video Controls */}
        <VideoControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          volume={volume}
          isMuted={isMuted}
          onSeek={handleSeek}
          onVolumeChange={handleVolume}
          onToggleMute={toggleMute}
          onSkip={handleSkip}
          playbackRate={playbackRate}
          onRateChange={handleRateChange}
          onToggleFullscreen={toggleFullscreen}
          formatTime={formatVideoTime}
          showControls={showControls}
        >
          <VideoSubtitleMenu
            subtitlesList={subtitlesList}
            activeSubtitle={activeSubtitle}
            onSubtitleChange={handleSubtitleChange}
            onCustomSubtitleUpload={handleCustomSubtitleUpload}
          />
        </VideoControls>
      </div>
    </div>,
    document.body
  ) : null;
}
