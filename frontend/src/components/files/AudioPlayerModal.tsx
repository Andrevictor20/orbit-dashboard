import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, X, Music, RotateCcw, RotateCw } from 'lucide-react';

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  extension: string;
}

interface AudioPlayerModalProps {
  file: FileItem;
  onClose: () => void;
}

export function AudioPlayerModal({ file, onClose }: AudioPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioSrc = `/api/files/stream?path=${encodeURIComponent(file.path)}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-semibold text-primary truncate text-base" title={file.name}>
                {file.name}
              </h3>
              <p className="text-xs text-secondary">{file.extension.toUpperCase()} Audio</p>
            </div>
          </div>
          <button
            data-testid="close-audio-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Audio element */}
        <audio ref={audioRef} src={audioSrc} preload="metadata" autoPlay={false} />

        {/* Vinyl / Cover visualizer animation */}
        <div className="flex items-center justify-center py-4">
          <div className={`w-32 h-32 rounded-full border-4 border-orbit-500/30 flex items-center justify-center bg-gradient-to-tr from-zinc-900 to-zinc-800 shadow-xl ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
            <div className="w-10 h-10 rounded-full bg-orbit-500/20 border-2 border-orbit-500/40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-orbit-400" />
            </div>
          </div>
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="space-y-1.5">
          <input
            data-testid="audio-progress"
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
          />
          <div className="flex justify-between text-xs text-secondary">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10); }}
              className="p-2 text-secondary hover:text-primary transition-colors"
              title="-10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              data-testid="play-pause-btn"
              onClick={togglePlay}
              className="p-3.5 rounded-full bg-orbit-500 text-white hover:bg-orbit-600 active:scale-95 shadow-lg shadow-orbit-500/25 transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10); }}
              className="p-2 text-secondary hover:text-primary transition-colors"
              title="+10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-secondary hover:text-primary transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              data-testid="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolume}
              className="w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
