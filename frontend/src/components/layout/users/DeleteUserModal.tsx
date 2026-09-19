import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, X } from 'lucide-react';
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

  const content = (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border/90 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-rose-400">
                {t('users.confirm_delete_title', 'Excluir Usuário')}
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

        <div className="p-6 space-y-5">
          <p className="text-sm text-secondary leading-relaxed">
            {t('users.confirm_delete_desc', 'Tem certeza que deseja excluir a conta de')}{' '}
            <strong className="text-primary font-semibold">@{user.username}</strong>?{' '}
            <span className="text-rose-400/90 font-medium">
              {t('users.confirm_delete_warn', 'Esta ação é irreversível e removerá todos os acessos associados.')}
            </span>
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm text-secondary hover:text-primary hover:bg-accent/50 font-medium rounded-xl transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('common.delete', 'Excluir Definitivamente')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

