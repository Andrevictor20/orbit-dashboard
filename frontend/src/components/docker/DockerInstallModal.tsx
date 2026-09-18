import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Terminal, AlertTriangle, Play, RefreshCw, FileCode } from 'lucide-react';
import { useInstall } from '../../contexts/InstallContext';
import toast from 'react-hot-toast';
import type { ParseResponse, DockerInstallModalProps } from './dockerInstallTypes';
import { DockerInstallPreview, DockerConflictDialog } from './DockerInstallParts';

export type { PortConflictInfo, ParsedService, ParseResponse } from './dockerInstallTypes';

export function DockerInstallModal({ isOpen, onClose, onSuccess }: DockerInstallModalProps) {
  const { t } = useTranslation();
  const { startInstall } = useInstall();
  const [rawInput, setRawInput] = useState('');
  const [appName, setAppName] = useState('');
  const [parsedData, setParsedData] = useState<ParseResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [portOverrides, setPortOverrides] = useState<Record<number, number>>({});
  const [installing, setInstalling] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRawInput(''); setAppName(''); setParsedData(null);
      setParseError(null); setPortOverrides({}); setInstalling(false); setShowConflictModal(false);
    }
  }, [isOpen]);

  const triggerParse = async (inputToParse: string) => {
    if (!inputToParse.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch('/api/docker/compose/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ raw_input: inputToParse }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || t('docker.could_not_parse_input', 'Não foi possível interpretar o comando ou arquivo.'));
      }
      const data: ParseResponse = await res.json();
      setParsedData(data);
      if (!appName || appName === parsedData?.app_name) setAppName(data.app_name);
      setPortOverrides({});
    } catch (err: any) {
      setParseError(err.message || t('docker.error_processing_command', 'Erro ao processar o comando.'));
      setParsedData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleInputChange = (value: string) => {
    setRawInput(value);
    setParseError(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value.trim()) { setParsedData(null); return; }
    debounceTimer.current = setTimeout(() => triggerParse(value), 450);
  };

  const handlePortChange = (originalPort: number, newPortStr: string) => {
    const val = parseInt(newPortStr, 10);
    if (!isNaN(val) && val > 0 && val <= 65535) setPortOverrides(prev => ({ ...prev, [originalPort]: val }));
    else if (newPortStr === '') setPortOverrides(prev => { const copy = { ...prev }; delete copy[originalPort]; return copy; });
  };

  const activeConflicts = parsedData?.port_conflicts.filter(c => {
    if (!c.in_use) return false;
    return (portOverrides[c.host_port] ?? c.host_port) === c.host_port;
  }) || [];

  const handleStartInstallation = async (bypassConflictWarning = false) => {
    if (!parsedData) { toast.error(t('docker.enter_valid_docker_cmd', 'Insira um comando docker run ou docker compose válido.')); return; }
    if (activeConflicts.length > 0 && !bypassConflictWarning) { setShowConflictModal(true); return; }

    const finalAppName = appName.trim() || parsedData.app_name;
    setInstalling(true);
    try {
      const token = localStorage.getItem('saturn_token');
      const res = await fetch('/api/docker/compose/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ app_name: finalAppName, compose_yaml: parsedData.compose_yaml, override_ports: portOverrides }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || t('docker.error_starting_container_install', 'Erro ao iniciar instalação do container.'));
      }
      const data = await res.json();
      if (data.task_id) {
        toast.success(t('docker.starting_install_name', { name: finalAppName, defaultValue: `Iniciando instalação de ${finalAppName}!` }));
        startInstall(data.task_id, finalAppName);
        onClose();
        if (onSuccess) onSuccess(finalAppName);
      }
    } catch (err: any) {
      toast.error(err.message || t('docker.install_container_failed', 'Falha ao instalar container.'));
    } finally {
      setInstalling(false);
      setShowConflictModal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-background/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-saturn-500/15 text-saturn-400 border border-saturn-500/20"><Terminal className="w-5 h-5" /></div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                {t('docker.install_via_docker_run_compose', 'Instalar via Docker Run ou Compose')}
                {parsedData && <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-saturn-500/15 text-saturn-700 dark:text-saturn-300 border border-saturn-500/30">{parsedData.input_type === 'docker_run' ? 'Docker Run CLI' : 'Docker Compose YAML'}</span>}
              </h2>
              <p className="text-xs text-secondary">{t('docker.paste_cmd_yaml_desc', 'Cole o comando ou arquivo YAML para instalar o container automaticamente.')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors" aria-label={t('common.close_modal', 'Fechar modal')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-secondary">
              <label htmlFor="docker-input" className="flex items-center gap-1.5"><FileCode className="w-3.5 h-3.5 text-saturn-400" />{t('docker.cmd_or_compose_content', 'Comando Docker Run ou Conteúdo Compose:')}</label>
              {parsing && <span className="text-saturn-400 flex items-center gap-1 font-mono text-[11px] animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" />{t('docker.analyzing_params', 'Analisando parâmetros...')}</span>}
            </div>
            <div className="relative">
              <textarea id="docker-input" rows={5} value={rawInput} onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Exemplos:\n• docker run -d --name meunegocio -p 8080:80 -v ./data:/data nginx:alpine\n• docker compose com services...`}
                className="w-full bg-background border border-border focus:border-saturn-500/70 focus:ring-2 focus:ring-saturn-500/20 rounded-xl p-3.5 text-xs sm:text-sm text-primary font-mono outline-none transition-all resize-y leading-relaxed placeholder:text-zinc-600"
                autoFocus />
            </div>
          </div>

          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div><span className="font-semibold block">{t('docker.parse_error_title', 'Erro na interpretação do comando:')}</span><span className="text-rose-600 dark:text-rose-200 font-mono text-[11px]">{parseError}</span></div>
            </div>
          )}

          {parsedData && (
            <DockerInstallPreview
              parsedData={parsedData} appName={appName} onAppNameChange={setAppName}
              portOverrides={portOverrides} onPortChange={handlePortChange}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/80 bg-background/50">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-secondary hover:text-primary hover:bg-accent transition-colors">{t('common.cancel', 'Cancelar')}</button>
          <button type="button" disabled={!parsedData || parsing || installing} onClick={() => handleStartInstallation(false)}
            className="px-5 py-2 rounded-xl bg-saturn-500 hover:bg-saturn-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm shadow-md shadow-saturn-500/20 flex items-center gap-2 transition-all">
            {installing ? <><RefreshCw className="w-4 h-4 animate-spin" />{t('common.starting', 'Iniciando...')}</> : <><Play className="w-4 h-4 fill-white" />{t('docker.install_container_button', 'Instalar Container')}</>}
          </button>
        </div>

        {showConflictModal && (
          <DockerConflictDialog
            activeConflicts={activeConflicts}
            onCancel={() => setShowConflictModal(false)}
            onForce={() => handleStartInstallation(true)}
          />
        )}
      </div>
    </div>
  );
}
