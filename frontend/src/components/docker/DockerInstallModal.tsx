import { useState, useEffect, useRef } from 'react';
import { 
  X, Terminal, AlertTriangle, CheckCircle2, Play, 
  Layers, HardDrive, Cpu, ArrowRight, ShieldAlert, 
  RefreshCw, Sparkles, FileCode
} from 'lucide-react';
import { useInstall } from '../../contexts/InstallContext';
import toast from 'react-hot-toast';

export interface PortConflictInfo {
  host_port: number;
  container_port: number;
  protocol: string;
  in_use: boolean;
  in_use_by?: string;
  suggested_port: number;
}

export interface ParsedService {
  name: string;
  image: string;
  restart?: string;
  ports: {
    host_port?: number;
    container_port: number;
    protocol: string;
    raw: string;
  }[];
  volumes: {
    host_path: string;
    container_path: string;
    mode?: string;
    raw: string;
  }[];
  environment: Record<string, string>;
  command?: string[];
  network?: string;
  privileged: boolean;
}

export interface ParseResponse {
  input_type: 'docker_run' | 'docker_compose';
  app_name: string;
  image: string;
  services: ParsedService[];
  compose_yaml: string;
  port_conflicts: PortConflictInfo[];
}

interface DockerInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
}

export function DockerInstallModal({ isOpen, onClose, onSuccess }: DockerInstallModalProps) {
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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRawInput('');
      setAppName('');
      setParsedData(null);
      setParseError(null);
      setPortOverrides({});
      setInstalling(false);
      setShowConflictModal(false);
    }
  }, [isOpen]);

  // Debounced auto-parse on input change
  const handleInputChange = (value: string) => {
    setRawInput(value);
    setParseError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!value.trim()) {
      setParsedData(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      triggerParse(value);
    }, 450);
  };

  const triggerParse = async (inputToParse: string) => {
    if (!inputToParse.trim()) return;
    setParsing(true);
    setParseError(null);

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/compose/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ raw_input: inputToParse })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Não foi possível interpretar o comando ou arquivo.');
      }

      const data: ParseResponse = await res.json();
      setParsedData(data);
      if (!appName || appName === parsedData?.app_name) {
        setAppName(data.app_name);
      }
      setPortOverrides({});

    } catch (err: any) {
      setParseError(err.message || 'Erro ao processar o comando.');
      setParsedData(null);
    } finally {
      setParsing(false);
    }
  };

  const handlePortChange = (originalPort: number, newPortStr: string) => {
    const val = parseInt(newPortStr, 10);
    if (!isNaN(val) && val > 0 && val <= 65535) {
      setPortOverrides(prev => ({ ...prev, [originalPort]: val }));
    } else if (newPortStr === '') {
      setPortOverrides(prev => {
        const copy = { ...prev };
        delete copy[originalPort];
        return copy;
      });
    }
  };

  // Check if any active conflicts remain unresolved
  const activeConflicts = parsedData?.port_conflicts.filter(c => {
    if (!c.in_use) return false;
    const currentAssignedPort = portOverrides[c.host_port] ?? c.host_port;
    return currentAssignedPort === c.host_port;
  }) || [];

  const handleStartInstallation = async (bypassConflictWarning = false) => {
    if (!parsedData) {
      toast.error('Insira um comando docker run ou docker compose válido.');
      return;
    }

    if (activeConflicts.length > 0 && !bypassConflictWarning) {
      setShowConflictModal(true);
      return;
    }

    const finalAppName = appName.trim() || parsedData.app_name;
    setInstalling(true);

    try {
      const token = localStorage.getItem('orbit_token');
      const res = await fetch('/api/docker/compose/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          app_name: finalAppName,
          compose_yaml: parsedData.compose_yaml,
          override_ports: portOverrides
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao iniciar instalação do container.');
      }

      const data = await res.json();
      if (data.task_id) {
        toast.success(`Iniciando instalação de ${finalAppName}!`);
        startInstall(data.task_id, finalAppName);
        onClose();
        if (onSuccess) onSuccess(finalAppName);
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao instalar container.');
    } finally {
      setInstalling(false);
      setShowConflictModal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-background/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orbit-500/15 text-orbit-400 border border-orbit-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                Instalar via Docker Run ou Compose
                {parsedData && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orbit-500/15 text-orbit-300 border border-orbit-500/30">
                    {parsedData.input_type === 'docker_run' ? 'Docker Run CLI' : 'Docker Compose YAML'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-secondary">
                Cole o comando ou arquivo YAML para instalar o container automaticamente.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-secondary hover:text-primary hover:bg-accent rounded-lg transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Textarea Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-secondary">
              <label htmlFor="docker-input" className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-orbit-400" />
                Comando Docker Run ou Conteúdo Compose:
              </label>
              {parsing && (
                <span className="text-orbit-400 flex items-center gap-1 font-mono text-[11px] animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Analisando parâmetros...
                </span>
              )}
            </div>
            <div className="relative">
              <textarea
                id="docker-input"
                rows={5}
                value={rawInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Exemplos:\n• docker run -d --name meunegocio -p 8080:80 -v ./data:/data nginx:alpine\n• docker compose com services...`}
                className="w-full bg-background border border-border focus:border-orbit-500/70 focus:ring-2 focus:ring-orbit-500/20 rounded-xl p-3.5 text-xs sm:text-sm text-primary font-mono outline-none transition-all resize-y leading-relaxed placeholder:text-zinc-600"
                autoFocus
              />
            </div>
          </div>

          {/* Error Banner */}
          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Erro na interpretação do comando:</span>
                <span className="text-rose-200/90 font-mono text-[11px]">{parseError}</span>
              </div>
            </div>
          )}

          {/* Parsed Breakdown & Configuration */}
          {parsedData && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* App Name & Image Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-background/80 border border-border/80 rounded-xl p-3">
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-1">
                    Nome do Container / Stack
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary outline-none focus:border-orbit-500 font-mono"
                    placeholder="nome-do-app"
                  />
                </div>
                <div className="bg-background/80 border border-border/80 rounded-xl p-3">
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-1">
                    Imagem Docker
                  </label>
                  <div className="text-sm font-mono font-semibold text-orbit-300 truncate py-1.5" title={parsedData.image}>
                    {parsedData.image || 'Definida no Compose'}
                  </div>
                </div>
              </div>

              {/* Port Conflict Warnings and Direct Editor */}
              {parsedData.port_conflicts.length > 0 && (
                <div className="bg-background/80 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <Cpu className="w-3.5 h-3.5 text-orbit-400" />
                      Mapeamento de Portas & Conflitos
                    </span>
                    {activeConflicts.length > 0 ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" /> {activeConflicts.length} porta(s) em conflito
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-medium flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Portas disponíveis
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {parsedData.port_conflicts.map((pInfo, idx) => {
                      const currentHostPort = portOverrides[pInfo.host_port] ?? pInfo.host_port;
                      const hasConflict = pInfo.in_use && currentHostPort === pInfo.host_port;

                      return (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border transition-colors ${
                            hasConflict 
                              ? 'bg-amber-500/10 border-amber-500/40' 
                              : 'bg-card border-border/80'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 font-mono text-sm">
                                <span className="text-secondary font-medium">Porta Host:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={65535}
                                  value={currentHostPort}
                                  onChange={(e) => handlePortChange(pInfo.host_port, e.target.value)}
                                  className={`w-24 px-2 py-1 rounded-lg text-sm font-bold font-mono outline-none border transition-all ${
                                    hasConflict
                                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 focus:ring-2 focus:ring-amber-400'
                                      : 'bg-background border-border text-primary focus:border-orbit-500'
                                  }`}
                                />
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-secondary font-medium">Container:</span>
                                <span className="text-primary font-bold">{pInfo.container_port}/{pInfo.protocol}</span>
                              </div>
                            </div>

                            {/* Status & Quick Action */}
                            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                              {pInfo.in_use && (
                                <div className="text-[11px] text-zinc-400">
                                  {pInfo.in_use_by ? (
                                    <span>Em uso por: <strong className="text-amber-300">{pInfo.in_use_by}</strong></span>
                                  ) : (
                                    <span className="text-amber-300">Socket do host ocupado</span>
                                  )}
                                </div>
                              )}

                              {hasConflict && pInfo.suggested_port !== pInfo.host_port && (
                                <button
                                  type="button"
                                  onClick={() => handlePortChange(pInfo.host_port, pInfo.suggested_port.toString())}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  Usar sugestão ({pInfo.suggested_port})
                                </button>
                              )}

                              {!hasConflict && portOverrides[pInfo.host_port] && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-medium">
                                  Alterado para {currentHostPort}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Volumes and Environment Summary Bento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Volumes */}
                <div className="bg-background/80 border border-border rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <HardDrive className="w-3.5 h-3.5 text-orbit-400" />
                    Volumes ({parsedData.services[0]?.volumes.length || 0})
                  </span>
                  {parsedData.services[0]?.volumes.length ? (
                    <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[11px] text-zinc-300">
                      {parsedData.services[0].volumes.map((v, i) => (
                        <div key={i} className="truncate p-1 bg-card rounded border border-border/50" title={v.raw}>
                          {v.host_path} ➔ {v.container_path}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">Nenhum volume mapeado</span>
                  )}
                </div>

                {/* Env Vars */}
                <div className="bg-background/80 border border-border rounded-xl p-3.5 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Variáveis de Ambiente ({Object.keys(parsedData.services[0]?.environment || {}).length})
                  </span>
                  {Object.keys(parsedData.services[0]?.environment || {}).length ? (
                    <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[11px] text-zinc-300">
                      {Object.entries(parsedData.services[0].environment).map(([k, v], i) => (
                        <div key={i} className="truncate p-1 bg-card rounded border border-border/50">
                          <strong className="text-purple-300">{k}</strong>={v}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">Nenhuma variável configurada</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/80 bg-background/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-secondary hover:text-primary hover:bg-accent transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!parsedData || parsing || installing}
            onClick={() => handleStartInstallation(false)}
            className="px-5 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm shadow-md shadow-orbit-500/20 flex items-center gap-2 transition-all"
          >
            {installing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Instalar Container
              </>
            )}
          </button>
        </div>

        {/* Port Conflict Confirmation Sub-Dialog */}
        {showConflictModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-card border border-amber-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">Conflito de Portas Detectado</h3>
                  <p className="text-xs text-secondary">
                    Uma ou mais portas host já estão ocupadas por outros serviços.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 bg-background/80 p-3 rounded-xl border border-border">
                {activeConflicts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between font-mono">
                    <span>Porta <strong>{c.host_port}</strong></span>
                    <span className="text-amber-300 font-semibold">{c.in_use_by || 'Em uso'}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-secondary">
                Deseja tentar instalar mesmo assim ou prefere ajustar a porta antes de continuar?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent hover:bg-border text-primary transition-colors"
                >
                  Voltar e Ajustar Porta
                </button>
                <button
                  type="button"
                  onClick={() => handleStartInstallation(true)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors"
                >
                  Instalar com Força
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
