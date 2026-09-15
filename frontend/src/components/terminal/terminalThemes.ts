export const DARK_TERMINAL_THEME = {
  background: '#090d13',
  foreground: '#e6edf3',
  cursor: '#a855f7',
  cursorAccent: '#090d13',
  selectionBackground: '#388bfd55',
  selectionForeground: '#ffffff',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#ffffff',
};

export const LIGHT_TERMINAL_THEME = {
  background: '#ffffff',
  foreground: '#0f172a',
  cursor: '#6366f1',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(99,102,241,0.25)',
  selectionForeground: '#000000',
  black: '#1e293b',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#64748b',
  brightBlack: '#475569',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#0f172a',
};

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ContextMenuPosition {
  x: number;
  y: number;
}
