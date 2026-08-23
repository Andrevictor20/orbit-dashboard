import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Cloud, 
  Server, 
  Globe, 
  Check, 
  Loader2, 
  AlertCircle, 
  ChevronRight,
  ExternalLink,
  Settings2,
  HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CloudProvider {
  id: string;
  name: string;
  type: 'oauth' | 'network';
  description: string;
  brandColor: string;
  iconBg: string;
}

interface CloudConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

const CLOUD_OAUTH_PROVIDERS: CloudProvider[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    type: 'oauth',
    description: 'Acesse seus arquivos, fotos e documentos do Google Drive diretamente no Orbit',
    brandColor: 'hover:border-amber-500/50 hover:bg-amber-500/5',
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    type: 'oauth',
    description: 'Sincronize pastas de trabalho e arquivos pessoais da sua conta Microsoft',
    brandColor: 'hover:border-sky-500/50 hover:bg-sky-500/5',
    iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    type: 'oauth',
    description: 'Conecte sua pasta do Dropbox para transferências e backup na nuvem',
    brandColor: 'hover:border-blue-500/50 hover:bg-blue-500/5',
    iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
];

const NETWORK_STORAGE_PROVIDERS: CloudProvider[] = [
  {
    id: 'smb',
    name: 'Compartilhamento SMB / Samba',
    type: 'network',
    description: 'Pastas compartilhadas do Windows, NAS local ou servidor Samba',
    brandColor: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    id: 'webdav',
    name: 'Servidor WebDAV / Nextcloud',
    type: 'network',
    description: 'Nextcloud, ownCloud ou qualquer servidor compatível com WebDAV',
    brandColor: 'hover:border-purple-500/50 hover:bg-purple-500/5',
    iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
];

export function CloudConnectModal({ isOpen, onClose, onConnected }: CloudConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'oauth' | 'network'>('oauth');
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null);
  const [selectedNetworkProvider, setSelectedNetworkProvider] = useState<CloudProvider | null>(null);

  // Network Storage Form States
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [share, setShare] = useState('');

  // Advanced OAuth Custom Credentials (Optional)
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1-CLICK BROWSER OAUTH LOGIN
  const handleOAuthConnect = async (provider: CloudProvider) => {
    try {
      setConnectingProviderId(provider.id);
      setError(null);

      // 1. Fetch official authorization URL from backend
      const queryParams = new URLSearchParams({
        provider: provider.id,
        redirect_uri: window.location.origin,
        ...(customClientId ? { client_id: customClientId } : {}),
      });

      const res = await fetch(`/api/files/cloud/oauth/auth-url?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Falha ao iniciar autenticação com ${provider.name}`);
      }

      const { auth_url, state } = await res.json();

      // 2. Open login popup in browser
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        auth_url,
        `orbit_oauth_${provider.id}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      // Simulação de retorno ou finalização direta do callback
      // Em ambiente de produção o popup redireciona para o callback do Orbit
      const pollTimer = window.setInterval(async () => {
        if (!popup || popup.closed) {
          window.clearInterval(pollTimer);
          
          // Complete account registration
          try {
            const callbackRes = await fetch('/api/files/cloud/oauth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: provider.id,
                name: provider.name,
                state,
                client_id: customClientId || undefined,
                client_secret: customClientSecret || undefined,
                mock_access_token: `token_${Date.now()}`,
              }),
            });

            if (callbackRes.ok) {
              toast.success(`${provider.name} conectado com sucesso!`);
              if (onConnected) onConnected();
              onClose();
            }
          } catch {
            // Ignored on close
          } finally {
            setConnectingProviderId(null);
          }
        }
      }, 800);

    } catch (err: any) {
      setError(err.message || 'Erro ao conectar à nuvem');
      setConnectingProviderId(null);
    }
  };

  // NETWORK STORAGE FORM SUBMISSION
  const handleNetworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNetworkProvider) return;

    setIsSubmitting(true);
    setError(null);

    const configPayload: Record<string, any> = {
      host,
      username,
      password,
    };

    if (selectedNetworkProvider.id === 'smb') {
      configPayload.share = share;
    }

    try {
      const res = await fetch('/api/files/cloud/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedNetworkProvider.id,
          name: name || selectedNetworkProvider.name,
          config: configPayload,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao conectar armazenamento de rede');
      }

      toast.success(`${name || selectedNetworkProvider.name} montado com sucesso!`);
      if (onConnected) onConnected();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar armazenamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-primary text-base sm:text-lg">
                Conectar Armazenamento
              </h3>
              <p className="text-xs text-secondary">
                Vincule seu Google Drive, OneDrive ou servidores de rede ao Orbit
              </p>
            </div>
          </div>

          <button
            data-testid="close-cloud-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 rounded-xl bg-accent/50 border border-border">
          <button
            type="button"
            onClick={() => { setActiveTab('oauth'); setSelectedNetworkProvider(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'oauth'
                ? 'bg-orbit-500 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            ☁️ Nuvem com 1 Clique (OAuth)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'network'
                ? 'bg-orbit-500 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            🖥️ Rede Local / Servidores (SMB, WebDAV)
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: 1-CLICK OAUTH CLOUD PROVIDERS */}
        {activeTab === 'oauth' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="grid gap-3">
              {CLOUD_OAUTH_PROVIDERS.map((prov) => {
                const isConnecting = connectingProviderId === prov.id;

                return (
                  <div
                    key={prov.id}
                    className={`p-4 rounded-xl border border-border bg-card/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${prov.brandColor}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-xl border shrink-0 ${prov.iconBg}`}>
                        {prov.id === 'google_drive' ? (
                          <Cloud className="w-6 h-6" />
                        ) : prov.id === 'onedrive' ? (
                          <Cloud className="w-6 h-6" />
                        ) : (
                          <HardDrive className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-primary">{prov.name}</h4>
                        <p className="text-xs text-secondary max-w-sm mt-0.5">{prov.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleOAuthConnect(prov)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shrink-0 ${
                        prov.id === 'google_drive'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                          : prov.id === 'onedrive'
                          ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20'
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      }`}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <span>Entrar com {prov.name}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Advanced API Credentials Accordion */}
            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
                className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors py-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Configurar credenciais personalizadas de API (Opcional)</span>
              </button>

              {showAdvancedOAuth && (
                <div className="mt-3 p-3.5 rounded-xl bg-accent/30 border border-border space-y-3 animate-in fade-in duration-150">
                  <p className="text-[11px] text-secondary">
                    Por padrão, o Orbit usa as chaves integradas. Preencha apenas se quiser usar seu próprio aplicativo do Google Cloud Console ou Microsoft Azure.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-secondary block mb-1 font-medium">Custom Client ID</label>
                      <input
                        type="text"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        placeholder="Ex: 12345.apps.googleusercontent.com"
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-primary focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-secondary block mb-1 font-medium">Custom Client Secret</label>
                      <input
                        type="password"
                        value={customClientSecret}
                        onChange={(e) => setCustomClientSecret(e.target.value)}
                        placeholder="GOCSPX-..."
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-primary focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: NETWORK STORAGE PROVIDERS (SMB, WEBDAV) */}
        {activeTab === 'network' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {!selectedNetworkProvider ? (
              <div className="grid gap-3">
                {NETWORK_STORAGE_PROVIDERS.map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelectedNetworkProvider(prov);
                      setName(prov.name);
                    }}
                    className={`p-4 rounded-xl border border-border bg-card/60 transition-all flex items-center justify-between text-left ${prov.brandColor}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-xl border shrink-0 ${prov.iconBg}`}>
                        {prov.id === 'smb' ? (
                          <Server className="w-6 h-6" />
                        ) : (
                          <Globe className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-primary">{prov.name}</h4>
                        <p className="text-xs text-secondary mt-0.5">{prov.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-secondary" />
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleNetworkSubmit} className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-primary flex items-center gap-2">
                    <span>Configuração:</span>
                    <span className="text-orbit-400">{selectedNetworkProvider.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNetworkProvider(null)}
                    className="text-xs text-secondary hover:text-primary"
                  >
                    Trocar protocolo
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-secondary block mb-1 font-medium">Nome de Exibição</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: NAS da Sala / Nextcloud"
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-primary focus:outline-none focus:border-orbit-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-secondary block mb-1 font-medium">Host / Endereço IP / URL</label>
                    <input
                      type="text"
                      required
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder={selectedNetworkProvider.id === 'smb' ? '192.168.1.100 ou nas.local' : 'https://nextcloud.meudominio.com/remote.php/webdav'}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-mono text-primary focus:outline-none focus:border-orbit-500"
                    />
                  </div>

                  {selectedNetworkProvider.id === 'smb' && (
                    <div>
                      <label className="text-xs text-secondary block mb-1 font-medium">Nome do Compartilhamento (Share)</label>
                      <input
                        type="text"
                        required
                        value={share}
                        onChange={(e) => setShare(e.target.value)}
                        placeholder="Ex: public / shared / downloads"
                        className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-mono text-primary focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-secondary block mb-1 font-medium">Usuário</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="usuario"
                        className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-primary focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-secondary block mb-1 font-medium">Senha</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-primary focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNetworkProvider(null)}
                    className="px-4 py-2 rounded-xl border border-border text-xs text-secondary hover:text-primary transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-md shadow-orbit-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Montar Armazenamento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;
}
