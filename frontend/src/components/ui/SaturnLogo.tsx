import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export interface SaturnLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: 'auto' | 'light' | 'dark';
  mode?: 'auto' | 'light' | 'dark';
  colorOverride?: 'zinc' | 'rose' | 'blue' | 'green' | 'catppuccin' | 'tokyonight' | 'oled' | 'wallpaper' | string;
  theme?: 'zinc' | 'rose' | 'blue' | 'green' | 'catppuccin' | 'tokyonight' | 'oled' | 'wallpaper' | string;
  className?: string;
  withBackground?: boolean;
}

interface ThemePalette {
  bg: string;
  coreStart: string;
  coreEnd: string;
  ring1: string;
  ring2: string;
  planet: string;
  accent: string;
  shadow: string;
}

const PALETTES: Record<string, { light: ThemePalette; dark: ThemePalette }> = {
  oled: {
    light: {
      bg: '#ffffff',
      coreStart: '#18181b',
      coreEnd: '#09090b',
      ring1: '#27272a',
      ring2: '#52525b',
      planet: '#09090b',
      accent: '#71717a',
      shadow: 'rgba(0, 0, 0, 0.25)',
    },
    dark: {
      bg: '#000000',
      coreStart: '#e4e4e7',
      coreEnd: '#a1a1aa',
      ring1: '#71717a',
      ring2: '#3f3f46',
      planet: '#e4e4e7',
      accent: '#a1a1aa',
      shadow: 'rgba(255, 255, 255, 0.15)',
    },
  },
  zinc: {
    light: {
      bg: '#ffffff',
      coreStart: '#6366f1',
      coreEnd: '#4f46e5',
      ring1: '#0f172a',
      ring2: '#64748b',
      planet: '#4f46e5',
      accent: '#818cf8',
      shadow: 'rgba(79, 70, 229, 0.25)',
    },
    dark: {
      bg: '#09090b',
      coreStart: '#818cf8',
      coreEnd: '#6366f1',
      ring1: '#e2e8f0',
      ring2: '#94a3b8',
      planet: '#6366f1',
      accent: '#c7d2fe',
      shadow: 'rgba(99, 102, 241, 0.4)',
    },
  },
  catppuccin: {
    light: {
      bg: '#ffffff',
      coreStart: '#8839ef',
      coreEnd: '#ea76cb',
      ring1: '#1e66f5',
      ring2: '#04a5e5',
      planet: '#8839ef',
      accent: '#7287fd',
      shadow: 'rgba(136, 57, 239, 0.25)',
    },
    dark: {
      bg: '#181825',
      coreStart: '#cba6f7',
      coreEnd: '#f5c2e7',
      ring1: '#89b4fa',
      ring2: '#94e2d5',
      planet: '#cba6f7',
      accent: '#b4befe',
      shadow: 'rgba(203, 166, 247, 0.35)',
    },
  },
  tokyonight: {
    light: {
      bg: '#ffffff',
      coreStart: '#3760bf',
      coreEnd: '#9854f1',
      ring1: '#007197',
      ring2: '#6172b0',
      planet: '#3760bf',
      accent: '#2e7de9',
      shadow: 'rgba(55, 96, 191, 0.25)',
    },
    dark: {
      bg: '#1f2335',
      coreStart: '#7aa2f7',
      coreEnd: '#bb9af7',
      ring1: '#2ac3de',
      ring2: '#7dcfff',
      planet: '#7aa2f7',
      accent: '#b4f9f8',
      shadow: 'rgba(122, 162, 247, 0.35)',
    },
  },
  rose: {
    light: {
      bg: '#ffffff',
      coreStart: '#f43f5e',
      coreEnd: '#e11d48',
      ring1: '#9f1239',
      ring2: '#fb7185',
      planet: '#e11d48',
      accent: '#fda4af',
      shadow: 'rgba(225, 29, 72, 0.25)',
    },
    dark: {
      bg: '#4c0519',
      coreStart: '#fb7185',
      coreEnd: '#f43f5e',
      ring1: '#ffe4e6',
      ring2: '#fda4af',
      planet: '#f43f5e',
      accent: '#fff1f2',
      shadow: 'rgba(244, 63, 94, 0.35)',
    },
  },
  blue: {
    light: {
      bg: '#ffffff',
      coreStart: '#0ea5e9',
      coreEnd: '#0284c7',
      ring1: '#0369a1',
      ring2: '#38bdf8',
      planet: '#0284c7',
      accent: '#7dd3fc',
      shadow: 'rgba(2, 132, 199, 0.25)',
    },
    dark: {
      bg: '#082f49',
      coreStart: '#38bdf8',
      coreEnd: '#0ea5e9',
      ring1: '#e0f2fe',
      ring2: '#7dd3fc',
      planet: '#0ea5e9',
      accent: '#bae6fd',
      shadow: 'rgba(14, 165, 233, 0.35)',
    },
  },
  green: {
    light: {
      bg: '#ffffff',
      coreStart: '#22c55e',
      coreEnd: '#16a34a',
      ring1: '#15803d',
      ring2: '#4ade80',
      planet: '#16a34a',
      accent: '#86efac',
      shadow: 'rgba(22, 163, 74, 0.25)',
    },
    dark: {
      bg: '#052e16',
      coreStart: '#4ade80',
      coreEnd: '#22c55e',
      ring1: '#dcfce7',
      ring2: '#86efac',
      planet: '#22c55e',
      accent: '#bbf7d0',
      shadow: 'rgba(34, 197, 94, 0.35)',
    },
  },
};

