import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Check } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { getAuthToken } from '../utils/auth';
import {
  DARK_TERMINAL_THEME,
  LIGHT_TERMINAL_THEME,
  TerminalToolbar,
  TerminalContextMenu,
  TerminalAuthDialog,
  TerminalDisconnectedBadge,
} from '../components/terminal';
import type { ConnectionState, ContextMenuPosition } from '../components/terminal';

interface TerminalSessionProps {
  id: string;
  isActive: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onTitleChange: (id: string, title: string) => void;
}

export function TerminalSession({ id, isActive, isFullscreen, onToggleFullscreen, onTitleChange }: TerminalSessionProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isLight, setIsLight] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('light');
  });

  useEffect(() => {
    const checkLight = () => {
      const isDocLight = document.documentElement.classList.contains('light');
      setIsLight(isDocLight);
    };
    checkLight();

    const observer = new MutationObserver(checkLight);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);
  const [searchParams] = useSearchParams();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [username, setUsername] = useState(() => localStorage.getItem('saturn_ssh_user') || '');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState(() => localStorage.getItem('saturn_ssh_host') || 'localhost');
  const [port, setPort] = useState<number>(22);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI Controls
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('saturn_terminal_fontsize');
    return saved ? parseInt(saved, 10) : 14;
  });
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
        rows,
      }));
    }
  }, []);

  const changeFontSize = (delta: number) => {
    const nextSize = Math.max(10, Math.min(24, fontSize + delta));
    setFontSize(nextSize);
    localStorage.setItem('saturn_terminal_fontsize', nextSize.toString());
    localStorage.setItem('saturn_terminal_fontsize', nextSize.toString());
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = nextSize;
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (xtermRef.current) {
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
          setDimensions({ cols: xtermRef.current.cols, rows: xtermRef.current.rows });
        }
      }, 50);
    }
  };

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection)
          .then(() => showNotification('Copiado!'))
          .catch(() => {});
      }
    }
    setContextMenu(null);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: text,
        }));
      }
    } catch {
      showNotification(t('terminal.paste_denied', 'Permissão de colagem negada'));
    }
    setContextMenu(null);
  }, []);

  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    setContextMenu(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.selectAll();
    }
    setContextMenu(null);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Update terminal theme on theme change
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = isLight ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME;
    }
  }, [isLight]);

  const lastModeRef = useRef<'local' | 'ssh'>('local');

  // Connect WebSocket & Terminal / SSH
  const connect = useCallback((e?: React.FormEvent, forceMode?: 'local' | 'ssh') => {
    if (e) e.preventDefault();
    const mode = forceMode || (username.trim() ? 'ssh' : 'local');
    lastModeRef.current = mode;

    if (mode === 'ssh' && !username.trim()) {
      setErrorMessage(t('terminal.user_required', 'Informe o nome de usuário'));
      return;
    }

    setConnState('connecting');
    setErrorMessage('');
    if (mode === 'ssh') {
      localStorage.setItem('saturn_ssh_user', username);
      localStorage.setItem('saturn_ssh_user', username);
      localStorage.setItem('saturn_ssh_host', host);
      localStorage.setItem('saturn_ssh_host', host);
    }

    // Retrieve active JWT token for WebSocket URL query param authentication
    const token = getAuthToken() || '';
    const queryToken = token ? `?token=${encodeURIComponent(token)}` : '';

    // Build WebSocket URL
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${loc.host}/api/terminal/ws${queryToken}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send Terminal/SSH Credentials & configuration
      ws.send(JSON.stringify({
        type: 'connect',
        mode: mode,
        username: username.trim(),
        password: password,
        host: host.trim() || 'localhost',
        port: port || 22,
        cols: xtermRef.current ? xtermRef.current.cols : 80,
        rows: xtermRef.current ? xtermRef.current.rows : 24,
      }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'connected') {
          setConnState('connected');
          const title = mode === 'local' 
            ? 'saturn@host' 
            : `${username}@${host === 'localhost' ? 'saturn' : host}`;
          onTitleChange(id, title);
          if (xtermRef.current) {
            xtermRef.current.focus();
            fitAddonRef.current?.fit();
            sendResize(xtermRef.current.cols, xtermRef.current.rows);
            setDimensions({ cols: xtermRef.current.cols, rows: xtermRef.current.rows });
            if (msg.data) {
              xtermRef.current.write(msg.data);
            }
          }
        } else if (msg.type === 'output') {
          if (xtermRef.current) {
            xtermRef.current.write(msg.data);
          }
        } else if (msg.type === 'error') {
          setConnState('error');
          setErrorMessage(msg.message || t('terminal.connection_failed', 'Falha na conexão SSH'));
          if (xtermRef.current) {
            xtermRef.current.writeln(`\r\n\x1b[31m[ERRO] ${msg.message}\x1b[0m\r\n`);
          }
        }
      } catch {
        // Plaintext fallback
        if (xtermRef.current) {
          xtermRef.current.write(evt.data);
        }
      }
    };

    ws.onclose = (evt) => {
      setConnState(prev => prev === 'connected' ? 'disconnected' : prev);
      if (xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[33m[${t('terminal.session_ended', 'Sessão encerrada (Código: {{code}})', { code: evt.code })}]\x1b[0m\r\n`);
      }
    };

    ws.onerror = () => {
      setConnState('error');
      setErrorMessage(t('terminal.connection_failed', 'Falha ao conectar via WebSocket'));
    };
  }, [username, password, host, port, id, onTitleChange, sendResize, t]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnState('disconnected');
    onTitleChange(id, 'Desconectado');
  }, [id, onTitleChange]);

  // Init Xterm instance
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: fontSize,
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: 5000,
      theme: isLight ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME,
      allowTransparency: true,
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    setDimensions({ cols: term.cols, rows: term.rows });

    // Handle user keystrokes into WS
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: data,
        }));
      }
    });

    // Resize Observer for fluid terminal resizing
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (!isActive) return;
        try {
          fitAddon.fit();
          if (term.cols && term.rows) {
            setDimensions({ cols: term.cols, rows: term.rows });
            sendResize(term.cols, term.rows);
          }
        } catch {
          // Ignored during unmount
        }
      });
      resizeObserver.observe(terminalRef.current);
      resizeObserverRef.current = resizeObserver;
    }

    // Direct auto-connect if query param has autoconnect
    if (searchParams.get('autoconnect') === 'true' && username) {
      connect();
    }

    return () => {
      resizeObserver?.disconnect();
      if (wsRef.current) {
        wsRef.current.close();
      }
      term.dispose();
    };
  }, []);

  // When tab becomes active, trigger fit
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (xtermRef.current) {
          xtermRef.current?.focus?.();
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
          setDimensions({ cols: xtermRef.current.cols, rows: xtermRef.current.rows });
        }
      }, 100);
    }
  }, [isActive, sendResize]);

  // When fullscreen changes, trigger fit
  useEffect(() => {
    if (fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (xtermRef.current) {
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
          setDimensions({ cols: xtermRef.current.cols, rows: xtermRef.current.rows });
        }
      }, 150);
    }
  }, [isFullscreen, sendResize]);

  return (
    <div className={`w-full h-full flex flex-col bg-card overflow-hidden ${!isActive ? 'hidden' : ''}`}>
      <div className="flex-1 w-full flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-xl relative">
        {/* Terminal Header Toolbar */}
        <TerminalToolbar
          connState={connState}
          username={username}
          host={host}
          port={port}
          dimensions={dimensions}
          fontSize={fontSize}
          isFullscreen={isFullscreen}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClear={handleClear}
          onChangeFontSize={changeFontSize}
          onToggleFullscreen={onToggleFullscreen}
          onDisconnect={disconnect}
          onReconnect={() => connect()}
        />

        {/* Terminal Canvas Container */}
        <div 
          className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-hidden relative shadow-inner bg-card"
          onContextMenu={handleContextMenu}
        >
          {/* Xterm Mount Node */}
          <div ref={terminalRef} className="w-full h-full" />

          {/* Floating Toast Notification */}
          {copyFeedback && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-saturn-600/90 text-white text-xs font-medium backdrop-blur-md border border-saturn-400/40 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 z-30">
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Floating Context Menu */}
          <TerminalContextMenu
            contextMenu={contextMenu}
            isFullscreen={isFullscreen}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onSelectAll={handleSelectAll}
            onClear={handleClear}
            onToggleFullscreen={onToggleFullscreen}
          />

          {/* Idle / Initial Connection Overlay Form */}
          {connState === 'idle' && (
            <TerminalAuthDialog
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              host={host}
              setHost={setHost}
              port={port}
              setPort={setPort}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              errorMessage={errorMessage}
              onConnect={(e) => connect(e, 'ssh')}
              onConnectInternal={() => connect(undefined, 'local')}
            />
          )}

          {/* Disconnected / Dropped Overlay (retaining terminal history) */}
          <TerminalDisconnectedBadge
            connState={connState}
            onReconnect={() => connect(undefined, lastModeRef.current)}
            onReset={() => setConnState('idle')}
          />
        </div>
      </div>
    </div>
  );
}

export default TerminalSession;
