import { createPortal } from 'react-dom';
import { Globe, X } from 'lucide-react';

export interface CustomLinkModalProps {
  isOpen: boolean;
  linkMode: 'builder' | 'raw';
  setLinkMode: (mode: 'builder' | 'raw') => void;
  linkSubdomain: string;
  setLinkSubdomain: (val: string) => void;
  linkDomain: string;
  setLinkDomain: (val: string) => void;
  linkInput: string;
  setLinkInput: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function CustomLinkModal({
  isOpen,
  linkMode,
  setLinkMode,
  linkSubdomain,
  setLinkSubdomain,
  linkDomain,
  setLinkDomain,
  linkInput,
  setLinkInput,
  onSave,
  onClose,
}: CustomLinkModalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-lg mx-auto my-auto max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-600 dark:text-orbit-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-primary">
                Link Customizado do App
              </h3>
              <p className="text-xs text-slate-600 dark:text-secondary">Defina um domínio ou URL direta para acesso rápido</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex bg-background/60 border border-border rounded-xl p-1 mb-4">
          <button 
            onClick={() => setLinkMode('builder')} 
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors min-h-[38px] ${
              linkMode === 'builder' 
                ? 'bg-orbit-500 text-white shadow-sm font-semibold' 
                : 'text-slate-700 dark:text-secondary hover:text-primary font-medium'
            }`}
          >
            Construtor Automático
          </button>
          <button 
            onClick={() => setLinkMode('raw')} 
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors min-h-[38px] ${
              linkMode === 'raw' 
                ? 'bg-orbit-500 text-white shadow-sm font-semibold' 
                : 'text-slate-700 dark:text-secondary hover:text-primary font-medium'
            }`}
          >
            URL Completa
          </button>
        </div>

        {linkMode === 'builder' ? (
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-primary/80 dark:text-secondary mb-1.5">Subdomínio (App)</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
                  placeholder="meu-app"
                  value={linkSubdomain}
                  onChange={(e) => setLinkSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary/80 dark:text-secondary mb-1.5">Domínio Base</label>
                <input 
                  type="text" 
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
                  placeholder="exemplo.com"
                  value={linkDomain}
                  onChange={(e) => setLinkDomain(e.target.value.toLowerCase())}
                />
              </div>
            </div>
            <div className="bg-background/80 rounded-xl p-3.5 border border-border">
              <span className="text-xs text-primary/80 dark:text-secondary block mb-1 font-medium">Hostname final de acesso:</span>
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-mono break-all font-semibold">
                {linkSubdomain && linkDomain ? `https://${linkSubdomain}.${linkDomain}` : 'Preencha os campos acima...'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-6 space-y-2">
            <label className="block text-xs font-semibold text-primary/80 dark:text-secondary">
              Insira a URL customizada completa (deixe em branco para remover):
            </label>
            <input 
              type="text" 
              autoFocus
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-2 focus:ring-orbit-500/50 focus:border-orbit-500 transition-all font-mono text-sm"
              placeholder="https://exemplo.com:8080/caminho"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-2">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-700 dark:text-secondary hover:text-primary hover:bg-accent/50 transition-colors text-sm font-medium text-center"
          >
            Cancelar
          </button>
          <button 
            onClick={onSave}
            className="w-full sm:w-auto px-5 py-2.5 bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white rounded-xl transition-all text-sm font-semibold shadow-md shadow-orbit-500/20 text-center"
          >
            Salvar Link
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
