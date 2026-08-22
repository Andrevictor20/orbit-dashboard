import React, { useState, useRef, useEffect } from 'react';
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
  RotateCw
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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

  // Fetch companion subtitles
  useEffect(() => {
    fetch(`/api/files/subtitles?path=${encodeURIComponent(file.path)}`)
      .then(res => res.json())
      .then(data => {
        if (data.subtitles && Array.isArray(data.subtitles)) {
          setSubtitlesList(data.subtitles);
        }
      })
      .catch(() => {});
  }, [file.path]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full max-w-5xl bg-zinc-950 border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col group aspect-video max-h-[90vh]"
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

        {/* Video Element */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black cursor-pointer" onClick={togglePlay}>
          <video
            ref={videoRef}
            data-testid="video-element"
            src={videoSrc}
            playsInline
            className="w-full h-full object-contain"
          >
            {subtitlesList.map((sub, idx) => (
              <track
                key={idx}
                kind="subtitles"
                src={`/api/files/raw?path=${encodeURIComponent(sub.path)}`}
                srcLang={sub.lang}
                label={sub.label}
                default={activeSubtitle === sub.path}
              />
            ))}
          </video>

          {/* Big Center Play Icon when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-5 rounded-full bg-orbit-500/90 text-white shadow-2xl backdrop-blur-sm transform scale-110">
                <Play className="w-10 h-10 fill-current ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls Overlay */}
        <div className={`absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Progress Slider */}
          <input
            data-testid="video-progress"
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
          />

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
                  onChange={(e) => {
                    setActiveSubtitle(e.target.value);
                    if (videoRef.current && videoRef.current.textTracks) {
                      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                        const track = videoRef.current.textTracks[i];
                        track.mode = (e.target.value !== 'off' && track.label === e.target.value) ? 'showing' : 'disabled';
                      }
                    }
                  }}
                  className="bg-transparent text-xs text-white outline-none cursor-pointer"
                >
                  <option value="off" className="bg-zinc-900 text-white">Legendas: Off</option>
                  {subtitlesList.map((sub, idx) => (
                    <option key={idx} value={sub.path} className="bg-zinc-900 text-white">
                      {sub.label} ({sub.name})
                    </option>
                  ))}
                </select>
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
    </div>
  );
}
