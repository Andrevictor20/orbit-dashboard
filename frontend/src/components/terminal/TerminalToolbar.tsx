import { useTranslation } from 'react-i18next';
import { 
  Terminal as TerminalIcon, Copy, ClipboardPaste, 
  Trash2, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, LogOut 
} from 'lucide-react';
import type { ConnectionState } from './terminalThemes';

interface TerminalToolbarProps {
  connState: ConnectionState;
  username: string;
  host: string;
  port: number;
  dimensions: { cols: number; rows: number };
  fontSize: number;
  isFullscreen: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onChangeFontSize: (delta: number) => void;
  onToggleFullscreen: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}

export function TerminalToolbar({
  connState,
  username,
  host,
  port,
  dimensions,
  fontSize,
  isFullscreen,
  onCopy,
  onPaste,
  onClear,
  onChangeFontSize,
  onToggleFullscreen,
  onDisconnect,
  onReconnect,
}: TerminalToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="h-10 bg-card border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 select-none">
      {/* Left: Indicator & Host info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full transition-colors ${
            connState === 'connected'
              ? 'bg-emerald-500 animate-pulse'
              : connState === 'connecting'
              ? 'bg-amber-500 animate-ping'
              : 'bg-muted-foreground'
          }`} />
          <TerminalIcon className="w-3.5 h-3.5 text-orbit-500 shrink-0" />
        </div>

        <div className="flex items-center gap-2 min-w-0 font-mono">
          <span className="text-xs font-semibold text-primary truncate">
            {connState === 'connected' ? `${username}@${host}:${port}` : 'Orbit Terminal Shell'}
          </span>
          {connState === 'connected' && (
            <span className="text-[11px] font-mono text-secondary px-2 py-0.5 rounded-md bg-accent border border-border/60 hidden md:inline-block">
              {dimensions.cols}x{dimensions.rows}
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions Toolbar */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Copy button */}
        <button
          onClick={onCopy}
          className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1"
          title={t('terminal.copy_tip', 'Copiar texto selecionado (Ctrl+Shift+C ou Ctrl+C)')}
          aria-label={t('terminal.copy_selected_aria', 'Copiar texto selecionado')}
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">{t('terminal.copy_selected', 'Copiar')}</span>
        </button>

        {/* Paste button */}
        <button
          onClick={onPaste}
          className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1"
          title={t('terminal.paste_tip', 'Colar da área de transferência (Ctrl+V)')}
          aria-label={t('terminal.paste_selected_aria', 'Colar da área de transferência')}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">{t('terminal.paste_selected', 'Colar')}</span>
        </button>

        {/* Clear button */}
        <button
          onClick={onClear}
          className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs flex items-center gap-1"
          title={t('terminal.clear_terminal', 'Limpar terminal')}
          aria-label={t('terminal.clear_terminal', 'Limpar terminal')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Font Zoom Out */}
        <button
          onClick={() => onChangeFontSize(-1)}
          className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs"
          title={t('terminal.decrease_font', 'Diminuir fonte')}
          aria-label={t('terminal.decrease_font', 'Diminuir fonte')}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] font-mono text-secondary px-1 hidden sm:inline">{fontSize}px</span>

        {/* Font Zoom In */}
        <button
          onClick={() => onChangeFontSize(1)}
          className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors text-xs"
          title={t('terminal.increase_font', 'Aumentar fonte')}
          aria-label={t('terminal.increase_font', 'Aumentar fonte')}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className={`p-1.5 rounded-lg transition-colors text-xs ${
            isFullscreen ? 'text-orbit-500 bg-orbit-500/20 font-semibold' : 'text-secondary hover:text-primary hover:bg-accent'
          }`}
          title={isFullscreen ? t('terminal.exit_fullscreen', 'Sair da Tela Cheia (Esc)') : t('terminal.enter_fullscreen', 'Expandir em Tela Cheia')}
          aria-label={t('terminal.toggle_fullscreen', 'Alternar tela cheia')}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Disconnect/Reconnect Button */}
        {connState === 'connected' ? (
          <button
            onClick={onDisconnect}
            className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ml-1 shadow-sm"
            title={t('terminal.disconnect_ssh', 'Desconectar sessão SSH')}
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">{t('terminal.disconnect_ssh', 'Desconectar')}</span>
          </button>
        ) : connState === 'disconnected' || connState === 'error' ? (
          <button
            onClick={onReconnect}
            className="px-2.5 py-1 bg-orbit-500/20 hover:bg-orbit-500/30 text-orbit-600 dark:text-orbit-300 border border-orbit-500/40 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ml-1 shadow-sm"
            title={t('terminal.reconnect_ssh', 'Reconectar ao SSH')}
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">{t('terminal.reconnect_ssh', 'Reconectar')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
