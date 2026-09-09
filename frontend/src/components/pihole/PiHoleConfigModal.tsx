import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Globe,
  Key,
  Eye,
  EyeOff,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PiHoleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (url: string, token: string) => Promise<void>;
  initialUrl?: string;
}

export function PiHoleConfigModal({
  isOpen,
  onClose,
  onConnect,
  initialUrl = '',
}: PiHoleConfigModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      toast.error(t('pihole.url_required'));
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      toast.error(t('pihole.url_invalid_protocol'));
      return;
    }

    try {
      setIsConnecting(true);
      await onConnect(cleanUrl, token.trim());
      toast.success(t('pihole.connected_success'));
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('pihole.connect_failed'));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border shad-border bg-surface dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">
                {t('pihole.connect_modal_title')}
              </h2>
              <p className="text-xs text-secondary">
                {t('pihole.connect_modal_subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-orbit-500" />
              <span>{t('pihole.url_label')}</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.100 ou http://pi.hole"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-surface dark:bg-zinc-800/90 border border-border focus:border-orbit-500 focus:outline-none transition-colors font-mono"
            />
            <p className="text-[11px] text-secondary">
              {t('pihole.url_hint')}
            </p>
          </div>

          {/* Token Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('pihole.token_label')}</span>
              </span>
              <span className="text-[10px] text-secondary font-normal">
                {t('pihole.token_optional_hint')}
              </span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('pihole.token_placeholder')}
                className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-surface dark:bg-zinc-800/90 border border-border focus:border-orbit-500 focus:outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Help Toggle */}
          <div className="rounded-xl border border-border/40 bg-zinc-50 dark:bg-zinc-800/40 p-3">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-orbit-500" />
                <span>{t('pihole.how_to_get_token')}</span>
              </span>
              {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHelp && (
              <div className="mt-3 text-[11px] text-secondary space-y-1.5 border-t border-border/40 pt-2.5">
                <p>1. {t('pihole.help_step_1')}</p>
                <p>2. {t('pihole.help_step_2')}</p>
                <p>3. {t('pihole.help_step_3')}</p>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-orbit-600 hover:bg-orbit-500 shadow-md shadow-orbit-500/20 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('pihole.testing_connection')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('pihole.connect_button')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
