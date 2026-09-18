import { useState } from 'react';
import { X, KeyRound, Palette, Server, Cpu, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { AccountTab } from './AccountTab';
import { UsersTab } from './UsersTab';
import { IntegrationsTab } from './IntegrationsTab';
import { SystemSettingsTab } from './SystemSettingsTab';
import { CustomizationTab } from './CustomizationTab';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTabType = 'account' | 'users' | 'integrations' | 'system' | 'customization';

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('account');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card/95 backdrop-blur-3xl saturate-[190%] border border-border/80 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-saturn-500" />
            <h2 className="font-bold text-base text-primary">
              {t('settings.modal_title', 'Configurações & Perfil')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary transition-colors rounded-xl hover:bg-accent/70"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 pt-3 border-b border-border/60 overflow-x-auto scrollbar-none no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'account'
                ? 'border-saturn-500 text-saturn-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t('profile.tab_account', 'Conta')}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
                activeTab === 'users'
                  ? 'border-saturn-500 text-saturn-500'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t('profile.tab_users', 'Usuários')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'integrations'
                ? 'border-saturn-500 text-saturn-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{t('profile.tab_integrations', 'Integrações')}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
                activeTab === 'system'
                  ? 'border-saturn-500 text-saturn-500'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>{t('profile.tab_system', 'Servidor & Porta')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('customization')}
            className={`pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'customization'
                ? 'border-saturn-500 text-saturn-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{t('profile.tab_customization', 'Aparência')}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'users' && isAdmin && <UsersTab />}
          {activeTab === 'integrations' && <IntegrationsTab onCloseModal={onClose} />}
          {activeTab === 'system' && isAdmin && <SystemSettingsTab />}
          {activeTab === 'customization' && <CustomizationTab />}
        </div>
      </div>
    </div>
  );
}
