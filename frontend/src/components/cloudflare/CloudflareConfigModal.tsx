import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Key,
  Trash2,
  HelpCircle,
  ExternalLink,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CloudflareConfigResponse } from '../../types/cloudflare';

interface CloudflareConfigModalProps {
  config: CloudflareConfigResponse | null;
  accountId: string;
  setAccountId: (val: string) => void;
  tunnelId: string;
  setTunnelId: (val: string) => void;
  apiToken: string;
  setApiToken: (val: string) => void;
  autoSync: boolean;
  setAutoSync: (val: boolean) => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export function CloudflareConfigModal({
  config,
  accountId,
  setAccountId,
  tunnelId,
  setTunnelId,
  apiToken,
  setApiToken,
  autoSync,
  setAutoSync,
  onSave,
  onDelete,
  onClose,
  saving,
}: CloudflareConfigModalProps) {
  const { t } = useTranslation();
  const [showApiTokenGuide, setShowApiTokenGuide] = useState(false);
  const [tunnelTokenNotice, setTunnelTokenNotice] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const getAuthHeaders = () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('orbit_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const checkAndExtractTunnelToken = (input: string) => {
    try {
      const clean = input.trim();
      if (!clean) return false;
      let tokenToDecode = clean;
      const match = clean.match(/--token(?:=|\s+)([A-Za-z0-9+/=_-]+)/);
      if (match) {
        tokenToDecode = match[1];
      }
      tokenToDecode = tokenToDecode.replace(/^["']|["']$/g, '');
      const binaryStr = atob(tokenToDecode.replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(binaryStr);
      if (parsed.a && parsed.t) {
        setAccountId(parsed.a);
        setTunnelId(parsed.t);
        setTunnelTokenNotice(true);
        toast.success(
          t('cloudflare.tunnel_token_detected', 'Tunnel Token detectado! Account ID e Tunnel ID preenchidos automaticamente.')
        );
        return true;
      }
    } catch {
      // Not a tunnel token
    }
    return false;
  };

  const handleApiTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiToken(val);
    if (val.length > 30) {
      checkAndExtractTunnelToken(val);
    } else {
      setTunnelTokenNotice(false);
    }
  };

  const handleTestConnection = async () => {
    if (!accountId || !tunnelId) {
      toast.error(t('cloudflare.test_requires_ids', 'Preencha Account ID e Tunnel ID para testar a conexão.'));
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch('/api/cloudflare/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          tunnel_id: tunnelId,
          api_token: apiToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || t('cloudflare.test_success', 'Conexão estabelecida com sucesso!'));
      } else {
        toast.error(data.error || t('cloudflare.test_failed', 'Falha na conexão com a Cloudflare'));
      }
    } catch {
      toast.error(t('cloudflare.test_error', 'Erro ao testar conexão com o servidor'));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-orbit-500" />
          <h2 className="text-sm font-bold text-primary">
            {t('cloudflare.config_section_title', 'Credenciais e Conexão da Cloudflare')}
          </h2>
        </div>
        {config?.configured && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('cloudflare.clear_credentials', 'Desconectar Túnel')}</span>
          </button>
        )}
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-secondary mb-1">
              Account ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ex: 8a4c9e83..."
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-secondary mb-1">
              Tunnel ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ex: 6ff42887-865e-4658-b612-..."
              value={tunnelId}
              onChange={(e) => setTunnelId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-secondary">
              API Token (Cloudflare Zero Trust)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-secondary/70">
                Permissão: Account &gt; Cloudflare Tunnel &gt; Edit
              </span>
              <button
                type="button"
                onClick={() => setShowApiTokenGuide(!showApiTokenGuide)}
                className="text-[11px] text-orbit-500 hover:text-orbit-400 flex items-center gap-1 font-medium transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t('cloudflare.api_token_guide_title', 'Como obter?')}</span>
              </button>
            </div>
          </div>
          <input
            type="password"
            placeholder={config?.has_api_token ? '••••••••••••••••' : 'Cole seu token da API aqui'}
            value={apiToken}
            onChange={handleApiTokenChange}
            className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border text-xs text-primary font-mono placeholder:text-secondary/50 focus:outline-none focus:border-orbit-500"
          />

          {tunnelTokenNotice && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-500 flex items-start gap-2 animate-in fade-in">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{t('cloudflare.tunnel_token_notice')}</p>
            </div>
          )}

          {showApiTokenGuide && (
            <div className="p-3.5 rounded-xl bg-accent/40 border border-border/70 text-xs text-secondary space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <ExternalLink className="w-3.5 h-3.5 text-orbit-500" />
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-orbit-500 transition-colors"
                >
                  {t('cloudflare.api_token_guide_step1', 'Acesse dash.cloudflare.com/profile/api-tokens')}
                </a>
              </div>
              <p>1. {t('cloudflare.api_token_guide_step2', "Clique em 'Create Token' e selecione 'Create Custom Token'")}</p>
              <p>2. {t('cloudflare.api_token_guide_step3', 'Em Permissions, adicione: Account > Cloudflare Tunnel > Edit (e opcionalmente Zone > DNS > Edit)')}</p>
              <p>3. {t('cloudflare.api_token_guide_step4', "Em Account Resources, selecione 'Include > All accounts' (ou sua conta) e conclua.")}</p>
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded border-border text-orbit-500 focus:ring-orbit-500"
            />
            <span className="text-xs text-secondary font-medium">
              {t(
                'cloudflare.auto_sync_label',
                'Sincronizar automaticamente links públicos com os contêineres detectados'
              )}
            </span>
          </label>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || saving}
              className="px-3.5 py-1.5 rounded-xl border border-border/80 bg-accent/40 hover:bg-accent text-secondary hover:text-primary text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-[0.98]"
            >
              {testingConnection ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orbit-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span>{testingConnection ? t('cloudflare.testing_connection', 'Testando...') : t('cloudflare.test_connection', 'Testar Conexão')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={saving || testingConnection}
              className="px-4 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('common.save', 'Salvar Alterações')}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
