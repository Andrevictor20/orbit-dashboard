import { useState } from 'react';
import { OrbitLogo } from './OrbitLogo';

interface ContainerIconProps {
  src?: string;
  name?: string;
  image?: string;
  size?: number | string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function ContainerIcon({
  src,
  name = '',
  image = '',
  size = 48,
  className = '',
  loading = 'lazy'
}: ContainerIconProps) {
  const [hasError, setHasError] = useState(false);

  const cleanName = name.toLowerCase();
  const cleanImage = image.toLowerCase();
  const isOrbit = 
    src === '__orbit__' || 
    src?.includes('orbit.png') || 
    cleanName.includes('orbit') || 
    cleanImage.includes('orbit');

  if (isOrbit) {
    return (
      <div className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
        <OrbitLogo size={size} />
      </div>
    );
  }

  // If there is an error or no src provided, render Docker SVG fallback
  if (hasError || !src) {
    return (
      <div 
        className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}
        style={{ width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }}
      >
        <img
          src="/icons/docker.svg"
          alt={name || 'Docker Container'}
          className="w-full h-full object-contain"
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }}
    >
      <img
        src={src}
        alt={name}
        loading={loading}
        className="w-full h-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
