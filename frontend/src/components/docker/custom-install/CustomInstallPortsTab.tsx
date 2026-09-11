import { useTranslation } from 'react-i18next';
import { Plus, X, AlertTriangle, RefreshCw } from 'lucide-react';

export interface PortMappingItem {
  host: string;
  container: string;
  protocol: string;
  in_use?: boolean;
  suggested_port?: number;
}

interface CustomInstallPortsTabProps {
  ports: PortMappingItem[];
  setPorts: (ports: PortMappingItem[]) => void;
  checkingPorts: boolean;
  onCheckConflicts: (ports: PortMappingItem[]) => void;
  onApplySuggestedPort: (idx: number, suggested: number) => void;
}

export function CustomInstallPortsTab({
  ports,
  setPorts,
  checkingPorts,
  onCheckConflicts,
  onApplySuggestedPort
}: CustomInstallPortsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {t('custom_install.ports_heading', 'Mapeamento de Portas')}
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            {t('custom_install.ports_sub', 'Redirecione as portas do contêiner para o host evitando conflitos.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onCheckConflicts(ports)}
            disabled={checkingPorts}
            className="text-xs flex items-center gap-1.5 bg-accent/60 hover:bg-accent text-secondary hover:text-primary border border-border px-2.5 py-1.5 rounded-xl transition-colors"
            title="Verificar conflitos de portas com o host"
          >
            <RefreshCw className={`w-3 h-3 text-orbit-500 ${checkingPorts ? 'animate-spin' : ''}`} />
            <span>{checkingPorts ? 'Checando...' : 'Checar Conflitos'}</span>
          </button>
          <button 
            type="button"
            onClick={() => setPorts([...ports, { host: '', container: '', protocol: 'tcp' }])}
            className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-orbit-500" /> {t('common.add', 'Adicionar')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {ports.map((port, idx) => (
          <div key={idx} className="bg-background/80 border border-border p-3 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                  {t('custom_install.host_port', 'Porta do Host')}
                </label>
                <input
                  type="number"
                  placeholder="Host"
                  value={port.host}
                  onChange={(e) => {
                    const newPorts = [...ports];
                    newPorts[idx].host = e.target.value;
                    setPorts(newPorts);
                  }}
                  onBlur={() => onCheckConflicts(ports)}
                  className={`w-full bg-card border rounded-xl px-3 py-1.5 text-sm text-primary font-mono transition-all ${
                    port.in_use ? 'border-rose-500 bg-rose-500/10' : 'border-border focus:border-orbit-500'
                  }`}
                />
              </div>

              <span className="text-secondary font-bold font-mono pt-4">:</span>

              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                  {t('custom_install.container_port', 'Porta Container')}
                </label>
                <input
                  type="number"
                  placeholder="Container"
                  value={port.container}
                  onChange={(e) => {
                    const newPorts = [...ports];
                    newPorts[idx].container = e.target.value;
                    setPorts(newPorts);
                  }}
                  className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-primary font-mono"
                />
              </div>

              <div className="w-24">
                <label className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-1">
                  {t('custom_install.protocol', 'Protocolo')}
                </label>
                <select
                  value={port.protocol}
                  onChange={(e) => {
                    const newPorts = [...ports];
                    newPorts[idx].protocol = e.target.value;
                    setPorts(newPorts);
                  }}
                  className="w-full bg-card border border-border rounded-xl px-2 py-1.5 text-xs text-primary font-mono"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                </select>
              </div>

              <div className="pt-4">
                <button 
                  type="button" 
                  onClick={() => setPorts(ports.filter((_, i) => i !== idx))}
                  className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                  title="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {port.in_use && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t('custom_install.port_conflict_alert', 'Porta {{port}} já está em uso no host!', { port: port.host })}</span>
                </div>
                {port.suggested_port && (
                  <button
                    type="button"
                    onClick={() => onApplySuggestedPort(idx, port.suggested_port!)}
                    className="px-2 py-0.5 bg-rose-500 text-white rounded font-bold text-[10px] hover:bg-rose-600 transition-colors"
                  >
                    {t('custom_install.use_suggested', 'Usar {{port}}', { port: port.suggested_port })}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
