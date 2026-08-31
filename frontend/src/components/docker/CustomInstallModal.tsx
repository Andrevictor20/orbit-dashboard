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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Instalação Personalizada
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Ports */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">Portas</label>
              <button 
                type="button"
                onClick={() => setPorts([...ports, { host: '', container: '', protocol: 'tcp' }])}
                className="text-xs flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            
            <div className="space-y-2">
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
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    placeholder="Container"
                    value={port.container}
                    onChange={(e) => {
                      const newPorts = [...ports];
                      newPorts[idx].container = e.target.value;
                      setPorts(newPorts);
                    }}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <select
                    value={port.protocol}
                    onChange={(e) => {
                      const newPorts = [...ports];
                      newPorts[idx].protocol = e.target.value;
                      setPorts(newPorts);
                    }}
                    className="w-24 bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                  <button 
                    type="button" 
                    onClick={() => setPorts(ports.filter((_, i) => i !== idx))}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-md transition-colors"
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
              <label className="text-sm font-medium text-gray-300">Volumes</label>
              <button 
                type="button"
                onClick={() => setVolumes([...volumes, { host: '', container: '' }])}
                className="text-xs flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            
            <div className="space-y-2">
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
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    placeholder="Container (/config)"
                    value={vol.container}
                    onChange={(e) => {
                      const newVols = [...volumes];
                      newVols[idx].container = e.target.value;
                      setVolumes(newVols);
                    }}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVolumes(volumes.filter((_, i) => i !== idx))}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
        
        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-gray-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
