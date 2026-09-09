import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { OrbitLogo } from './OrbitLogo';

interface UserAvatarProps {
  size?: number;
  className?: string;
  showGlow?: boolean;
  alt?: string;
}

export function UserAvatar({
  size = 24,
  className = '',
  showGlow = false,
  alt = 'Avatar do Usuário',
}: UserAvatarProps) {
  const { customAvatar } = useTheme();
  const [imageError, setImageError] = useState(false);

  if (customAvatar && !imageError) {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`relative shrink-0 rounded-2xl overflow-hidden flex items-center justify-center bg-zinc-900 border border-border/80 ${
          showGlow ? 'shadow-lg shadow-orbit-500/20' : ''
        } ${className}`}
      >
        <img
          src={customAvatar}
          alt={alt}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-2xl select-none"
        />
      </div>
    );
  }

  return (
    <OrbitLogo
      size={size}
      className={`${showGlow ? 'shadow-lg shadow-orbit-500/20' : ''} ${className}`}
    />
  );
}
