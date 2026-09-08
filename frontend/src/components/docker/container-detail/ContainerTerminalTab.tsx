import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Copy, ClipboardPaste, Trash2 } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import toast from 'react-hot-toast';
import '@xterm/xterm/css/xterm.css';

interface ContainerTerminalTabProps {
  id: string;
}

export function ContainerTerminalTab({ id }: ContainerTerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.innerHTML = '';

    const term = new XTerm({
      theme: {
        background: '#090d13',
        foreground: '#e6edf3',
        cursor: '#10b981',
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
        white: '#ffffff',
      },
      fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    requestAnimationFrame(() => fitAddon.fit());

    xtermRef.current = term;

    let sessionBuffer = '';
    try {
      const saved = sessionStorage.getItem(`orbit_term_history_${id}`);
      if (saved) {
        sessionBuffer = saved;
        term.write(saved);
        term.writeln('\r\n\x1b[33m--- Contexto restaurado da sessão anterior (F5) ---\x1b[0m');
      }
    } catch {}

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/docker/containers/${id}/exec`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const sendResize = (cols: number, rows: number) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) {
        if (term.hasSelection() || event.shiftKey) {
          const selected = term.getSelection();
          if (selected) {
            navigator.clipboard.writeText(selected).then(() => toast.success('Copiado!')).catch(() => {});
            return false;
          }
        }
      }
      if (isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) {
        navigator.clipboard.readText().then(text => {
          if (text && ws.readyState === WebSocket.OPEN) ws.send(text);
        }).catch(() => {});
        return false;
      }
      return true;
    });

    ws.onopen = () => {
      term.writeln('\x1b[1;32mConectado ao shell do container...\x1b[0m');
      sendResize(term.cols, term.rows);
    };

    ws.onmessage = (event) => {
      term.write(event.data);
      sessionBuffer = (sessionBuffer + event.data).slice(-30000);
      try {
        sessionStorage.setItem(`orbit_term_history_${id}`, sessionBuffer);
      } catch {}
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[1;31mConexão encerrada.\x1b[0m');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    term.onResize(({ cols, rows }) => sendResize(cols, rows));

    const handleResize = () => {
      fitAddon.fit();
      sendResize(term.cols, term.rows);
    };
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => handleResize());
    observer.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      term.dispose();
      xtermRef.current = null;
    };
  }, [id]);

  return (
    <div className="flex-1 glass-panel rounded-xl p-0 border border-border flex flex-col overflow-hidden min-h-[500px]">
      <div className="bg-black/50 p-3 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-primary">Shell TTY do Container (sh)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (xtermRef.current) {
                const sel = xtermRef.current.getSelection();
                if (sel) {
                  navigator.clipboard.writeText(sel).then(() => toast.success('Copiado!')).catch(() => {});
                } else {
                  toast('Selecione um texto para copiar');
                }
              }
            }}
            className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2.5 py-1 rounded transition-colors"
            title="Copiar Seleção"
          >
            <Copy className="w-3 h-3" />
            <span>Copiar</span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.readText().then(text => {
                if (text && wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(text);
                  toast.success('Conteúdo colado!');
                }
              }).catch(() => toast.error('Permissão necessária para colar'));
            }}
            className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2.5 py-1 rounded transition-colors"
            title="Colar da Área de Transferência"
          >
            <ClipboardPaste className="w-3 h-3" />
            <span>Colar</span>
          </button>
          <button
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
                try {
                  sessionStorage.removeItem(`orbit_term_history_${id}`);
                } catch {}
              }
            }}
            className="text-xs flex items-center gap-1 bg-accent hover:bg-orbit-700 text-secondary hover:text-white px-2 py-1 rounded transition-colors"
            title="Limpar Terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-[#090d13] p-2">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
