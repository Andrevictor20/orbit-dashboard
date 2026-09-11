import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { 
  FileCode, 
  FileText, 
  Sparkles, 
  FolderOpen, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { COMPOSE_TEMPLATES } from '../compose/composeTemplates';

export interface StackOption {
  name: string;
  path: string;
  has_compose: boolean;
}

interface ComposeEditorTabProps {
  stackName: string;
  setStackName: (name: string) => void;
  composeYaml: string;
  setComposeYaml: (val: string) => void;
  envContent: string;
  setEnvContent: (val: string) => void;
  existingStacks: StackOption[];
  loadingStacks: boolean;
  loadStacks: () => void;
  onLoadStackContent: (name: string) => void;
  validation: { valid: boolean; error?: string };
  conflictingPorts: number[];
  checkingPorts: boolean;
  onSelectTemplate: (templateId: string) => void;
}

export function ComposeEditorTab({
  stackName,
  setStackName,
  composeYaml,
  setComposeYaml,
  envContent,
  setEnvContent,
  existingStacks,
  loadingStacks,
  loadStacks,
  onLoadStackContent,
  validation,
  conflictingPorts,
  checkingPorts,
  onSelectTemplate
}: ComposeEditorTabProps) {
  const [editorSubTab, setEditorSubTab] = useState<'yaml' | 'env'>('yaml');

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Configuration Bar */}
      <div className="bg-accent/20 border border-border/80 rounded-xl p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Stack ID */}
        <div>
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">
            Nome da Stack (ID)
          </label>
          <input
            type="text"
            placeholder="ex: my-custom-app"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-mono text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          />
        </div>

        {/* Ready Templates Picker */}
        <div>
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-orbit-500" />
            <span>Templates Prontos</span>
          </label>
          <select
            onChange={(e) => onSelectTemplate(e.target.value)}
            defaultValue=""
            className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          >
            <option value="" disabled>Carregar modelo pré-configurado...</option>
            {COMPOSE_TEMPLATES.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>
                {tmpl.name} ({tmpl.category})
              </option>
            ))}
          </select>
        </div>

        {/* Stacks Salvas */}
        <div>
          <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <FolderOpen className="w-3 h-3 text-secondary" />
              <span>Stacks Salvas</span>
            </span>
            <button
              type="button"
              onClick={loadStacks}
              className="text-[10px] text-orbit-500 hover:underline flex items-center gap-1"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loadingStacks ? 'animate-spin' : ''}`} />
              <span>Recarregar</span>
            </button>
          </label>
          <select
            onChange={(e) => onLoadStackContent(e.target.value)}
            value={stackName}
            className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          >
            <option value="">-- Selecionar stack existente --</option>
            {existingStacks.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} {s.has_compose ? '' : '(sem compose)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Validation & Port Conflict Status */}
      <div className="space-y-1.5">
        {!validation.valid && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{validation.error}</span>
          </div>
        )}

        {conflictingPorts.length > 0 && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Atenção:</strong> Porta(s) em uso no host: <span className="font-mono font-bold">{conflictingPorts.join(', ')}</span>.
            </span>
          </div>
        )}

        {validation.valid && conflictingPorts.length === 0 && (
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Sintaxe YAML válida {checkingPorts ? '(verificando portas...)' : 'e sem conflitos.'}</span>
          </div>
        )}
      </div>

      {/* CodeMirror Editor Box */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 bg-accent/40 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditorSubTab('yaml')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                editorSubTab === 'yaml'
                  ? 'bg-card text-orbit-500 shadow-xs border border-border'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>docker-compose.yml</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorSubTab('env')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                editorSubTab === 'env'
                  ? 'bg-card text-orbit-500 shadow-xs border border-border'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.env (Variáveis)</span>
            </button>
          </div>

          <div className="text-[11px] text-secondary font-mono">
            {editorSubTab === 'yaml' ? 'YAML 1.2 · 2 Spaces' : 'KEY=VALUE'}
          </div>
        </div>

        <div className="text-xs font-mono min-h-[300px] max-h-[380px] overflow-auto">
          {editorSubTab === 'yaml' ? (
            <CodeMirror
              value={composeYaml}
              height="350px"
              extensions={[yaml()]}
              onChange={(val) => setComposeYaml(val)}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                tabSize: 2,
              }}
            />
          ) : (
            <CodeMirror
              value={envContent}
              height="350px"
              onChange={(val) => setEnvContent(val)}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                tabSize: 2,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
