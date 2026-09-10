import { useState, useEffect, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { 
  FileCode, 
  Save, 
  Play, 
  Plus, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { COMPOSE_TEMPLATES } from '../components/compose/composeTemplates';
import { extractPortsFromYaml, validateComposeSyntax } from '../components/compose/yamlValidator';

interface StackOption {
  name: string;
  path: string;
  has_compose: boolean;
}

export default function ComposeEditor() {
  const [stackName, setStackName] = useState('');
  const [composeYaml, setComposeYaml] = useState(COMPOSE_TEMPLATES[0].yaml);
  const [envContent, setEnvContent] = useState(COMPOSE_TEMPLATES[0].env || '');
  const [activeTab, setActiveTab] = useState<'yaml' | 'env'>('yaml');
  const [existingStacks, setExistingStacks] = useState<StackOption[]>([]);
  const [loadingStacks, setLoadingStacks] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [conflictingPorts, setConflictingPorts] = useState<number[]>([]);
  const [checkingPorts, setCheckingPorts] = useState(false);

  // Load existing stacks
  const loadStacks = useCallback(async () => {
    try {
      setLoadingStacks(true);
      const res = await fetch('/api/docker/compose/stacks');
      if (res.ok) {
        const data = await res.json();
        setExistingStacks(data);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingStacks(false);
    }
  }, []);

  useEffect(() => {
    loadStacks();
  }, [loadStacks]);

  // Load specific stack content
  const loadStackContent = async (name: string) => {
    if (!name) return;
    try {
      setLoadingContent(true);
      const res = await fetch(`/api/docker/compose/stacks/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('Falha ao carregar conteúdo da stack');
      const data = await res.json();
      setStackName(data.name);
      setComposeYaml(data.compose_yaml || '');
      setEnvContent(data.env_content || '');
      toast.success(`Stack ${name} carregada!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingContent(false);
    }
  };

  // Syntax validation
  const validation = useMemo(() => {
    return validateComposeSyntax(composeYaml);
  }, [composeYaml]);

  // Port conflict scan
  useEffect(() => {
    const ports = extractPortsFromYaml(composeYaml);
    if (ports.length === 0) {
      setConflictingPorts([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingPorts(true);
        const res = await fetch(`/api/docker/ports/check?ports=${ports.join(',')}`);
        if (res.ok) {
          const results = await res.json();
          const conflicts = results.filter((r: any) => r.in_use).map((r: any) => r.port);
          setConflictingPorts(conflicts);
        }
      } catch {
        // Ignored
      } finally {
        setCheckingPorts(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [composeYaml]);

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = COMPOSE_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    if (composeYaml.trim() && !window.confirm('Substituir o conteúdo atual pelo template selecionado?')) {
      return;
    }
    setComposeYaml(tmpl.yaml);
    if (tmpl.env) setEnvContent(tmpl.env);
    if (!stackName) setStackName(tmpl.id);
  };

  const handleSave = async (deployNow: boolean) => {
    const cleanName = stackName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName) {
      toast.error('Informe um nome válido para a stack (letras, números, hífen)');
      return;
    }

    if (!validation.valid) {
      toast.error(`Corrija os erros do YAML antes de salvar: ${validation.error}`);
      return;
    }

    if (deployNow) setDeploying(true);
    else setSaving(true);

    const toastId = toast.loading(
      deployNow ? `Salvando e inicializando stack ${cleanName}...` : `Salvando rascunho de ${cleanName}...`
    );

    try {
      const res = await fetch('/api/docker/compose/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          compose_yaml: composeYaml,
          env_content: envContent.trim() ? envContent : null,
          deploy_now: deployNow,
        }),
      });

      if (!res.ok) {
        const errorMsg = await res.text();
        throw new Error(errorMsg || 'Falha ao salvar a stack');
      }

      const result = await res.json();
      toast.success(result.message || 'Stack salva com sucesso!', { id: toastId });
      loadStacks();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId });
    } finally {
      setSaving(false);
      setDeploying(false);
    }
  };

  const handleDownload = () => {
    const content = activeTab === 'yaml' ? composeYaml : envContent;
    const filename = activeTab === 'yaml' ? 'docker-compose.yml' : '.env';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNewStack = () => {
    setStackName('');
    setComposeYaml(COMPOSE_TEMPLATES[0].yaml);
    setEnvContent(COMPOSE_TEMPLATES[0].env || '');
    setActiveTab('yaml');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orbit-500/10 text-orbit-500 rounded-xl border border-orbit-500/20">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">Editor Docker Compose</h1>
            <p className="text-secondary text-sm">
              Crie, configure e execute stacks customizadas com linting e checagem de portas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleNewStack}
            className="px-3.5 py-2 bg-accent/80 hover:bg-accent text-secondary hover:text-primary rounded-xl text-xs font-semibold border border-border transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-orbit-500" />
            <span>Nova Stack</span>
          </button>

          <button
            onClick={handleDownload}
            className="p-2 text-secondary hover:text-primary rounded-xl hover:bg-accent border border-border transition-colors"
            title={`Baixar ${activeTab === 'yaml' ? 'docker-compose.yml' : '.env'}`}
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={saving || deploying || loadingContent}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-primary rounded-xl text-xs font-semibold border border-border transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Salvar Rascunho</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={saving || deploying || loadingContent || !validation.valid}
            className="px-4 py-2 bg-orbit-500 hover:bg-orbit-600 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-orbit-500/20 hover:shadow-orbit-500/30 active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Salvar & Executar</span>
          </button>
        </div>
      </div>

      {/* Top Configuration & Template Bar */}
      <div className="bg-card/85 backdrop-blur-2xl border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stack Name */}
        <div>
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
            Nome da Stack (ID)
          </label>
          <input
            type="text"
            placeholder="ex: my-custom-app"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            className="w-full bg-accent/40 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          />
        </div>

        {/* Templates Picker */}
        <div>
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orbit-500" />
            <span>Templates Prontos</span>
          </label>
          <select
            onChange={(e) => handleSelectTemplate(e.target.value)}
            defaultValue=""
            className="w-full bg-accent/40 border border-border rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          >
            <option value="" disabled className="bg-card">
              Carregar modelo pré-configurado...
            </option>
            {COMPOSE_TEMPLATES.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id} className="bg-card">
                {tmpl.name} ({tmpl.category})
              </option>
            ))}
          </select>
        </div>

        {/* Existing Stacks Selector */}
        <div>
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-secondary" />
              <span>Stacks Salvas</span>
            </span>
            <button
              onClick={loadStacks}
              className="text-[10px] text-orbit-500 hover:underline flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStacks ? 'animate-spin' : ''}`} />
              <span>Recarregar</span>
            </button>
          </label>
          <select
            onChange={(e) => loadStackContent(e.target.value)}
            value={stackName}
            className="w-full bg-accent/40 border border-border rounded-xl px-3 py-2 text-xs font-mono text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          >
            <option value="" className="bg-card">-- Selecionar stack existente --</option>
            {existingStacks.map((s) => (
              <option key={s.name} value={s.name} className="bg-card">
                {s.name} {s.has_compose ? '' : '(sem compose)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Validation & Port Status Alerts */}
      <div className="space-y-2">
        {!validation.valid && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validation.error}</span>
          </div>
        )}

        {conflictingPorts.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Atenção:</strong> Porta(s) em uso detectada(s) no host:{' '}
              <span className="font-mono font-bold">{conflictingPorts.join(', ')}</span>. Altere as portas no Compose para evitar falha no deploy.
            </span>
          </div>
        )}

        {validation.valid && conflictingPorts.length === 0 && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Sintaxe YAML válida {checkingPorts ? '(verificando portas...)' : 'e sem conflitos de portas detectados.'}</span>
          </div>
        )}
      </div>

      {/* Editor Main Container */}
      <div className="bg-card/90 backdrop-blur-2xl border border-border/80 rounded-2xl overflow-hidden shadow-md">
        {/* Editor Tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/40 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('yaml')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'yaml'
                  ? 'bg-card text-orbit-500 shadow-sm border border-border'
                  : 'text-secondary hover:text-primary hover:bg-accent/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>docker-compose.yml</span>
            </button>

            <button
              onClick={() => setActiveTab('env')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'env'
                  ? 'bg-card text-orbit-500 shadow-sm border border-border'
                  : 'text-secondary hover:text-primary hover:bg-accent/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.env (Variáveis)</span>
            </button>
          </div>

          <div className="text-[11px] text-secondary font-mono">
            {activeTab === 'yaml' ? 'YAML 1.2 · Indent 2 Spaces' : 'KEY=VALUE Environment format'}
          </div>
        </div>

        {/* CodeMirror Editor Area */}
        <div className="min-h-[460px] text-sm font-mono">
          {activeTab === 'yaml' ? (
            <CodeMirror
              value={composeYaml}
              height="500px"
              extensions={[yaml()]}
              onChange={(value) => setComposeYaml(value)}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                tabSize: 2,
              }}
              className="text-xs font-mono"
            />
          ) : (
            <CodeMirror
              value={envContent}
              height="500px"
              onChange={(value) => setEnvContent(value)}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                tabSize: 2,
              }}
              className="text-xs font-mono"
            />
          )}
        </div>
      </div>
    </div>
  );
}
