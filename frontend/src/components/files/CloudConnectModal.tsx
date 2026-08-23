import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Cloud, 
  HardDrive, 
  Server, 
  Globe, 
  Check, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

interface CloudProvider {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

interface CloudConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function CloudConnectModal({ isOpen, onClose, onConnected }: CloudConnectModalProps) {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [token, setToken] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [share, setShare] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setName('');
      setError(null);
      return;
    }

    setIsLoading(true);
    fetch('/api/files/cloud/providers')
      .then(res => res.json())
      .then(data => {
        if (data.providers && Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
        setIsLoading(false);
      })
      .catch(() => {
        // Fallback default list
        setProviders([
          { id: 'google_drive', name: 'Google Drive', icon: 'google_drive', description: 'Armazenamento em nuvem Google Drive' },
          { id: 'onedrive', name: 'OneDrive', icon: 'onedrive', description: 'Armazenamento em nuvem Microsoft OneDrive' },
          { id: 'dropbox', name: 'Dropbox', icon: 'dropbox', description: 'Sincronização Dropbox' },
          { id: 'smb', name: 'Armazenamento de Rede (SMB)', icon: 'server', description: 'Compartilhamento de rede Windows / Samba' },
          { id: 'webdav', name: 'WebDAV', icon: 'globe', description: 'Servidor compatível com WebDAV' },
        ]);
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProvider = (prov: CloudProvider) => {
    setSelectedProvider(prov);
    setName(prov.name);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    setIsSubmitting(true);
    setError(null);

    const configPayload: Record<string, any> = {};
    if (selectedProvider.id === 'smb') {
      configPayload.host = host;
      configPayload.username = username;
      configPayload.password = password;
      configPayload.share = share;
    } else if (selectedProvider.id === 'webdav') {
      configPayload.host = host;
      configPayload.username = username;
      configPayload.password = password;
    } else {
      configPayload.client_id = clientId;
      configPayload.client_secret = clientSecret;
      configPayload.token = token;
    }

    try {
      const res = await fetch('/api/files/cloud/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id,
          name: name || selectedProvider.name,
          config: configPayload,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao conectar armazenamento');
      }

      if (onConnected) onConnected();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar armazenamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProviderIcon = (id: string) => {
    switch (id) {
      case 'google_drive':
        return (
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Cloud className="w-5 h-5" />
          </div>
        );
      case 'onedrive':
        return (
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
            <Cloud className="w-5 h-5" />
          </div>
        );
      case 'dropbox':
        return (
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
        );
      case 'smb':
        return (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Server className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Globe className="w-5 h-5" />
          </div>
        );
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-6 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedProvider && (
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="font-semibold text-primary text-base">
                {selectedProvider ? `Conectar ao ${selectedProvider.name}` : 'Conectar Armazenamento'}
              </h3>
              <p className="text-xs text-secondary">
                {selectedProvider ? 'Preencha as configurações de conexão' : 'Escolha um serviço de nuvem ou protocolo de rede'}
              </p>
            </div>
          </div>

          <button
            data-testid="close-cloud-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Select Provider */}
        {!selectedProvider ? (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-secondary">
                <Loader2 className="w-6 h-6 animate-spin text-orbit-400" />
                <span className="text-xs">Carregando serviços disponíveis...</span>
              </div>
            ) : (
              providers.map((prov) => (
                <button
                  key={prov.id}
                  onClick={() => handleSelectProvider(prov)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-accent/30 hover:bg-accent hover:border-orbit-500/40 transition-all text-left group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    {getProviderIcon(prov.id)}
                    <div>
                      <h4 className="font-medium text-primary text-sm group-hover:text-orbit-400 transition-colors">
                        {prov.name}
                      </h4>
                      {prov.description && (
                        <p className="text-xs text-secondary line-clamp-1">{prov.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              ))
            )}
          </div>
        ) : (
          /* Step 2: Configure & Connect Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="cloud-name" className="block text-xs font-medium text-secondary mb-1.5">
                Nome da Conexão
              </label>
              <input
                id="cloud-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Meu Google Drive Pessoal"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
              />
            </div>

            {selectedProvider.id === 'smb' || selectedProvider.id === 'webdav' ? (
              <>
                <div>
                  <label htmlFor="cloud-host" className="block text-xs font-medium text-secondary mb-1.5">
                    Endereço do Servidor / Host
                  </label>
                  <input
                    id="cloud-host"
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.100 ou https://webdav.exemplo.com"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                  />
                </div>

                {selectedProvider.id === 'smb' && (
                  <div>
                    <label htmlFor="cloud-share" className="block text-xs font-medium text-secondary mb-1.5">
                      Nome do Compartilhamento (Share)
                    </label>
                    <input
                      id="cloud-share"
                      type="text"
                      value={share}
                      onChange={(e) => setShare(e.target.value)}
                      placeholder="Ex: public, shared, backups"
                      className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cloud-user" className="block text-xs font-medium text-secondary mb-1.5">
                      Usuário
                    </label>
                    <input
                      id="cloud-user"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="cloud-pass" className="block text-xs font-medium text-secondary mb-1.5">
                      Senha
                    </label>
                    <input
                      id="cloud-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="cloud-client-id" className="block text-xs font-medium text-secondary mb-1.5">
                    Client ID / Chave de API
                  </label>
                  <input
                    id="cloud-client-id"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Cole o Client ID OAuth"
                    className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="cloud-client-secret" className="block text-xs font-medium text-secondary mb-1.5">
                    Client Secret
                  </label>
                  <input
                    id="cloud-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Cole o Client Secret"
                    className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="cloud-token" className="block text-xs font-medium text-secondary mb-1.5">
                    Token de Autenticação / Refresh Token (Opcional)
                  </label>
                  <input
                    id="cloud-token"
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Token gerado pelo rclone / OAuth"
                    className="w-full px-3.5 py-2 rounded-xl bg-accent/50 border border-border text-primary placeholder-zinc-500 text-sm focus:outline-none focus:border-orbit-500 transition-colors"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              >
                Voltar
              </button>

              <button
                data-testid="submit-cloud-btn"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orbit-500 text-white font-medium text-sm hover:bg-orbit-600 active:scale-95 shadow-lg shadow-orbit-500/25 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Conectar</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  ) : null;
}
