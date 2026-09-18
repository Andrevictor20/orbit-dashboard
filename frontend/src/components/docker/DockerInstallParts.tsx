import { useTranslation } from 'react-i18next';
import { ArrowRight, Cpu, HardDrive, Layers, CheckCircle2, AlertTriangle, Sparkles, ShieldAlert } from 'lucide-react';
import type { ParseResponse, PortConflictInfo } from './dockerInstallTypes';

interface ParsedPreviewProps {
  parsedData: ParseResponse;
  appName: string;
  onAppNameChange: (name: string) => void;
  portOverrides: Record<number, number>;
  onPortChange: (originalPort: number, newPortStr: string) => void;
}

export function DockerInstallPreview({ parsedData, appName, onAppNameChange, portOverrides, onPortChange }: ParsedPreviewProps) {
  const { t } = useTranslation();
  const activeConflicts = parsedData.port_conflicts.filter(c => {
    if (!c.in_use) return false;
    return (portOverrides[c.host_port] ?? c.host_port) === c.host_port;
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* App Name & Image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-background/80 border border-border/80 rounded-xl p-3">
          <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-1">{t('docker.container_stack_name', 'Nome do Container / Stack')}</label>
          <input type="text" value={appName} onChange={(e) => onAppNameChange(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary outline-none focus:border-saturn-500 font-mono"
            placeholder="nome-do-app" />
        </div>
        <div className="bg-background/80 border border-border/80 rounded-xl p-3">
          <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-1">{t('docker.docker_image_label', 'Imagem Docker')}</label>
          <div className="text-sm font-mono font-semibold text-saturn-600 dark:text-saturn-300 truncate py-1.5" title={parsedData.image}>
            {parsedData.image || t('docker.defined_in_compose', 'Definida no Compose')}
          </div>
        </div>
      </div>

      {/* Port Conflicts */}
      {parsedData.port_conflicts.length > 0 && (
        <div className="bg-background/80 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5 text-saturn-500" /> {t('docker.port_mapping_conflicts', 'Mapeamento de Portas & Conflitos')}
            </span>
            {activeConflicts.length > 0 ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" /> {t('docker.ports_in_conflict', { count: activeConflicts.length, defaultValue: `${activeConflicts.length} porta(s) em conflito` })}
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" /> {t('docker.ports_available', 'Portas disponíveis')}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {parsedData.port_conflicts.map((pInfo, idx) => {
              const currentHostPort = portOverrides[pInfo.host_port] ?? pInfo.host_port;
              const hasConflict = pInfo.in_use && currentHostPort === pInfo.host_port;
              return (
                <div key={idx} className={`p-3 rounded-xl border transition-colors ${hasConflict ? 'bg-amber-500/10 border-amber-500/40' : 'bg-card border-border/80'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-sm">
                        <span className="text-secondary font-medium">{t('docker.host_port_label', 'Porta Host:')}</span>
                        <input type="number" min={1} max={65535} value={currentHostPort}
                          onChange={(e) => onPortChange(pInfo.host_port, e.target.value)}
                          className={`w-24 px-2 py-1 rounded-lg text-sm font-bold font-mono outline-none border transition-all ${hasConflict ? 'bg-amber-500/10 border-amber-500/60 text-amber-800 dark:text-amber-200 focus:ring-2 focus:ring-amber-400' : 'bg-background border-border text-primary focus:border-saturn-500'}`} />
                        <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-secondary font-medium">{t('docker.container_port_label', 'Container:')}</span>
                        <span className="text-primary font-bold">{pInfo.container_port}/{pInfo.protocol}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      {pInfo.in_use && (
                        <div className="text-[11px] text-secondary">
                          {pInfo.in_use_by ? <span>{t('docker.in_use_by', 'Em uso por:')} <strong className="text-amber-700 dark:text-amber-300">{pInfo.in_use_by}</strong></span> : <span className="text-amber-700 dark:text-amber-300 font-semibold">{t('docker.host_socket_occupied', 'Socket do host ocupado')}</span>}
                        </div>
                      )}
                      {hasConflict && pInfo.suggested_port !== pInfo.host_port && (
                        <button type="button" onClick={() => onPortChange(pInfo.host_port, pInfo.suggested_port.toString())}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-colors">
                          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-300" /> {t('docker.use_suggestion', { port: pInfo.suggested_port, defaultValue: `Usar sugestão (${pInfo.suggested_port})` })}
                        </button>
                      )}
                      {!hasConflict && portOverrides[pInfo.host_port] && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-medium">{t('docker.changed_to_port', { port: currentHostPort, defaultValue: `Alterado para ${currentHostPort}` })}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volumes & Env Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-background/80 border border-border rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <HardDrive className="w-3.5 h-3.5 text-saturn-400" /> {t('docker.volumes_label', 'Volumes')} ({parsedData.services[0]?.volumes.length || 0})
          </span>
          {parsedData.services[0]?.volumes.length ? (
            <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[11px] text-primary">
              {parsedData.services[0].volumes.map((v, i) => (
                <div key={i} className="truncate p-1 bg-card rounded border border-border/50" title={v.raw}>{v.host_path} ➔ {v.container_path}</div>
              ))}
            </div>
          ) : <span className="text-xs text-secondary italic">{t('docker.no_volumes_mapped', 'Nenhum volume mapeado')}</span>}
        </div>

        <div className="bg-background/80 border border-border rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-purple-500" /> {t('docker.env_variables_label', 'Variáveis de Ambiente')} ({Object.keys(parsedData.services[0]?.environment || {}).length})
          </span>
          {Object.keys(parsedData.services[0]?.environment || {}).length ? (
            <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[11px] text-primary">
              {Object.entries(parsedData.services[0].environment).map(([k, v], i) => (
                <div key={i} className="truncate p-1 bg-card rounded border border-border/50"><strong className="text-purple-700 dark:text-purple-300">{k}</strong>={v}</div>
              ))}
            </div>
          ) : <span className="text-xs text-secondary italic">{t('docker.no_env_configured', 'Nenhuma variável configurada')}</span>}
        </div>
      </div>
    </div>
  );
}

interface ConflictDialogProps {
  activeConflicts: PortConflictInfo[];
  onCancel: () => void;
  onForce: () => void;
}

export function DockerConflictDialog({ activeConflicts, onCancel, onForce }: ConflictDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-amber-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-primary">{t('docker.port_conflict_detected', 'Conflito de Portas Detectado')}</h3>
            <p className="text-xs text-secondary">{t('docker.port_conflict_desc', 'Uma ou mais portas host já estão ocupadas por outros serviços.')}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-primary bg-background/80 p-3 rounded-xl border border-border">
          {activeConflicts.map((c, i) => (
            <div key={i} className="flex items-center justify-between font-mono">
              <span>{t('docker.port_prefix', 'Porta')} <strong>{c.host_port}</strong></span>
              <span className="text-amber-700 dark:text-amber-300 font-bold">{c.in_use_by || t('docker.in_use', 'Em uso')}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-secondary">{t('docker.port_conflict_proceed_question', 'Deseja tentar instalar mesmo assim ou prefere ajustar a porta antes de continuar?')}</p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent hover:bg-border text-primary transition-colors">
            {t('docker.back_and_adjust_port', 'Voltar e Ajustar Porta')}
          </button>
          <button type="button" onClick={onForce} className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors">
            {t('docker.install_with_force', 'Instalar com Força')}
          </button>
        </div>
      </div>
    </div>
  );
}
