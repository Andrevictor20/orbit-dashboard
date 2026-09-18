interface SubtitleOverlayProps {
  currentCue: string;
}

export function SubtitleOverlay({ currentCue }: SubtitleOverlayProps) {
  if (!currentCue) return null;

  return (
    <div 
      data-testid="subtitle-overlay"
      className="absolute bottom-14 sm:bottom-16 inset-x-4 flex justify-center pointer-events-none z-15 select-none"
    >
      <div 
        className="bg-black/85 text-white font-medium text-sm sm:text-base md:text-lg px-3.5 py-1.5 rounded-lg text-center max-w-2xl shadow-2xl border border-white/10 backdrop-blur-sm whitespace-pre-line"
        style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)',
        }}
      >
        {currentCue}
      </div>
    </div>
  );
}
