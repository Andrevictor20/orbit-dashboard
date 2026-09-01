import { useState } from 'react';
import { X, KeyRound, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { OrbitLogo } from '../ui/OrbitLogo';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (!res.ok) throw new Error('Failed to update password');
      
      toast.success(t('auth.password_updated') || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      toast.error('Invalid current password or server error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-background border shad-border rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b shad-border">
          <h2 className="font-semibold text-lg">{t('sidebar.account') || 'Minha Conta'}</h2>
          <button onClick={onClose} className="p-2 text-secondary hover:text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="p-1 rounded-3xl bg-card border border-border/80 shadow-lg shadow-orbit-500/10 flex items-center justify-center">
              <OrbitLogo size={80} className="rounded-2xl" />
            </div>
            <h3 className="font-bold text-lg text-primary">Admin</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary">{t('profile.current_password')}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-accent/50 border shad-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-orbit-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary">{t('profile.new_password')}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-accent/50 border shad-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-orbit-500"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full bg-orbit-500 hover:bg-orbit-600 text-white font-medium py-2 rounded-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('profile.change_password')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
