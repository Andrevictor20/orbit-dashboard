import React from 'react';
import { useTranslation } from 'react-i18next';
import { Home, AlertCircle, Loader2, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';

interface HAConnectViewProps {
  urlInput: string;
  setUrlInput: (v: string) => void;
  tokenInput: string;
  setTokenInput: (v: string) => void;
  showToken: boolean;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;
  isConnecting: boolean;
  connectError: string | null;
  onConnect: (e: React.FormEvent) => void;
}

export function HAConnectView({
  urlInput,
  setUrlInput,
  tokenInput,
  setTokenInput,
  showToken,
  setShowToken,
  isConnecting,
  connectError,
  onConnect,
}: HAConnectViewProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-saturn-500/10 text-saturn-400 border border-saturn-500/20 shadow-sm">
            <Home className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              {t('homeassistant.title')}
            </h1>
            <p className="text-sm text-secondary">
              {t('homeassistant.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-card/55 backdrop-blur-3xl saturate-[190%] border border-border/70 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-saturn-500/15 blur-3xl pointer-events-none" />

          <h2 className="text-lg font-semibold text-primary mb-1">
            {t('homeassistant.connect_title')}
          </h2>
          <p className="text-xs text-secondary mb-6">
            {t('homeassistant.connect_subtitle')}
          </p>

          {connectError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-start gap-3 text-xs leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{connectError}</span>
            </div>
          )}

          <form onSubmit={onConnect} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                {t('homeassistant.url_label')}
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t('homeassistant.url_placeholder')}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border/80 bg-background/70 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-saturn-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                {t('homeassistant.token_label')}
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t('homeassistant.token_placeholder')}
                  required
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border/80 bg-background/70 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-saturn-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors p-1"
                  title={showToken ? t('homeassistant.hide_token') : t('homeassistant.show_token')}
                  aria-label={showToken ? t('homeassistant.hide_token') : t('homeassistant.show_token')}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isConnecting || !urlInput.trim() || !tokenInput.trim()}
              className="w-full py-3 px-4 rounded-xl bg-saturn-500 hover:bg-saturn-600 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-saturn-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('homeassistant.connecting')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('homeassistant.connect_button')}</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 bg-card/60 backdrop-blur-xl border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-saturn-500" />
            <h3>{t('homeassistant.how_to_get_token')}</h3>
          </div>

          <div className="space-y-3.5 text-xs text-secondary leading-relaxed">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-saturn-500/20 text-saturn-700 dark:text-saturn-400 font-bold shrink-0">
                1
              </span>
              <p>{t('homeassistant.step_1')}</p>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-saturn-500/20 text-saturn-700 dark:text-saturn-400 font-bold shrink-0">
                2
              </span>
              <p>{t('homeassistant.step_2')}</p>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/40 border border-border/50">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-saturn-500/20 text-saturn-700 dark:text-saturn-400 font-bold shrink-0">
                3
              </span>
              <p>{t('homeassistant.step_3')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
