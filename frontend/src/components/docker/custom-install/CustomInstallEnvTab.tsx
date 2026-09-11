import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

export interface EnvVarItem {
  key: string;
  value: string;
}

interface CustomInstallEnvTabProps {
  envVars: EnvVarItem[];
  setEnvVars: (env: EnvVarItem[]) => void;
}

export function CustomInstallEnvTab({ envVars, setEnvVars }: CustomInstallEnvTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {t('custom_install.env_heading', 'Variáveis de Ambiente')}
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            {t('custom_install.env_sub', 'Ajuste credenciais, PUID/PGID, fuso horário e parâmetros de inicialização.')}
          </p>
        </div>
        <button 
          type="button"
          onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
          className="text-xs flex items-center gap-1.5 bg-accent/80 hover:bg-accent text-primary border border-border px-3 py-1.5 rounded-xl transition-colors font-semibold"
        >
          <Plus className="w-3.5 h-3.5 text-orbit-500" /> {t('common.add', 'Adicionar')}
        </button>
      </div>

      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        {envVars.map((env, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              placeholder="CHAVE"
              value={env.key}
              onChange={(e) => {
                const newEnv = [...envVars];
                newEnv[idx].key = e.target.value;
                setEnvVars(newEnv);
              }}
              className="w-1/3 bg-background border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold focus:border-orbit-500"
            />
            <span className="text-secondary font-bold font-mono">=</span>
            <input
              placeholder="VALOR"
              value={env.value}
              onChange={(e) => {
                const newEnv = [...envVars];
                newEnv[idx].value = e.target.value;
                setEnvVars(newEnv);
              }}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono focus:border-orbit-500"
            />
            <button 
              type="button" 
              onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))}
              className="p-2 text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
              title="Remover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
