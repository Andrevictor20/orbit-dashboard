import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, X } from 'lucide-react';
import type { UserPublicProfile } from '../UsersTab';

interface ResetPasswordModalProps {
  user: UserPublicProfile;
  resetPassword: string;
  setResetPassword: (val: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function ResetPasswordModal({
  user,
  resetPassword,
  setResetPassword,
  isSubmitting,
  onSubmit,
  onClose,
}: ResetPasswordModalProps) {
  const { t } = useTranslation();

  const content = (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border/90 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-saturn-500/10 border border-saturn-500/25 flex items-center justify-center text-saturn-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-primary">
                {t('users.reset_password_title', 'Redefinir Senha')}
              </h4>
              <p className="text-xs text-secondary mt-0.5">
                @{user.username} {user.display_name ? `• ${user.display_name}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary rounded-xl hover:bg-accent/60 transition-colors"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-secondary mb-2">
              {t('users.new_password', 'Nova Senha')} *
            </label>
            <input
              type="password"
              required
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 text-sm bg-accent/30 border border-border/80 rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-saturn-500/30 focus:border-saturn-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm text-secondary hover:text-primary hover:bg-accent/50 font-medium rounded-xl transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-saturn-500 hover:bg-saturn-600 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-saturn-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('users.reset', 'Redefinir Senha')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

