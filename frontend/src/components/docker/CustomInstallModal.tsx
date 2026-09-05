import React, { useState } from 'react';
import { X, Plus, Terminal } from 'lucide-react';

interface CustomInstallModalProps {
  appId: string;
  onClose: () => void;
  onInstall: (payload: any) => void;
}

export function CustomInstallModal({ onClose, onInstall }: CustomInstallModalProps) {
  const [envVars] = useState([{ key: 'TZ', value: 'America/Sao_Paulo' }]);
  const [ports, setPorts] = useState([{ host: '8080', container: '80', protocol: 'tcp' }]);
  const [volumes, setVolumes] = useState([{ host: '/DATA/AppData', container: '/config' }]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validPorts = ports.filter(p => p.host.trim() !== '' && p.container.trim() !== '');
    const validVolumes = volumes.filter(v => v.host.trim() !== '' && v.container.trim() !== '');
    const validEnvVars = envVars.filter(e => e.key.trim() !== '');

    const payload = {
      env: validEnvVars.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
      ports: validPorts.map(p => ({ 
        host: parseInt(p.host) || 0, 
        container: parseInt(p.container) || 0, 
        protocol: p.protocol 
      })),
      volumes: validVolumes.map(v => ({ host: v.host, container: v.container }))
    };

    onInstall(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-primary animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
            <Terminal className="w-5 h-5 text-orbit-500" />
            Instalação Personalizada
          </h2>
          <button onClick={onClose} className="p-2 text-secondary hover:text-primary hover:bg-accent rounded-xl transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Ports */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-primary">Portas</label>
              <button 
                type="button"
                onClick={() => setPorts([...ports, { host: '', container: '', protocol: 'tcp' }])}
                className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
              >
                <Plus className="w-3.5 h-3.5 text-orbit-500" /> Adicionar
              </button>
            </div>
            
            <div className="space-y-2.5">
              {ports.map((port, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    placeholder="Host"
                    value={port.host}
                    onChange={(e) => {
                      const newPorts = [...ports];
                      newPorts[idx].host = e.target.value;
                      setPorts(newPorts);
                    }}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 font-mono transition-all"
                  />
                  <span className="text-secondary font-bold font-mono">:</span>
                  <input
                    placeholder="Container"
                    value={port.container}
                    onChange={(e) => {
                      const newPorts = [...ports];
                      newPorts[idx].container = e.target.value;
                      setPorts(newPorts);
                    }}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 font-mono transition-all"
                  />
                  <select
                    value={port.protocol}
                    onChange={(e) => {
                      const newPorts = [...ports];
                      newPorts[idx].protocol = e.target.value;
                      setPorts(newPorts);
                    }}
                    className="w-24 bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 font-mono transition-all"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setPorts(ports.filter((_, i) => i !== idx))}
                    className="p-2 text-secondary hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Remover porta"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Volumes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-primary">Volumes</label>
              <button 
                type="button"
                onClick={() => setVolumes([...volumes, { host: '', container: '' }])}
                className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
              >
                <Plus className="w-3.5 h-3.5 text-orbit-500" /> Adicionar
              </button>
            </div>
            
            <div className="space-y-2.5">
              {volumes.map((vol, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    placeholder="Host (/DATA/...)"
                    value={vol.host}
                    onChange={(e) => {
                      const newVols = [...volumes];
                      newVols[idx].host = e.target.value;
                      setVolumes(newVols);
                    }}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 font-mono transition-all"
                  />
                  <span className="text-secondary font-bold font-mono">:</span>
                  <input
                    placeholder="Container (/config)"
                    value={vol.container}
                    onChange={(e) => {
                      const newVols = [...volumes];
                      newVols[idx].container = e.target.value;
                      setVolumes(newVols);
                    }}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500 font-mono transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVolumes(volumes.filter((_, i) => i !== idx))}
                    className="p-2 text-secondary hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Remover volume"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
        
        <div className="p-4 sm:px-6 border-t border-border flex justify-end gap-3 bg-muted/20 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-secondary hover:text-primary hover:bg-accent/60 rounded-xl transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-orbit-500 text-white rounded-xl font-semibold hover:bg-orbit-600 active:scale-95 shadow-md shadow-orbit-500/20 transition-all text-sm"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
