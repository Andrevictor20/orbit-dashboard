import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2 } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
        <h4 className="text-sm font-bold text-primary flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-saturn-500" />
          {t('users.reset_password_for', 'Redefinir Senha de')} @{user.username}
        </h4>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">
              {t('users.new_password', 'Nova Senha')}
            </label>
            <input
              type="password"
              required
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 text-xs bg-accent/40 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-saturn-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-secondary hover:text-primary rounded-xl"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-saturn-500 hover:bg-saturn-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('users.reset', 'Redefinir')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
