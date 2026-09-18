import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { ConnectionState } from './terminalThemes';

interface TerminalDisconnectedBadgeProps {
  connState: ConnectionState;
  onReconnect: () => void;
  onReset: () => void;
}

export function TerminalDisconnectedBadge({
  connState,
  onReconnect,
  onReset,
}: TerminalDisconnectedBadgeProps) {
  const { t } = useTranslation();

  if (connState !== 'disconnected' && connState !== 'error') {
    return null;
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card/95 border border-border rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-md flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200 z-20">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
        <span className="text-xs font-semibold text-primary">{t('dashboard.disconnected')}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onReconnect}
          className="px-3 py-1.5 bg-saturn-600 hover:bg-saturn-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('terminal.reconnect')}
        </button>
        <button
          onClick={onReset}
          className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-secondary hover:text-primary rounded-lg text-xs font-medium transition-colors"
        >
          {t('common.reset', 'Reset')}
        </button>
      </div>
    </div>
  );
}
