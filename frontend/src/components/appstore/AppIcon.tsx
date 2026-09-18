import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface AppIconProps {
  src?: string;
  name?: string;
  id?: string;
  className?: string;
  containerClassName?: string;
  fallbackTextClassName?: string;
}

export function AppIcon({
  src,
  name = '',
  id = '',
  className = 'w-full h-full object-contain',
  containerClassName = '',
  fallbackTextClassName = 'text-xs',
}: AppIconProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    // 1. Tenta fallback no CDN de ícones dashboard (Walkxcode)
    const cleanId = (id || name)
      .toLowerCase()
      .replace(/-play|-bigbear|-official/g, '')
      .replace(/[^a-z0-9-]/g, '')
      .trim();

    const cdnUrl = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${cleanId}.png`;
    if (currentSrc !== cdnUrl && cleanId) {
      setCurrentSrc(cdnUrl);
      return;
    }

    // 2. Fallback gracioso com iniciais estilizadas
    setHasError(true);
  };

  if (!currentSrc || hasError) {
    const trimmed = name.trim();
    const words = trimmed ? trimmed.split(/[\s-_]+/).filter(Boolean) : [];
    const initials =
      words.length > 1
        ? (words[0][0] + words[1][0]).toUpperCase()
        : trimmed.slice(0, 2).toUpperCase();

    return (
      <div
        data-testid="app-icon-fallback"
        className={`w-full h-full rounded-lg bg-gradient-to-br from-saturn-500/20 via-accent to-accent/80 flex items-center justify-center text-primary font-bold ${fallbackTextClassName} select-none shadow-inner ${containerClassName}`}
      >
        {initials ? <span>{initials}</span> : <Package className="w-5 h-5 text-secondary" />}
      </div>
    );
  }

  return (
    <img
      data-testid="app-icon-img"
      src={currentSrc}
      alt=""
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
}
