import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface TwoFactorDisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TwoFactorDisableModal({ isOpen, onClose, onSuccess }: TwoFactorDisableModalProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  if (!isOpen) return null;

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return;

    setDisabling(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Senha incorreta');
      }

      toast.success(t('two_factor.disabled_success', 'Autenticação de 2 Fatores desativada.'));
      setCurrentPassword('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('profile.invalid_current_password', 'Senha atual incorreta'));
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card/95 backdrop-blur-3xl saturate-[190%] border border-border/80 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h2 className="font-bold text-base text-primary">
              {t('two_factor.disable_title', 'Desativar Autenticação de 2 Fatores')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary transition-colors rounded-xl hover:bg-card-hover"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleDisable} className="p-5 space-y-5">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-primary leading-relaxed text-xs">
              {t(
                'two_factor.disable_warning',
                'Ao desativar a autenticação de 2 fatores, sua conta ficará protegida apenas por sua senha.'
              )}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary">
              {t('profile.current_password', 'Senha Atual')}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
              <input
                type="password"
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all font-mono"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-card-hover transition-all"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={disabling || !currentPassword}
              className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-rose-500/20 disabled:opacity-50 active:scale-95"
            >
              {disabling && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('two_factor.confirm_disable', 'Desativar 2FA')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
