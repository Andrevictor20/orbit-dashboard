import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Globe,
  Server,
  Box,
  ShieldCheck,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { IngressRule, CreateRouteResponse } from '../../types/cloudflare';

interface ContainerOption {
  id: string;
  name: string;
  state: string;
  ports: number[];
}

export interface CloudflareAddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCreated: (route: IngressRule) => void;
  tunnelId?: string | null;
  existingRules?: IngressRule[];
}

export function detectBaseDomain(existingRules?: IngressRule[]): string {
  // 1. From localStorage
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('orbit_base_domain');
    if (saved && saved.trim()) return saved.trim().toLowerCase();
  }

  // 2. From existing rules in Cloudflare
  if (existingRules && existingRules.length > 0) {
    for (const r of existingRules) {
      if (r.hostname && r.hostname.includes('.')) {
        const parts = r.hostname.toLowerCase().split('.');
        if (parts.length >= 2) {
          const dom = parts.slice(1).join('.');
          if (dom && !dom.includes(':') && dom !== 'local' && dom !== 'lan') {
            return dom;
          }
        }
      }
    }
  }

  // 3. From window.location.hostname
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== 'localhost' && host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        return parts.slice(1).join('.');
      }
    }
  }

  return 'rasppi.cloud';
}

export function CloudflareAddRouteModal({
  isOpen,
  onClose,
  onRouteCreated,
  tunnelId,
  existingRules,
}: CloudflareAddRouteModalProps) {
  const { t } = useTranslation();

  const [hostnameMode, setHostnameMode] = useState<'builder' | 'raw'>('builder');
  const [subdomain, setSubdomain] = useState('');
  const [baseDomain, setBaseDomain] = useState('rasppi.cloud');
  const [rawHostname, setRawHostname] = useState('');

  const [serviceMode, setServiceMode] = useState<'container' | 'custom'>('container');
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [customService, setCustomService] = useState('http://');
  const [path, setPath] = useState('');
  const [noTlsVerify, setNoTlsVerify] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('orbit_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!isOpen) return;

    // Detect active base domain
    const activeDomain = detectBaseDomain(existingRules);
    setBaseDomain(activeDomain);

    // Reset fields
    setSubdomain('');
    setRawHostname('');
    setPath('');
    setNoTlsVerify(false);
    setSelectedContainer('');
    setSelectedPort('');
    setCustomService('http://');

    // Fetch containers
    setLoadingContainers(true);
    fetch('/api/docker/containers', {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const list: ContainerOption[] = data.map((c: any) => {
            const rawName = Array.isArray(c.names) && c.names[0] ? c.names[0] : c.name || '';
            const cleanName = rawName.replace(/^\//, '');
            const ports: number[] = [];
            if (Array.isArray(c.ports)) {
              c.ports.forEach((p: any) => {
                if (p.public_port && !ports.includes(p.public_port)) ports.push(p.public_port);
                if (p.private_port && !ports.includes(p.private_port)) ports.push(p.private_port);
              });
            }
            return {
              id: c.id || '',
              name: cleanName,
              state: c.state || '',
              ports,
            };
          });
          setContainers(list);
          if (list.length > 0) {
            const first = list[0];
            setSelectedContainer(first.name);
            setSubdomain(first.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
            if (first.ports.length > 0) {
              setSelectedPort(first.ports[0].toString());
            }
          }
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        setLoadingContainers(false);
      });
  }, [isOpen]);

  const handleContainerChange = (containerName: string) => {
    setSelectedContainer(containerName);
    const cont = containers.find((c) => c.name === containerName);
    if (cont) {
      setSubdomain(cont.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      if (cont.ports.length > 0) {
        setSelectedPort(cont.ports[0].toString());
      } else {
        setSelectedPort('');
      }
    } else {
      setSelectedPort('');
    }
  };

  const computeFinalHostname = (): string => {
    if (hostnameMode === 'builder') {
      const cleanSub = subdomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const cleanBase = baseDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (cleanSub && cleanBase) return `${cleanSub}.${cleanBase}`;
      return cleanSub || cleanBase;
    }
    return rawHostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  };

  const computeFinalService = (): string => {
    if (serviceMode === 'container') {
      if (!selectedContainer) return '';
      const portPart = selectedPort ? `:${selectedPort}` : '';
      return `http://${selectedContainer}${portPart}`;
    }
    return customService.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanHostname = computeFinalHostname();
    const finalService = computeFinalService();

    if (!cleanHostname) {
      toast.error(t('cloudflare.error_hostname_required', 'Informe o hostname público desejado.'));
      return;
    }

    if (!finalService) {
      toast.error(t('cloudflare.error_service_required', 'Informe o serviço interno de destino.'));
      return;
    }

    // Persist domain for future convenience
    if (baseDomain.trim() && typeof localStorage !== 'undefined') {
      localStorage.setItem('orbit_base_domain', baseDomain.trim().toLowerCase());
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cloudflare/routes', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          hostname: cleanHostname,
          service: finalService,
          path: path.trim() || undefined,
          no_tls_verify: noTlsVerify || undefined,
        }),
      });

      const data: CreateRouteResponse = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || t('cloudflare.route_created_success', 'Rota criada com sucesso!'));
        if (data.dns_message) {
          toast(data.dns_message, { icon: 'ℹ️', duration: 6000 });
        }
        onRouteCreated(data.route);
        onClose();
      } else {
        toast.error((data as any).error || t('cloudflare.route_create_error', 'Falha ao criar rota'));
      }
    } catch {
      toast.error(t('cloudflare.route_create_error', 'Falha na comunicação com o servidor'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orbit-500/15 border border-orbit-500/30 flex items-center justify-center text-orbit-500">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">
                {t('cloudflare.add_route_title', 'Adicionar Nova Rota Ingress')}
              </h2>
              <p className="text-xs text-secondary">
                {t('cloudflare.add_route_desc', 'Exponha um contêiner ou serviço local de forma segura via Cloudflare.')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-accent text-secondary hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Hostname Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-primary">
                {t('cloudflare.public_hostname', 'Hostname Público')} <span className="text-rose-500">*</span>
              </label>
              <div className="flex bg-accent/40 border border-border/60 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setHostnameMode('builder')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    hostnameMode === 'builder'
                      ? 'bg-card text-primary shadow-sm font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t('cloudflare.hostname_mode_builder', 'Construtor')}
                </button>
                <button
                  type="button"
                  onClick={() => setHostnameMode('raw')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    hostnameMode === 'raw'
                      ? 'bg-card text-primary shadow-sm font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t('cloudflare.hostname_mode_raw', 'Manual')}
                </button>
              </div>
            </div>

            {hostnameMode === 'builder' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[11px] text-secondary mb-1 font-medium">
                      {t('cloudflare.subdomain_label', 'Subdomínio')}
                    </span>
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="stirling-pdf"
                      className="w-full px-3 py-2 rounded-xl bg-accent/40 border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-secondary mb-1 font-medium">
                      {t('cloudflare.base_domain_label', 'Domínio Base')}
                    </span>
                    <input
                      type="text"
                      required
                      value={baseDomain}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase();
                        setBaseDomain(val);
                        if (typeof localStorage !== 'undefined') {
                          localStorage.setItem('orbit_base_domain', val.trim());
                        }
                      }}
                      placeholder="rasppi.cloud"
                      className="w-full px-3 py-2 rounded-xl bg-accent/40 border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                    />
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-accent/20 border border-border/50 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-secondary/70">URL Pública Final:</span>
                  <span className="font-bold text-emerald-500 dark:text-emerald-400">
                    https://{computeFinalHostname() || '...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex rounded-xl bg-accent/40 border border-border focus-within:border-orbit-500 overflow-hidden">
                <span className="px-3 py-2 text-xs font-mono text-secondary/70 bg-accent/30 border-r border-border/60 flex items-center select-none shrink-0">
                  https://
                </span>
                <input
                  type="text"
                  required
                  value={rawHostname}
                  onChange={(e) => setRawHostname(e.target.value)}
                  placeholder={t('cloudflare.hostname_placeholder', 'ex: app.rasppi.cloud')}
                  className="flex-1 px-3 py-2 bg-transparent text-xs text-primary font-mono focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Service Mode Tabs */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">
              {t('cloudflare.target_service', 'Serviço de Destino Interno')} <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-accent/30 border border-border/60 mb-2.5">
              <button
                type="button"
                onClick={() => setServiceMode('container')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  serviceMode === 'container'
                    ? 'bg-card text-primary shadow-sm font-semibold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>{t('cloudflare.mode_container', 'Contêiner Docker')}</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceMode('custom')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  serviceMode === 'custom'
                    ? 'bg-card text-primary shadow-sm font-semibold'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>{t('cloudflare.mode_custom', 'URL Manual')}</span>
              </button>
            </div>

            {serviceMode === 'container' ? (
              <div className="space-y-2">
                {loadingContainers ? (
                  <div className="p-3 text-center text-xs text-secondary flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('cloudflare.loading_containers', 'Buscando contêineres...')}</span>
                  </div>
                ) : containers.length === 0 ? (
                  <div className="p-2.5 rounded-xl border border-border/60 bg-accent/20 text-xs text-secondary">
                    {t('cloudflare.no_containers_found', 'Nenhum contêiner ativo encontrado. Use a URL Manual.')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] text-secondary mb-1">
                        {t('cloudflare.select_container', 'Selecione o Contêiner')}
                      </span>
                      <select
                        value={selectedContainer}
                        onChange={(e) => handleContainerChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-accent/40 border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                      >
                        {containers.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.state === 'running' ? '(ativo)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] text-secondary mb-1">
                        {t('cloudflare.select_port', 'Porta')}
                      </span>
                      <input
                        type="text"
                        value={selectedPort}
                        onChange={(e) => setSelectedPort(e.target.value)}
                        placeholder="8080"
                        className="w-full px-3 py-2 rounded-xl bg-accent/40 border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-secondary/70 font-mono">
                  {t('cloudflare.target_preview', 'Destino configurado')}:{' '}
                  <span className="text-primary font-bold">{computeFinalService() || '—'}</span>
                </p>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  placeholder="http://192.168.1.50:8080"
                  className="w-full px-3 py-2 rounded-xl bg-accent/40 border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                />
                <span className="text-[10px] text-secondary mt-1 block">
                  {t('cloudflare.custom_service_hint', 'Ex: http://192.168.1.100:8080 ou http://localhost:3000')}
                </span>
              </div>
            )}
          </div>

          {/* Advanced Options Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{t('cloudflare.advanced_options', 'Opções Avançadas')}</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl bg-accent/20 border border-border/50 space-y-3">
                <div>
                  <label className="block text-[11px] text-secondary mb-1">
                    {t('cloudflare.path_optional', 'Caminho (Path Opcional)')}
                  </label>
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/api"
                    className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-primary font-mono focus:outline-none focus:border-orbit-500"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noTlsVerify}
                    onChange={(e) => setNoTlsVerify(e.target.checked)}
                    className="rounded border-border text-orbit-500 focus:ring-0"
                  />
                  <span className="text-xs text-secondary">
                    {t('cloudflare.no_tls_verify', 'No TLS Verify (ignorar certificados HTTPS auto-assinados)')}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* DNS Notice with Dynamic Base Domain */}
          <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-secondary flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-primary block">
                {t('cloudflare.dns_tip_title', 'Dica de Conectividade DNS')}
              </span>
              {t(
                'cloudflare.dns_tip_desc',
                'Se você utiliza Wildcard DNS (*.{{domain}}), esta rota funcionará instantaneamente. Caso contrário, adicione um CNAME no DNS da Cloudflare apontando para seu túnel',
                { domain: baseDomain || 'rasppi.cloud' }
              )}{' '}
              {tunnelId && <span className="font-mono text-primary font-bold">({tunnelId.substring(0, 8)}...cfargotunnel.com)</span>}.
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-border/70 bg-card hover:bg-accent text-secondary hover:text-primary text-xs font-semibold transition-all"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-400 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('cloudflare.create_route_btn', 'Criar Rota')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
