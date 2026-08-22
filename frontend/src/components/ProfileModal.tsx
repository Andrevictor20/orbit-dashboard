import { useState } from 'react';
import { X, KeyRound, DownloadCloud, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'account' | 'settings'>('account');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    } catch (err) {
      toast.error('Invalid current password or server error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdate = async () => {
    if (!confirm('This will restart the system. Continue?')) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/system/update', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to trigger update');
      toast.success('Update initiated! System will restart shortly.');
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err) {
      toast.error('Failed to trigger update');
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-background border shad-border rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex border-b shad-border">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'account' ? 'border-b-2 border-orbit-500 text-primary' : 'text-secondary hover:text-primary'}`}
          >
            {t('sidebar.account') || 'Conta'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'border-b-2 border-orbit-500 text-primary' : 'text-secondary hover:text-primary'}`}
          >
            {t('sidebar.settings') || 'Configurações'}
          </button>
          <button onClick={onClose} className="p-4 text-secondary hover:text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'account' ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-orbit-500/20 border-2 border-orbit-500/50 flex items-center justify-center overflow-hidden">
                  <img src="/favicon.jpg" alt="Profile" className="w-full h-full object-cover" />
                </div>
                <h3 className="font-semibold text-lg">Admin</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-secondary">Senha Atual</label>
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
                  <label className="text-sm font-medium text-secondary">Nova Senha</label>
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
                  Alterar Senha
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border shad-border rounded-lg bg-accent/30">
                <div className="flex items-center gap-3">
                  <DownloadCloud className="w-5 h-5 text-orbit-400" />
                  <div>
                    <h4 className="font-medium">Atualizar Orbit</h4>
                    <p className="text-xs text-secondary">Busca as novidades do repositório</p>
                  </div>
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="bg-orbit-500/20 text-orbit-400 hover:bg-orbit-500 hover:text-white px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Atualizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
