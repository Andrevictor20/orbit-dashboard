import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTranslation } from 'react-i18next';
import { Lock, User, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export function Terminal() {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const connect = () => {
    if (!username || !password) {
       setErrorMessage('Preencha usuário e senha para acesso SSH.');
       return;
    }
    
    setConnState('connecting');
    setErrorMessage('');

    setTimeout(() => {
      initTerminal();
    }, 100);
  };

  const initTerminal = () => {
    if (!terminalRef.current) return;

    if (xtermRef.current) {
      xtermRef.current.dispose();
    }

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#8b5cf6',
        selectionBackground: '#262626',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;36mOrbit Web Terminal\x1b[0m');
    term.writeln('Connecting via SSH...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ssh`);
    
    ws.onopen = () => {
      // Send init message
      ws.send(JSON.stringify({
        user: username,
        pass: password,
      }));
      setConnState('connected');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31mWebSocket Error\x1b[0m');
      setConnState('error');
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[1;33mDisconnected from server.\x1b[0m');
      setConnState('idle');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    wsRef.current = ws;

    const handleResize = () => {
      fitAddon.fit();
    };
    
    window.addEventListener('resize', handleResize);
  };

  useEffect(() => {
    return () => {
      if (xtermRef.current) xtermRef.current.dispose();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-8rem)] flex flex-col animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">{t('sidebar.terminal')}</h2>
        <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1">Acesso seguro ao host do sistema</p>
      </div>

      {connState === 'idle' || connState === 'error' ? (
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="glass-panel p-5 sm:p-8 rounded-xl w-full max-w-md border border-border shadow-2xl">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-card/50 flex items-center justify-center border border-border">
                <TerminalIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-center mb-1.5 sm:mb-2 text-primary">Conexão SSH</h3>
            <p className="text-secondary text-xs sm:text-sm text-center mb-4 sm:mb-6">Autentique-se com seu usuário e senha para obter acesso seguro ao sistema.</p>
            
            {errorMessage && (
              <div className="mb-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); connect(); }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary">Usuário</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-black/50 border border-border rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder="pi"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-border rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button 
                type="submit"
                className="w-full bg-orbit-600 hover:bg-orbit-500 text-white font-medium py-2 rounded-md transition-all active:scale-[0.98] mt-2 shadow-sm"
              >
                Conectar via SSH
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div 
          className="flex-1 w-full bg-[#0a0a0a] border shad-border rounded-md p-4 overflow-hidden shadow-inner relative"
        >
          <div ref={terminalRef} className="w-full h-full" />
          <button 
            onClick={() => {
              if (wsRef.current) wsRef.current.close();
            }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-rose-500/80 text-white text-xs px-3 py-1 rounded transition-colors z-10"
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
