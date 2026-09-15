import { Copy, ClipboardPaste, CornerDownLeft, Trash2, Minimize2, Maximize2 } from 'lucide-react';
import type { ContextMenuPosition } from './terminalThemes';

interface TerminalContextMenuProps {
  contextMenu: ContextMenuPosition | null;
  isFullscreen: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onToggleFullscreen: () => void;
}

export function TerminalContextMenu({
  contextMenu,
  isFullscreen,
  onCopy,
  onPaste,
  onSelectAll,
  onClear,
  onToggleFullscreen,
}: TerminalContextMenuProps) {
  if (!contextMenu) return null;

  return (
    <div 
      style={{ top: `${contextMenu.y - 40}px`, left: `${contextMenu.x - 20}px` }}
      className="fixed z-50 bg-card/95 border border-border rounded-xl shadow-2xl p-1.5 min-w-[190px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onCopy}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-primary hover:bg-accent rounded-lg transition-colors text-left"
      >
        <span className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copiar</span>
        <span className="text-[10px] text-secondary font-mono">Ctrl+C</span>
      </button>
      <button
        onClick={onPaste}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-primary hover:bg-accent rounded-lg transition-colors text-left"
      >
        <span className="flex items-center gap-2"><ClipboardPaste className="w-3.5 h-3.5" /> Colar</span>
        <span className="text-[10px] text-secondary font-mono">Ctrl+V</span>
      </button>
      <button
        onClick={onSelectAll}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-primary hover:bg-accent rounded-lg transition-colors text-left"
      >
        <span className="flex items-center gap-2"><CornerDownLeft className="w-3.5 h-3.5" /> Selecionar Tudo</span>
        <span className="text-[10px] text-secondary font-mono">Ctrl+A</span>
      </button>
      <div className="h-px bg-border/60 my-1" />
      <button
        onClick={onClear}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-accent rounded-lg transition-colors text-left"
      >
        <Trash2 className="w-3.5 h-3.5" /> Limpar Tela
      </button>
      <button
        onClick={onToggleFullscreen}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-accent rounded-lg transition-colors text-left"
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        {isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
      </button>
    </div>
  );
}
