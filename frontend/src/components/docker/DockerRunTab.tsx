import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Terminal, 
  AlertTriangle, 
  Play, 
  Layers, 
  HardDrive, 
  ArrowRight, 
  FileCode,
  Loader2 
} from 'lucide-react';
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

interface DockerRunTabProps {
  onTransferToEditor: (yaml: string, name: string) => void;
  onSuccess: (appName: string) => void;
  onClose: () => void;
  startInstall: (taskId: string, title: string) => void;
}

export function DockerRunTab({ onTransferToEditor, onSuccess, onClose, startInstall }: DockerRunTabProps) {
  const { t } = useTranslation();
  const [rawInput, setRawInput] = useState('');
  const [appName, setAppName] = useState('');
  const [parsedData, setParsedData] = useState<ParseResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [portOverrides, setPortOverrides] = useState<Record<number, number>>({});
  const [installing, setInstalling] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (value: string) => {
    setRawInput(value);
    setParseError(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
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
        credentials: 'include',
        body: JSON.stringify({ raw_input: inputToParse })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Não foi possível interpretar o comando.');
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

  const handleStartInstallation = async () => {
    if (!parsedData) {
      toast.error(t('docker_install.insert_valid', 'Insira um comando docker run ou compose válido.'));
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
        credentials: 'include',
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
        onSuccess(finalAppName);
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao instalar container.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Input text area */}
      <div>
        <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-orbit-500" />
            <span>{t('docker_install.input_label', 'Comando Docker Run ou Conteúdo Compose:')}</span>
          </span>
          {parsing && (
            <span className="flex items-center gap-1 text-[11px] text-orbit-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Analisando...</span>
            </span>
          )}
        </label>
        <textarea
          rows={5}
          value={rawInput}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t('docker_install.input_placeholder', 'Exemplos:\n• docker run -d --name meunegocio -p 8080:80 -v ./data:/data nginx:alpine\n• docker compose com services...')}
          className="w-full bg-accent/40 border border-border rounded-xl p-3 text-xs font-mono text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-orbit-500"
        />
      </div>

      {parseError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Parsed Result Preview */}
      {parsedData && (
        <div className="bg-accent/20 border border-border/80 rounded-xl p-4 space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <span className="text-xs text-secondary">Nome detectado:</span>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="ml-2 px-2 py-1 bg-card border border-border rounded-lg text-xs font-mono text-primary font-bold"
              />
            </div>

            <button
              type="button"
              onClick={() => onTransferToEditor(parsedData.compose_yaml, appName || parsedData.app_name)}
              className="px-3 py-1.5 bg-accent hover:bg-card border border-border text-xs text-primary rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto font-medium"
            >
              <FileCode className="w-3.5 h-3.5 text-orbit-500" />
              <span>Abrir no Editor Compose</span>
              <ArrowRight className="w-3 h-3 text-secondary" />
            </button>
          </div>

          {/* Services & Ports */}
          <div className="space-y-2">
            {parsedData.services.map((svc, idx) => (
              <div key={idx} className="text-xs font-mono space-y-1">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Layers className="w-3.5 h-3.5 text-orbit-500" />
                  <span>{svc.name}</span>
                  <span className="text-secondary font-normal font-sans text-[11px]">({svc.image})</span>
                </div>

                {/* Ports */}
                {svc.ports && svc.ports.length > 0 && (
                  <div className="pl-5 space-y-1">
                    {svc.ports.map((p, pIdx) => {
                      const conflict = parsedData.port_conflicts.find(c => c.host_port === p.host_port && c.in_use);
                      const currentPort = p.host_port ? (portOverrides[p.host_port] ?? p.host_port) : null;
                      return (
                        <div key={pIdx} className="flex items-center gap-2 text-[11px]">
                          <span>Porta:</span>
                          {p.host_port ? (
                            <input
                              type="number"
                              value={currentPort || ''}
                              onChange={(e) => handlePortChange(p.host_port!, e.target.value)}
                              className="w-16 px-1.5 py-0.5 bg-card border border-border rounded text-center"
                            />
                          ) : (
                            <span className="text-secondary">dinâmica</span>
                          )}
                          <span>-&gt; {p.container_port}/{p.protocol}</span>
                          {conflict && (
                            <span className="text-rose-400 flex items-center gap-1 font-sans text-[10px]">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Em uso ({conflict.in_use_by || 'host'})</span>
                              <button
                                type="button"
                                onClick={() => handlePortChange(p.host_port!, String(conflict.suggested_port))}
                                className="underline hover:text-rose-300 ml-1"
                              >
                                Usar {conflict.suggested_port}
                              </button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Volumes */}
                {svc.volumes && svc.volumes.length > 0 && (
                  <div className="pl-5 space-y-0.5 text-[11px] text-secondary">
                    {svc.volumes.map((v, vIdx) => (
                      <div key={vIdx} className="flex items-center gap-1.5 truncate">
                        <HardDrive className="w-3 h-3 text-secondary shrink-0" />
                        <span className="truncate">{v.host_path} : {v.container_path}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStartInstallation}
              disabled={installing}
              className="px-4 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-orbit-500/20 active:scale-95 disabled:opacity-50"
            >
              {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{t('docker_install.install_container', 'Instalar Container')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
