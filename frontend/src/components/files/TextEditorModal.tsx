import { useState, useEffect } from 'react';
import { Save, X, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface TextEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaved?: () => void;
}

export function TextEditorModal({ file, onClose, onSaved }: TextEditorModalProps) {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isDirty = content !== originalContent;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/files/content?path=${encodeURIComponent(file.path)}`)
      .then(async res => {
        if (!res.ok) {
          throw new Error('Falha ao carregar conteúdo do arquivo');
        }
        return res.json();
      })
      .then(data => {
        setContent(data.content || '');
        setOriginalContent(data.content || '');
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Erro ao abrir arquivo');
        setIsLoading(false);
      });
  }, [file.path]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/files/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          content,
        }),
      });

      if (!res.ok) {
        throw new Error('Erro ao salvar arquivo');
      }

      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm('Existem alterações não salvas. Deseja realmente fechar?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const lines = content.split('\n');
  const lineCount = lines.length;
  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orbit-500/10 text-orbit-400 border border-orbit-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-primary text-base" title={file.path}>
                  {file.name}
                </h3>
                {isDirty && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Não salvo" />
                )}
              </div>
              <p className="text-xs text-secondary font-mono truncate max-w-md">{file.path}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
                <Check className="w-4 h-4" /> Salvo com sucesso!
              </span>
            )}

            <button
              data-testid="save-text-btn"
              onClick={handleSave}
              disabled={!isDirty || isSaving || isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isDirty && !isSaving
                  ? 'bg-orbit-500 text-white hover:bg-orbit-600 active:scale-95 shadow-md shadow-orbit-500/20'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar</span>
            </button>

            <button
              data-testid="close-text-modal"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="relative flex-1 flex overflow-hidden bg-zinc-950 font-mono text-sm">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-3 text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-orbit-400" />
              <span>Carregando arquivo...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Line Numbers */}
              <div className="w-12 py-4 px-2 select-none text-right text-zinc-600 bg-zinc-900/50 border-r border-zinc-800 text-xs overflow-hidden">
                {lines.map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Text Area */}
              <textarea
                data-testid="text-editor-area"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full h-full p-4 bg-transparent text-zinc-100 placeholder-zinc-600 resize-none outline-none leading-6 font-mono text-xs md:text-sm selection:bg-orbit-500/30 overflow-y-auto"
                placeholder="Digite o conteúdo aqui..."
              />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-card text-xs text-secondary">
          <div className="flex items-center gap-4">
            <span>Linhas: {lineCount}</span>
            <span>Caracteres: {charCount}</span>
            <span className="uppercase">{file.extension || 'TXT'} UTF-8</span>
          </div>
          <div>
            {isDirty ? (
              <span className="text-amber-400 font-medium">Modificado</span>
            ) : (
              <span className="text-emerald-400">Salvo</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
