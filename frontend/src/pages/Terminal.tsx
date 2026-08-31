import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTranslation } from 'react-i18next';
import { 
  Lock, User, Terminal as TerminalIcon, Copy, ClipboardPaste, 
  Trash2, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, 
  LogOut, Server, Globe, ChevronDown, ChevronUp, Check, 
  AlertCircle, ShieldCheck, CornerDownLeft
} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ContextMenuPosition {
  x: number;
  y: number;
}

export function Terminal() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [username, setUsername] = useState(() => localStorage.getItem('orbit_ssh_user') || '');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState(() => localStorage.getItem('orbit_ssh_host') || 'localhost');
  const [port, setPort] = useState<number>(22);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI Controls
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('orbit_terminal_fontsize');
    return saved ? parseInt(saved, 10) : 14;
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  const showNotification = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 2000);
  };

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'resize',
        cols,
        rows
      }));
    }
  }, []);

  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit();
        const cols = xtermRef.current.cols;
        const rows = xtermRef.current.rows;
        setDimensions({ cols, rows });
        sendResize(cols, rows);
      } catch {
        // Ignore fit errors during transitions
      }
    }
  }, [sendResize]);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    // Clean up old instance if exists
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
      fontSize,
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true,
      theme: {
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
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    
    // Slight frame delay to ensure container bounding box is rendered
    requestAnimationFrame(() => {
      fitAddon.fit();
      setDimensions({ cols: term.cols, rows: term.rows });
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Custom Keybindings for Copy/Paste
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Copy: Ctrl+C / Cmd+C (when text is selected) or Ctrl+Shift+C
      if (isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) {
        if (term.hasSelection() || event.shiftKey) {
          const selectedText = term.getSelection();
          if (selectedText) {
            navigator.clipboard.writeText(selectedText)
              .then(() => showNotification('Texto copiado para a área de transferência!'))
              .catch(() => {});
            return false; // Prevent sending ^C interrupt
          }
        }
      }

      // Paste: Ctrl+V / Cmd+V or Ctrl+Shift+V
      if (isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) {
        navigator.clipboard.readText()
          .then((clipText) => {
            if (clipText && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(clipText);
            }
          })
          .catch(() => {
            showNotification('Permissão de clipboard necessária para colar.');
          });
        return false;
      }

      return true;
    });

    // Auto copy on selection if text is selected
    term.onSelectionChange(() => {
      // Keep selection active for toolbar buttons
    });

    term.writeln('\x1b[1;36mOrbit Web Terminal\x1b[0m');
    term.writeln(`Conectando via SSH em \x1b[33m${username}@${host}:${port}\x1b[0m...`);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ssh`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initialization payload with dimensions and credentials
      ws.send(JSON.stringify({
        user: username,
        pass: password,
        host: host.trim() || undefined,
        port: Number(port) || 22,
        cols: term.cols,
        rows: term.rows,
      }));
      setConnState('connected');

      const cwd = searchParams.get('cwd');
      if (cwd) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`cd "${cwd}"\n`);
          }
        }, 500);
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31mErro de conexão com o servidor.\x1b[0m');
      setConnState('error');
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[1;33mSessão SSH finalizada.\x1b[0m');
      setConnState('disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    term.onResize(({ cols, rows }) => {
      setDimensions({ cols, rows });
      sendResize(cols, rows);
    });

    // Setup ResizeObserver for fluid terminal resizing
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    const observer = new ResizeObserver(() => {
      fitTerminal();
    });
    observer.observe(terminalRef.current);
    resizeObserverRef.current = observer;

  }, [username, password, host, port, fontSize, searchParams, sendResize, fitTerminal]);

  const connect = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Preencha o usuário e a senha para acesso SSH.');
      return;
    }

    localStorage.setItem('orbit_ssh_user', username.trim());
    if (host.trim()) localStorage.setItem('orbit_ssh_host', host.trim());

    setConnState('connecting');
    setErrorMessage('');

    setTimeout(() => {
      initTerminal();
    }, 150);
  };

  const disconnect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    setConnState('idle');
  };

  const handleCopy = () => {
    let selected = '';
    if (xtermRef.current) {
      selected = xtermRef.current.getSelection() || '';
    }
    if (!selected && typeof window !== 'undefined' && window.getSelection) {
      selected = window.getSelection()?.toString() || '';
    }

    if (selected) {
      navigator.clipboard.writeText(selected)
        .then(() => showNotification('Texto copiado com sucesso!'))
        .catch(() => showNotification('Erro ao copiar'));
    } else {
      showNotification('Selecione algum texto no terminal para copiar.');
    }
    setContextMenu(null);
  };

  const handlePaste = () => {
    navigator.clipboard.readText()
      .then(text => {
        if (text && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(text);
          showNotification('Conteúdo colado!');
        }
      })
      .catch(() => {
        showNotification('Não foi possível ler a área de transferência.');
      });
    setContextMenu(null);
  };

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      showNotification('Terminal limpo.');
    }
    setContextMenu(null);
  };

  const handleSelectAll = () => {
    if (xtermRef.current) {
      xtermRef.current.selectAll();
    }
    setContextMenu(null);
  };

  const changeFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.max(11, Math.min(24, prev + delta));
      localStorage.setItem('orbit_terminal_fontsize', next.toString());
      if (xtermRef.current) {
        xtermRef.current.options.fontSize = next;
        setTimeout(() => fitTerminal(), 50);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close context menu on window click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Window resize handler
  useEffect(() => {
    const handleWinResize = () => fitTerminal();
    window.addEventListener('resize', handleWinResize);
    return () => {
      window.removeEventListener('resize', handleWinResize);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (xtermRef.current) xtermRef.current.dispose();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [fitTerminal]);

  // Handle Fullscreen Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => fitTerminal(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, fitTerminal]);

  // Re-fit whenever fullscreen toggles
  useEffect(() => {
    setTimeout(() => fitTerminal(), 100);
  }, [isFullscreen, fitTerminal]);

  return (
    <div className={`flex flex-col animate-in fade-in zoom-in-95 duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-[#070a0e] p-3 sm:p-5 w-screen h-screen' 
        : 'h-[calc(100vh-7.5rem)] sm:h-[calc(100vh-8.5rem)] w-full'
    }`}>
      {/* Top Header (only when not in fullscreen) */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">{t('sidebar.terminal')}</h2>
              <span className="px-2 py-0.5 rounded-full bg-orbit-500/15 border border-orbit-500/30 text-orbit-300 text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orbit-400" />
                {t('terminal.secure_ssh')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-secondary mt-0.5">{t('terminal.subtitle')}</p>
          </div>

          {/* Quick connection state indicators */}
          {connState === 'connected' && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {username}@{host}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Terminal Frame */}
      <div className={`flex-1 w-full bg-[#090d13] border border-border/80 rounded-xl overflow-hidden shadow-2xl flex flex-col relative group ${
        isFullscreen ? 'h-full border-orbit-500/40' : ''
      }`}>
        
        {/* Terminal Titlebar */}
        <div className="h-11 bg-[#0d1117] border-b border-border/70 px-3 sm:px-4 flex items-center justify-between gap-2 select-none shrink-0">
          
          {/* Left: Orbit System Badge & Session Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                connState === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : connState === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-zinc-500'
              }`} />
              <TerminalIcon className="w-3.5 h-3.5 text-orbit-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 min-w-0 font-mono">
              <span className="text-xs font-semibold text-zinc-200 truncate">
                {connState === 'connected' ? `${username}@${host}:${port}` : 'Orbit Terminal Shell'}
              </span>
              {connState === 'connected' && (
                <span className="text-[11px] font-mono text-secondary px-2 py-0.5 rounded-md bg-white/5 border border-white/10 hidden md:inline-block">
                  {dimensions.cols}x{dimensions.rows}
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1"
              title="Copiar texto selecionado (Ctrl+Shift+C ou Ctrl+C)"
              aria-label="Copiar texto selecionado"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Copiar</span>
            </button>

            {/* Paste button */}
            <button
              onClick={handlePaste}
              className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1"
              title="Colar da área de transferência (Ctrl+V)"
              aria-label="Colar da área de transferência"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Colar</span>
            </button>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1"
              title="Limpar terminal"
              aria-label="Limpar terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-border/80 mx-0.5" />

            {/* Font Zoom Out */}
            <button
              onClick={() => changeFontSize(-1)}
              className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs"
              title="Diminuir fonte"
              aria-label="Diminuir fonte"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono text-zinc-400 px-1 hidden sm:inline">{fontSize}px</span>

            {/* Font Zoom In */}
            <button
              onClick={() => changeFontSize(1)}
              className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs"
              title="Aumentar fonte"
              aria-label="Aumentar fonte"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-border/80 mx-0.5" />

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 rounded-lg transition-colors text-xs ${
                isFullscreen ? 'text-orbit-400 bg-orbit-500/20' : 'text-secondary hover:text-white hover:bg-white/10'
              }`}
              title={isFullscreen ? "Sair da Tela Cheia (Esc)" : "Expandir em Tela Cheia"}
              aria-label="Alternar tela cheia"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Disconnect/Reconnect Button */}
            {connState === 'connected' ? (
              <button
                onClick={disconnect}
                className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ml-1"
                title="Desconectar sessão SSH"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Desconectar</span>
              </button>
            ) : connState === 'disconnected' || connState === 'error' ? (
              <button
                onClick={() => connect()}
                className="px-2.5 py-1 bg-orbit-500/20 hover:bg-orbit-500/30 text-orbit-300 border border-orbit-500/40 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ml-1"
                title="Reconectar ao SSH"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Reconectar</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Terminal Canvas Container */}
        <div 
          className="flex-1 w-full h-full p-2.5 sm:p-4 overflow-hidden relative"
          onContextMenu={handleContextMenu}
        >
          {/* Xterm Mount Node */}
          <div ref={terminalRef} className="w-full h-full" />

          {/* Floating Toast Notification */}
          {copyFeedback && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-orbit-600/90 text-white text-xs font-medium backdrop-blur-md border border-orbit-400/40 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 z-30">
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Floating Context Menu */}
          {contextMenu && (
            <div 
              style={{ top: `${contextMenu.y - 40}px`, left: `${contextMenu.x - 20}px` }}
              className="fixed z-50 bg-[#161b22]/95 border border-border rounded-xl shadow-2xl p-1.5 min-w-[190px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-orbit-500/20 rounded-lg transition-colors text-left"
              >
                <span className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copiar</span>
                <span className="text-[10px] text-zinc-400 font-mono">Ctrl+C</span>
              </button>
              <button
                onClick={handlePaste}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-orbit-500/20 rounded-lg transition-colors text-left"
              >
                <span className="flex items-center gap-2"><ClipboardPaste className="w-3.5 h-3.5" /> Colar</span>
                <span className="text-[10px] text-zinc-400 font-mono">Ctrl+V</span>
              </button>
              <button
                onClick={handleSelectAll}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-orbit-500/20 rounded-lg transition-colors text-left"
              >
                <span className="flex items-center gap-2"><CornerDownLeft className="w-3.5 h-3.5" /> Selecionar Tudo</span>
                <span className="text-[10px] text-zinc-400 font-mono">Ctrl+A</span>
              </button>
              <div className="h-px bg-border/60 my-1" />
              <button
                onClick={handleClear}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-orbit-500/20 rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar Tela
              </button>
              <button
                onClick={() => { setIsFullscreen(!isFullscreen); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-orbit-500/20 rounded-lg transition-colors text-left"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
              </button>
            </div>
          )}

          {/* Idle / Initial Connection Overlay Form */}
          {connState === 'idle' && (
            <div className="absolute inset-0 bg-[#090d13]/95 backdrop-blur-md flex items-center justify-center p-4 z-20">
              <div className="w-full max-w-md bg-[#161b22] border border-border/90 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-orbit-500/15 border border-orbit-500/30 flex items-center justify-center text-orbit-400 shadow-inner">
                    <TerminalIcon className="w-7 h-7" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-center text-primary mb-1">{t('terminal.ssh_connection', 'Conexão SSH')}</h3>
                <p className="text-xs sm:text-sm text-secondary text-center mb-6">
                  {t('terminal.auth_prompt')}
                </p>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={connect} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">{t('terminal.user')}</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="pi ou root"
                        className="w-full bg-[#0d1117] border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-orbit-500 focus:ring-2 focus:ring-orbit-500/20 transition-all font-mono"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">{t('terminal.password')}</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0d1117] border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-orbit-500 focus:ring-2 focus:ring-orbit-500/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Advanced settings accordion */}
                  <div className="border border-border/60 rounded-xl overflow-hidden bg-black/20">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="w-full px-3.5 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between transition-colors font-medium"
                    >
                      <span className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-orbit-400" />
                        {t('terminal.advanced_settings', 'Configurações Avançadas (Host / Port)')}
                      </span>
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showAdvanced && (
                      <div className="p-3.5 pt-1 border-t border-border/40 grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="text-[11px] text-zinc-400 block mb-1">Host</label>
                          <div className="relative">
                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input
                              type="text"
                              value={host}
                              onChange={e => setHost(e.target.value)}
                              placeholder="localhost"
                              className="w-full bg-[#0d1117] border border-border rounded-lg py-1.5 pl-8 pr-2.5 text-xs text-white focus:outline-none focus:border-orbit-500 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">Port</label>
                          <input
                            type="number"
                            value={port}
                            onChange={e => setPort(Number(e.target.value))}
                            placeholder="22"
                            className="w-full bg-[#0d1117] border border-border rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-orbit-500 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-orbit-600 hover:bg-orbit-500 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-orbit-900/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <TerminalIcon className="w-4 h-4" />
                    <span>{t('terminal.connect')}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Disconnected / Dropped Overlay (retaining terminal history) */}
          {(connState === 'disconnected' || connState === 'error') && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#161b22]/95 border border-border/90 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-md flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200 z-20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-xs font-semibold text-zinc-200">{t('dashboard.disconnected')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => connect()}
                  className="px-3 py-1.5 bg-orbit-600 hover:bg-orbit-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('terminal.reconnect')}
                </button>
                <button
                  onClick={() => setConnState('idle')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {t('common.filter')}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
