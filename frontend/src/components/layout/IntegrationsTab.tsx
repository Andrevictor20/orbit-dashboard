import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../../contexts/SettingsContext';

interface IntegrationStatus {
  configured: boolean;
  connected: boolean;
  url?: string;
}

export function IntegrationsTab({ onCloseModal }: { onCloseModal?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();

  const [haStatus, setHaStatus] = useState<IntegrationStatus | null>(null);
  const [piholeStatus, setPiholeStatus] = useState<IntegrationStatus | null>(null);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [updatingIntegration, setUpdatingIntegration] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkStatuses = async () => {
      try {
        const [haRes, piholeRes] = await Promise.allSettled([
          fetch('/api/homeassistant/config').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/pihole/config').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!isMounted) return;

        if (haRes.status === 'fulfilled' && haRes.value) {
          setHaStatus({
            configured: haRes.value.configured,
            connected: haRes.value.connected,
            url: haRes.value.url,
          });
        }

        if (piholeRes.status === 'fulfilled' && piholeRes.value) {
          setPiholeStatus({
            configured: piholeRes.value.configured,
            connected: piholeRes.value.connected,
            url: piholeRes.value.url,
          });
        }
      } finally {
        if (isMounted) setLoadingStatuses(false);
      }
    };

    checkStatuses();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async (key: 'homeassistant' | 'pihole', currentValue: boolean) => {
    try {
      setUpdatingIntegration(key);
      const nextValue = !currentValue;
      await updateSettings({
        integrations: {
          ...settings.integrations,
          [key]: nextValue,
        },
      });

      toast.success(
        nextValue
          ? t('settings.integration_enabled', 'Integração ativada!')
          : t('settings.integration_disabled', 'Integração desativada!')
      );
    } catch {
      toast.error(t('settings.integration_update_failed', 'Falha ao atualizar integração'));
    } finally {
      setUpdatingIntegration(null);
    }
  };

  const navigateTo = (path: string) => {
    if (onCloseModal) onCloseModal();
    navigate(path);
  };

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-border/60">
        <h3 className="text-sm font-bold text-primary">
          {t('settings.integrations_title', 'Integrações de Primeiro Nível')}
        </h3>
        <p className="text-xs text-secondary mt-0.5">
          {t(
            'settings.integrations_subtitle',
            'Ative ou desative as integrações do Orbit. Quando desativadas, elas são ocultadas da barra lateral.'
          )}
        </p>
      </div>

      {/* Home Assistant Card */}
      <div className="rounded-2xl border border-border/80 bg-surface/70 dark:bg-zinc-800/40 p-4 transition-all hover:border-orbit-500/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-primary">Home Assistant</h4>
                {loadingStatuses ? (
                  <Loader2 className="w-3 h-3 animate-spin text-secondary" />
                ) : haStatus?.configured ? (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      haStatus.connected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {haStatus.connected
                      ? t('common.connected', 'Conectado')
                      : t('common.disconnected', 'Desconectado')}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700/60 text-secondary">
                    {t('settings.not_configured', 'Não configurado')}
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {t(
                  'settings.ha_desc',
                  'Automação residencial, luzes, sensores e controle de dispositivos inteligentes.'
                )}
              </p>
              {haStatus?.url && (
                <span className="text-[11px] text-secondary font-mono block mt-1 truncate max-w-xs">
                  {haStatus.url}
                </span>
              )}
            </div>
          </div>

          {/* Switch Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={settings.integrations.homeassistant}
              disabled={updatingIntegration === 'homeassistant'}
              onClick={() => handleToggle('homeassistant', settings.integrations.homeassistant)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-orbit-500 ${
                settings.integrations.homeassistant ? 'bg-orbit-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.integrations.homeassistant ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {settings.integrations.homeassistant && (
          <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={() => navigateTo('/homeassistant')}
              className="text-xs text-orbit-500 hover:text-orbit-400 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>{t('settings.open_integration_dashboard', 'Abrir Home Assistant')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Pi-hole Card */}
      <div className="rounded-2xl border border-border/80 bg-surface/70 dark:bg-zinc-800/40 p-4 transition-all hover:border-orbit-500/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-primary">Pi-hole</h4>
                {loadingStatuses ? (
                  <Loader2 className="w-3 h-3 animate-spin text-secondary" />
                ) : piholeStatus?.configured ? (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      piholeStatus.connected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {piholeStatus.connected
                      ? t('common.connected', 'Conectado')
                      : t('common.disconnected', 'Desconectado')}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700/60 text-secondary">
                    {t('settings.not_configured', 'Não configurado')}
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {t(
                  'settings.pihole_desc',
                  'Bloqueio de anúncios em rede, servidor DNS e gerenciamento de domínios.'
                )}
              </p>
              {piholeStatus?.url && (
                <span className="text-[11px] text-secondary font-mono block mt-1 truncate max-w-xs">
                  {piholeStatus.url}
                </span>
              )}
            </div>
          </div>

          {/* Switch Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={settings.integrations.pihole}
              disabled={updatingIntegration === 'pihole'}
              onClick={() => handleToggle('pihole', settings.integrations.pihole)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-orbit-500 ${
                settings.integrations.pihole ? 'bg-orbit-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.integrations.pihole ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {settings.integrations.pihole && (
          <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={() => navigateTo('/pihole')}
              className="text-xs text-orbit-500 hover:text-orbit-400 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>{t('settings.open_integration_dashboard', 'Abrir Pi-hole')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
