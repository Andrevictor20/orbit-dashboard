import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Loader2, User, Shield } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
        <h4 className="text-sm font-bold text-primary flex items-center gap-2">
          {isCreate ? (
            <>
              <Plus className="w-4 h-4 text-saturn-500" />
              {t('users.create_title', 'Criar Novo Usuário')}
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 text-saturn-500" />
              {t('users.edit_title', 'Editar Usuário')} (@{editingUser?.username})
            </>
          )}
        </h4>

        <form onSubmit={onSubmit} className="space-y-3.5">
          {isCreate && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                {t('users.username', 'Nome de Usuário')} *
              </label>
              <input
                type="text"
                required
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="ex: maria, lucas"
                className="w-full px-3 py-2 text-xs bg-accent/40 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-saturn-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">
              {t('users.display_name', 'Nome de Exibição')}
            </label>
            <input
              type="text"
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="ex: Maria Silva"
              className="w-full px-3 py-2 text-xs bg-accent/40 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-saturn-500"
            />
          </div>

          {isCreate && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                {t('users.password', 'Senha Inicial')} *
              </label>
              <input
                type="password"
                required
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 text-xs bg-accent/40 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-saturn-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1.5">
              {t('users.role', 'Papel no Sistema')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormRole('member')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  formRole === 'member'
                    ? 'border-saturn-500 bg-saturn-500/10 text-saturn-400'
                    : 'border-border bg-accent/20 text-secondary hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <User className="w-3.5 h-3.5" />
                  <span>{t('users.role_member', 'Membro')}</span>
                </div>
                <p className="text-[11px] text-secondary mt-1 leading-tight">
                  {t('users.role_member_desc', 'Acesso a arquivos em HDs externos e streaming. Sem exclusão.')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormRole('admin')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  formRole === 'admin'
                    ? 'border-saturn-500 bg-saturn-500/10 text-saturn-400'
                    : 'border-border bg-accent/20 text-secondary hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t('users.role_admin', 'Admin')}</span>
                </div>
                <p className="text-[11px] text-secondary mt-1 leading-tight">
                  {t('users.role_admin_desc', 'Acesso irrestrito a todo o sistema, terminal e configurações.')}
                </p>
              </button>
            </div>
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
              <span>{isCreate ? t('common.create', 'Criar Usuário') : t('common.save', 'Salvar Alterações')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
