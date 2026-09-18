import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { UserPublicProfile } from '../UsersTab';

interface DeleteUserModalProps {
  user: UserPublicProfile;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteUserModal({
  user,
  isSubmitting,
  onConfirm,
  onClose,
}: DeleteUserModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
        <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('users.confirm_delete_title', 'Excluir Usuário')}
        </h4>
        <p className="text-xs text-secondary leading-relaxed">
          {t('users.confirm_delete_desc', 'Tem certeza que deseja excluir a conta de')}{' '}
          <strong className="text-primary">@{user.username}</strong>?{' '}
          {t('users.confirm_delete_warn', 'Esta ação é irreversível.')}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-secondary hover:text-primary rounded-xl"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{t('common.delete', 'Excluir Definitivamente')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
