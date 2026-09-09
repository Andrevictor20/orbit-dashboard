import React from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  RotateCw 
} from 'lucide-react';

interface VideoControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  isMuted: boolean;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
  onSkip: (seconds: number) => void;
  playbackRate: number;
  onRateChange: (rate: number) => void;
  onToggleFullscreen: () => void;
  formatTime: (secs: number) => string;
  showControls: boolean;
  children?: React.ReactNode;
}

export function VideoControls({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  bufferedEnd,
  volume,
  isMuted,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onSkip,
  playbackRate,
  onRateChange,
  onToggleFullscreen,
  formatTime,
  showControls,
  children,
}: VideoControlsProps) {
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  return (
    <div
      className={`absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress Slider with Adaptive Buffer Indicator */}
      <div className="relative w-full flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-zinc-800 rounded-lg overflow-hidden pointer-events-none">
          <div
            className="h-full bg-zinc-600 transition-all duration-150"
            style={{ width: `${bufferedPercent}%` }}
          />
        </div>
        <input
          data-testid="video-progress"
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={onSeek}
          className="relative z-10 w-full h-1.5 bg-transparent rounded-lg appearance-none cursor-pointer accent-orbit-500"
        />
      </div>

      <div className="flex items-center justify-between text-white text-xs md:text-sm">
        {/* Left Controls */}
        <div className="flex items-center gap-3">
          <button
            data-testid="video-play-btn"
            onClick={onTogglePlay}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>

          <button
            onClick={() => onSkip(-10)}
            className="p-1.5 text-zinc-300 hover:text-white transition-colors"
            title="-10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSkip(10)}
            className="p-1.5 text-zinc-300 hover:text-white transition-colors"
            title="+10s"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="text-zinc-300 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className="w-16 md:w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
            />
          </div>

          {/* Timestamps */}
          <span className="text-xs text-zinc-300 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right Controls (Subtitles, Speed, Fullscreen) */}
        <div className="flex items-center gap-3">
          {children}

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
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
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Tela Cheia"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
