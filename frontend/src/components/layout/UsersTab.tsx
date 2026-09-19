import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, Plus, Shield, User, KeyRound, Trash2, Edit2, 
  CheckCircle2, XCircle, Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { UserFormModal, ResetPasswordModal, DeleteUserModal, MemberPermissionsModal } from './users';

export type UserRole = 'admin' | 'member';

export interface UserPublicProfile {
  id: string;
  username: string;
  display_name?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export function UsersTab() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserPublicProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserPublicProfile | null>(null);
  const [resettingUser, setResettingUser] = useState<UserPublicProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserPublicProfile | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('member');
  const [resetPassword, setResetPassword] = useState('');

  const getHeaders = useCallback(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('saturn_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error(t('users.fetch_error', 'Falha ao carregar lista de usuários.'));
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formPassword.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          username: formUsername.trim().toLowerCase(),
          display_name: formDisplayName.trim() || undefined,
          password: formPassword,
          role: formRole,
        }),
      });

      if (res.ok) {
        toast.success(t('users.created_success', 'Usuário criado com sucesso!'));
        setIsCreateOpen(false);
        setFormUsername('');
        setFormDisplayName('');
        setFormPassword('');
        setFormRole('member');
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('users.create_error', 'Falha ao criar usuário.'));
      }
    } catch {
      toast.error(t('users.create_error', 'Falha ao criar usuário.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          display_name: formDisplayName.trim() || undefined,
          role: formRole,
        }),
      });

      if (res.ok) {
        toast.success(t('users.updated_success', 'Usuário atualizado com sucesso!'));
        setEditingUser(null);
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('users.update_error', 'Falha ao atualizar usuário.'));
      }
    } catch {
      toast.error(t('users.update_error', 'Falha ao atualizar usuário.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetPassword.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ new_password: resetPassword.trim() }),
      });

      if (res.ok) {
        toast.success(t('users.password_reset_success', 'Senha redefinida com sucesso!'));
        setResettingUser(null);
        setResetPassword('');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('users.password_reset_error', 'Falha ao redefinir senha.'));
      }
    } catch {
      toast.error(t('users.password_reset_error', 'Falha ao redefinir senha.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserPublicProfile) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (res.ok) {
        toast.success(user.is_active ? t('users.suspended_success', 'Usuário suspenso.') : t('users.activated_success', 'Usuário ativado.'));
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('users.update_error', 'Falha ao alterar status.'));
      }
    } catch {
      toast.error(t('users.update_error', 'Falha ao alterar status.'));
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(t('users.deleted_success', 'Usuário excluído com sucesso.'));
        setDeletingUser(null);
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('users.delete_error', 'Falha ao excluir usuário.'));
      }
    } catch {
      toast.error(t('users.delete_error', 'Falha ao excluir usuário.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Users className="w-4 h-4 text-saturn-500" />
            {t('users.title', 'Gestão de Usuários & Família')}
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            {t('users.subtitle', 'Gerencie quem tem acesso ao servidor e controle permissões granulares.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPermissionsModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent/40 hover:bg-accent/60 text-primary text-xs font-semibold rounded-xl border border-border/80 transition-all duration-200 shadow-sm hover:border-saturn-500/50"
          >
            <Shield className="w-3.5 h-3.5 text-saturn-400" />
            <span>{t('users.permissions_guide_btn', 'Mais Detalhes')}</span>
          </button>

          <button
            onClick={() => {
              setFormUsername('');
              setFormDisplayName('');
              setFormPassword('');
              setFormRole('member');
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-saturn-500 hover:bg-saturn-600 text-white text-xs font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm shadow-saturn-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t('users.new_user', 'Novo Usuário')}</span>
          </button>
        </div>
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-saturn-500" />
          <span className="text-xs">{t('common.loading', 'Carregando usuários...')}</span>
        </div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-xs text-secondary border border-dashed border-border rounded-xl">
          {t('users.empty', 'Nenhum usuário cadastrado além do administrador.')}
        </div>
      ) : (
        <div className="divide-y divide-border/50 border border-border/60 rounded-xl overflow-hidden bg-accent/20">
          {users.map((u) => {
            const isSelf = currentUser?.username === u.username;
            const isAdmin = u.role === 'admin';

            return (
              <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    isAdmin
                      ? 'bg-saturn-500/20 text-saturn-500 dark:text-saturn-400 border border-saturn-500/30'
                      : 'bg-accent text-secondary border border-border'
                  }`}>
                    {u.display_name?.slice(0, 2).toUpperCase() || u.username.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-primary truncate">
                        {u.display_name || u.username}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-saturn-500/10 text-saturn-400 border border-saturn-500/20">
                          {t('users.you', 'Você')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary mt-0.5">
                      <span>@{u.username}</span>
                      <span>•</span>
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        isAdmin ? 'text-saturn-500 dark:text-saturn-400' : 'text-secondary'
                      }`}>
                        {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {isAdmin ? t('users.role_admin', 'Administrador') : t('users.role_member', 'Membro')}
                      </span>
                      <span>•</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] ${
                        u.is_active ? 'text-emerald-500' : 'text-rose-400'
                      }`}>
                        {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {u.is_active ? t('users.status_active', 'Ativo') : t('users.status_suspended', 'Suspenso')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setFormDisplayName(u.display_name || '');
                      setFormRole(u.role);
                    }}
                    title={t('common.edit', 'Editar')}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/60 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setResettingUser(u);
                      setResetPassword('');
                    }}
                    title={t('users.reset_password', 'Redefinir Senha')}
                    className="p-1.5 rounded-lg text-secondary hover:text-saturn-400 hover:bg-accent/60 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>

                  {!isSelf && (
                    <>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        title={u.is_active ? t('users.suspend', 'Suspender') : t('users.activate', 'Ativar')}
                        className={`p-1.5 rounded-lg transition-colors hover:bg-accent/60 ${
                          u.is_active ? 'text-secondary hover:text-amber-400' : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => setDeletingUser(u)}
                        title={t('common.delete', 'Excluir')}
                        className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isCreateOpen && (
        <UserFormModal
          isCreate={true}
          editingUser={null}
          formUsername={formUsername}
          setFormUsername={setFormUsername}
          formDisplayName={formDisplayName}
          setFormDisplayName={setFormDisplayName}
          formPassword={formPassword}
          setFormPassword={setFormPassword}
          formRole={formRole}
          setFormRole={setFormRole}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateUser}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {editingUser && (
        <UserFormModal
          isCreate={false}
          editingUser={editingUser}
          formUsername=""
          setFormUsername={() => {}}
          formDisplayName={formDisplayName}
          setFormDisplayName={setFormDisplayName}
          formPassword=""
          setFormPassword={() => {}}
          formRole={formRole}
          setFormRole={setFormRole}
          isSubmitting={isSubmitting}
          onSubmit={handleUpdateUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          resetPassword={resetPassword}
          setResetPassword={setResetPassword}
          isSubmitting={isSubmitting}
          onSubmit={handleResetPassword}
          onClose={() => setResettingUser(null)}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          isSubmitting={isSubmitting}
          onConfirm={handleDeleteUser}
          onClose={() => setDeletingUser(null)}
        />
      )}

      <MemberPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
      />
    </div>
  );
}

