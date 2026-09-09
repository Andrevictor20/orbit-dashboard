import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserAvatar } from '../ui/UserAvatar';

export function AccountTab() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) throw new Error('Failed to update password');

      toast.success(t('auth.password_updated') || 'Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      toast.error(t('profile.invalid_current_password', 'Senha atual incorreta ou erro no servidor'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="p-1 rounded-3xl bg-card border border-border/80 shadow-lg shadow-orbit-500/10 flex items-center justify-center">
          <UserAvatar size={76} showGlow className="rounded-2xl" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-lg text-primary">Admin</h3>
          <span className="text-xs text-secondary">Orbit Administrator</span>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary">
            {t('profile.current_password', 'Senha Atual')}
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 transition-all font-mono"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary">
            {t('profile.new_password', 'Nova Senha')}
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 transition-all font-mono"
              required
              minLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isChangingPassword}
          className="w-full bg-orbit-500 hover:bg-orbit-600 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md shadow-orbit-500/20 text-sm disabled:opacity-50"
        >
          {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{t('profile.change_password', 'Alterar Senha')}</span>
        </button>
      </form>
    </div>
  );
}
