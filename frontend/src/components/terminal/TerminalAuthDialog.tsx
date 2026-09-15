import React from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as TerminalIcon, User, Lock, Server, Globe, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface TerminalAuthDialogProps {
  username: string;
  setUsername: (u: string) => void;
  password: string;
  setPassword: (p: string) => void;
  host: string;
  setHost: (h: string) => void;
  port: number;
  setPort: (p: number) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  errorMessage: string;
  onConnect: (e: React.FormEvent) => void;
}

export function TerminalAuthDialog({
  username,
  setUsername,
  password,
  setPassword,
  host,
  setHost,
  port,
  setPort,
  showAdvanced,
  setShowAdvanced,
  errorMessage,
  onConnect,
}: TerminalAuthDialogProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-20">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-orbit-500/15 border border-orbit-500/30 flex items-center justify-center text-orbit-500 shadow-inner">
            <TerminalIcon className="w-7 h-7" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-center text-primary mb-1">{t('terminal.ssh_connection', 'Conexão SSH')}</h3>
        <p className="text-xs sm:text-sm text-secondary text-center mb-6">
          {t('terminal.auth_prompt')}
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs sm:text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={onConnect} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-secondary block mb-1.5">{t('terminal.user')}</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="pi ou root"
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-primary focus:outline-none focus:border-orbit-500 focus:ring-2 focus:ring-orbit-500/20 transition-all font-mono shadow-sm"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary block mb-1.5">{t('terminal.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-primary focus:outline-none focus:border-orbit-500 focus:ring-2 focus:ring-orbit-500/20 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Advanced settings accordion */}
          <div className="border border-border rounded-xl overflow-hidden bg-accent/30">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-3.5 py-2.5 text-xs text-secondary hover:text-primary flex items-center justify-between transition-colors font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-orbit-500" />
                {t('terminal.advanced_settings', 'Configurações Avançadas (Host / Port)')}
              </span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="p-3.5 pt-1 border-t border-border/60 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] text-secondary block mb-1">Host</label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary/70" />
                    <input
                      type="text"
                      value={host}
                      onChange={e => setHost(e.target.value)}
                      placeholder="localhost"
                      className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-2.5 text-xs text-primary focus:outline-none focus:border-orbit-500 font-mono shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-secondary block mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(Number(e.target.value))}
                    placeholder="22"
                    className="w-full bg-background border border-border rounded-lg py-1.5 px-2.5 text-xs text-primary focus:outline-none focus:border-orbit-500 font-mono shadow-sm"
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
  );
}
