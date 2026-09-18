import { useState } from 'react';
import { SaturnLogo } from './SaturnLogo';

export interface ContainerIconProps {
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
  const isSaturn = 
    src === '__saturn__' ||
    src?.includes('saturn.png') || 
    cleanName.includes('saturn') || 
    cleanImage.includes('saturn');

  if (isSaturn) {
    return (
      <div className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
        <SaturnLogo size={size} />
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
