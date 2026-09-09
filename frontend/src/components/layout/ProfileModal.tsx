import { useState } from 'react';
import { X, KeyRound, Palette, Server, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AccountTab } from './AccountTab';
import { IntegrationsTab } from './IntegrationsTab';
import { SystemSettingsTab } from './SystemSettingsTab';
import { CustomizationTab } from './CustomizationTab';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTabType = 'account' | 'integrations' | 'system' | 'customization';

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('account');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card/95 backdrop-blur-3xl saturate-[190%] border border-border/80 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-orbit-500" />
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
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-border/60 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`pb-3 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'account'
                ? 'border-orbit-500 text-orbit-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t('profile.tab_account', 'Conta')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'integrations'
                ? 'border-orbit-500 text-orbit-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{t('profile.tab_integrations', 'Integrações')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`pb-3 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'system'
                ? 'border-orbit-500 text-orbit-500'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>{t('profile.tab_system', 'Servidor & Porta')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customization')}
            className={`pb-3 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
              activeTab === 'customization'
                ? 'border-orbit-500 text-orbit-500'
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
          {activeTab === 'integrations' && <IntegrationsTab onCloseModal={onClose} />}
          {activeTab === 'system' && <SystemSettingsTab />}
          {activeTab === 'customization' && <CustomizationTab />}
        </div>
      </div>
    </div>
  );
}
