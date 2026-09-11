import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Copy, Check, AlertTriangle, Loader2, QrCode, Key, ArrowRight, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SetupData {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
  recovery_codes: string[];
}

export function TwoFactorSetupModal({ isOpen, onClose, onSuccess }: TwoFactorSetupModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [step, setStep] = useState<'scan' | 'verify'>('scan');

  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setVerificationCode('');
      setLoading(true);
      fetch('/api/auth/2fa/setup', { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to start 2FA setup');
          return res.json();
        })
        .then((data: SetupData) => {
          setSetupData(data);
        })
        .catch(() => {
          toast.error(t('two_factor.setup_error', 'Erro ao iniciar configuração do 2FA'));
          onClose();
        })
        .finally(() => setLoading(false));
    } else {
      setSetupData(null);
    }
  }, [isOpen]);

  const handleCopySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    toast.success(t('two_factor.secret_copied', 'Chave secreta copiada!'));
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  const handleCopyCodes = () => {
    if (!setupData?.recovery_codes) return;
    navigator.clipboard.writeText(setupData.recovery_codes.join('\n'));
    setCopiedCodes(true);
    toast.success(t('two_factor.codes_copied', 'Códigos de recuperação copiados!'));
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const handleDownloadCodes = () => {
    if (!setupData?.recovery_codes) return;
    const content = `=== ORBIT DASHBOARD - RECOVERY CODES ===\n\nGuard estes codigos em local seguro. Cada codigo pode ser usado apenas uma vez.\n\n${setupData.recovery_codes.join('\n')}\n\nGerado em: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orbit-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('two_factor.downloaded', 'Arquivo baixado!'));
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || verificationCode.trim().length !== 6) return;

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: setupData.secret,
          code: verificationCode.trim(),
          recovery_codes: setupData.recovery_codes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      toast.success(t('two_factor.enabled_success', 'Autenticação de 2 Fatores ativada com sucesso!'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('two_factor.invalid_code', 'Código de autenticação inválido'));
    } finally {
      setVerifying(false);
    }
  };

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
        <div className="flex items-center justify-between p-4 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orbit-500" />
            <h2 className="font-bold text-base text-primary">
              {t('two_factor.modal_title', 'Configurar Autenticação de 2 Fatores (2FA)')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary transition-colors rounded-xl hover:bg-card-hover"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-500" />
              <p className="text-sm text-secondary">{t('two_factor.generating', 'Gerando chaves de segurança...')}</p>
            </div>
          ) : !setupData ? null : (
        <div className="space-y-6">
          {step === 'scan' ? (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-orbit-500/10 border border-orbit-500/20 text-primary text-sm">
                <ShieldCheck className="w-5 h-5 text-orbit-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {t(
                    'two_factor.instructions',
                    'Escaneie o código QR com seu aplicativo autenticador favorito (Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, etc).'
                  )}
                </p>
              </div>

              {/* QR Code and Secret Key */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-card border border-border">
                <div className="bg-white p-2.5 rounded-xl shadow-md shrink-0 flex items-center justify-center border border-border/40">
                  <img
                    src={setupData.qr_data_url}
                    alt="2FA QR Code"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                </div>

                <div className="space-y-3 w-full">
                  <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-orbit-500" />
                    {t('two_factor.manual_entry', 'Entrada manual da chave')}
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-primary select-all break-all w-full">
                      {setupData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-2 rounded-xl bg-background border border-border hover:bg-card-hover text-secondary hover:text-primary transition-all shrink-0"
                      title={t('common.copy', 'Copiar')}
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    {t('two_factor.manual_entry_help', 'Se não puder escanear, digite a chave acima no seu app.')}
                  </p>
                </div>
              </div>

              {/* Recovery Codes */}
              <div className="space-y-3 p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {t('two_factor.recovery_codes_title', 'Códigos de Recuperação')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCodes}
                      className="text-xs text-secondary hover:text-primary flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background transition-all"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{t('common.copy', 'Copiar')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCodes}
                      className="text-xs text-secondary hover:text-primary flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background transition-all"
                    >
                      <Download className="w-3 h-3" />
                      <span>{t('two_factor.download', 'Baixar')}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-secondary leading-relaxed">
                  {t(
                    'two_factor.recovery_codes_warning',
                    'Guarde estes códigos em local seguro. Cada um permite acessar o painel caso você perca seu telefone.'
                  )}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {(setupData.recovery_codes || []).map((code, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-center font-mono text-xs text-primary font-medium tracking-wide"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="bg-orbit-500 hover:bg-orbit-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-orbit-500/20 active:scale-95"
                >
                  <span>{t('two_factor.next_step', 'Continuar para Verificação')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyAndEnable} className="space-y-5 animate-fade-in">
              <div className="space-y-2 text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-orbit-500/10 text-orbit-500 flex items-center justify-center mx-auto mb-3 border border-orbit-500/20">
                  <QrCode className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-primary">
                  {t('two_factor.verify_title', 'Confirme o Código do Aplicativo')}
                </h4>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  {t(
                    'two_factor.verify_subtitle',
                    'Digite o código de 6 dígitos gerado pelo seu app autenticador para confirmar a ativação.'
                  )}
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold bg-background border border-border rounded-xl py-3 text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-secondary/40"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep('scan')}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-card-hover transition-all"
                >
                  {t('common.back', 'Voltar')}
                </button>

                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 6}
                  className="bg-orbit-500 hover:bg-orbit-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-orbit-500/20 disabled:opacity-50 active:scale-95"
                >
                  {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('two_factor.enable_button', 'Ativar 2FA')}</span>
                </button>
              </div>
            </form>
          )}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