export function SaturnLogo({
  size = 28,
  variant = 'auto',
  mode,
  colorOverride,
  theme,
  className = '',
  withBackground = true,
  ...props
}: SaturnLogoProps) {
  let themeContext: { theme?: string; color?: string } | null = null;
  try {
    themeContext = useTheme();
  } catch {
    // Allows SaturnLogo to be rendered outside of ThemeProvider
  }

  const effectiveTheme = theme || colorOverride || (themeContext?.color as any) || 'zinc';
  const effectiveMode = mode || variant;

  const isDark = effectiveMode === 'auto'
    ? ((themeContext?.theme === 'dark') || (themeContext?.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches))
    : effectiveMode === 'dark';

  const paletteGroup = PALETTES[effectiveTheme] || PALETTES.zinc;
  const p = isDark ? paletteGroup.dark : paletteGroup.light;

  const gradId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-all duration-300 ${className}`}
      {...props}
    >
      <defs>
        {/* Core Planet Gradient */}
        <linearGradient id={`saturn-core-${gradId}`} x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor={p.coreStart} />
          <stop offset="100%" stopColor={p.coreEnd} />
        </linearGradient>

        {/* Outer Ring Gradient */}
        <linearGradient id={`saturn-ring-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.ring1} stopOpacity="0.9" />
          <stop offset="50%" stopColor={p.ring2} stopOpacity="0.3" />
          <stop offset="100%" stopColor={p.ring1} stopOpacity="0.9" />
        </linearGradient>

        {/* Glow Shadow */}
        <filter id={`saturn-shadow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={p.shadow} floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Rounded Container Background if requested */}
      {withBackground && (
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="24"
          fill={p.bg}
          stroke={p.ring2}
          strokeOpacity={isDark ? "0.3" : "0.4"}
          strokeWidth="2"
        />
      )}

      {/* Main Orbital Plane (Tilted Ellipse behind planet) */}
      <g filter={`url(#saturn-shadow-${gradId})`}>
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="14"
          transform="rotate(-30 50 50)"
          stroke={`url(#saturn-ring-${gradId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Secondary Inner Ring Accent */}
        <ellipse
          cx="50"
          cy="50"
          rx="26"
          ry="8.5"
          transform="rotate(-30 50 50)"
          stroke={p.accent}
          strokeOpacity={isDark ? "0.6" : "0.5"}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Satellite Moon 1 */}
        <circle
          cx="20"
          cy="33"
          r="3"
          fill={p.accent}
          stroke={p.bg}
          strokeWidth="1.5"
        />

        {/* Satellite Moon 2 */}
        <circle
          cx="78"
          cy="65"
          r="4"
          fill={p.ring1}
          stroke={p.bg}
          strokeWidth="1.5"
        />

        {/* Central Core Planet */}
        <circle
          cx="50"
          cy="50"
          r="19"
          fill={`url(#saturn-core-${gradId})`}
        />

        {/* Planet Surface Depth Ring / Shine */}
        <path
          d="M37 40 C 42 34, 58 34, 63 40"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Orbital Foreground Overlay (makes the ring wrap nicely around the front) */}
        <path
          d="M 22 66 A 38 14 0 0 0 78 34"
          transform="rotate(-30 50 50)"
          stroke={`url(#saturn-ring-${gradId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

