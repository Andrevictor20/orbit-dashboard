import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit2, Loader2, User, Shield, X } from 'lucide-react';
import type { UserRole, UserPublicProfile } from '../UsersTab';

interface UserFormModalProps {
  isCreate: boolean;
  editingUser: UserPublicProfile | null;
  formUsername: string;
  setFormUsername: (val: string) => void;
  formDisplayName: string;
  setFormDisplayName: (val: string) => void;
  formPassword: string;
  setFormPassword: (val: string) => void;
  formRole: UserRole;
  setFormRole: (role: UserRole) => void;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function UserFormModal({
  isCreate,
  editingUser,
  formUsername,
  setFormUsername,
  formDisplayName,
  setFormDisplayName,
  formPassword,
  setFormPassword,
  formRole,
  setFormRole,
  isSubmitting,
  onSubmit,
  onClose,
}: UserFormModalProps) {
  const { t } = useTranslation();

  const content = (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border/90 rounded-3xl w-full max-w-lg sm:max-w-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-accent/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-saturn-500/10 border border-saturn-500/25 flex items-center justify-center text-saturn-400">
              {isCreate ? <UserPlus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-base font-bold text-primary">
                {isCreate 
                  ? t('users.create_title', 'Criar Novo Usuário') 
                  : `${t('users.edit_title', 'Editar Usuário')} (@${editingUser?.username})`}
              </h4>
              <p className="text-xs text-secondary mt-0.5">
                {isCreate 
                  ? t('users.create_subtitle', 'Defina credenciais e permissões no sistema') 
                  : t('users.edit_subtitle', 'Altere o nome de exibição ou o nível de privilégio')}
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

        {/* Scrollable Form Body */}
        <form onSubmit={onSubmit} className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-5">
          {isCreate && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-2">
                {t('users.username', 'Nome de Usuário')} *
              </label>
              <input
                type="text"
                required
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="ex: maria, lucas"
                className="w-full px-4 py-2.5 text-sm bg-accent/30 border border-border/80 rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-saturn-500/30 focus:border-saturn-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-2">
              {t('users.display_name', 'Nome de Exibição')}
            </label>
            <input
              type="text"
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="ex: Maria Silva"
              className="w-full px-4 py-2.5 text-sm bg-accent/30 border border-border/80 rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-saturn-500/30 focus:border-saturn-500 transition-all"
            />
          </div>

          {isCreate && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-2">
                {t('users.password', 'Senha Inicial')} *
              </label>
              <input
                type="password"
                required
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 text-sm bg-accent/30 border border-border/80 rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-saturn-500/30 focus:border-saturn-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-2">
              {t('users.role', 'Papel no Sistema')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setFormRole('member')}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[105px] ${
                  formRole === 'member'
                    ? 'border-saturn-500 bg-saturn-500/10 text-primary shadow-sm shadow-saturn-500/10 ring-1 ring-saturn-500/40'
                    : 'border-border/80 bg-accent/20 text-secondary hover:text-primary hover:border-border hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-primary">
                    <User className={`w-4 h-4 ${formRole === 'member' ? 'text-saturn-400' : 'text-secondary'}`} />
                    <span>{t('users.role_member', 'Membro')}</span>
                  </div>
                  {formRole === 'member' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-saturn-500" />
                  )}
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {t('users.role_member_desc', 'Acesso a arquivos em HDs externos e streaming. Sem permissão de exclusão.')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormRole('admin')}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[105px] ${
                  formRole === 'admin'
                    ? 'border-saturn-500 bg-saturn-500/10 text-primary shadow-sm shadow-saturn-500/10 ring-1 ring-saturn-500/40'
                    : 'border-border/80 bg-accent/20 text-secondary hover:text-primary hover:border-border hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-primary">
                    <Shield className={`w-4 h-4 ${formRole === 'admin' ? 'text-saturn-400' : 'text-secondary'}`} />
                    <span>{t('users.role_admin', 'Admin')}</span>
                  </div>
                  {formRole === 'admin' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-saturn-500" />
                  )}
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {t('users.role_admin_desc', 'Acesso irrestrito a todo o sistema, terminal e configurações.')}
                </p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm text-secondary hover:text-primary hover:bg-accent/50 font-medium rounded-xl transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-saturn-500 hover:bg-saturn-600 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-saturn-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isCreate ? t('common.create', 'Criar Usuário') : t('common.save', 'Salvar Alterações')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

