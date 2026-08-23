import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={handleClose}>
      <div 
        className="relative w-full max-w-4xl h-[92vh] sm:h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border bg-card/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-primary text-sm sm:text-base truncate max-w-[180px] sm:max-w-md" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[11px] text-secondary truncate font-mono hidden sm:block">{file.path}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salvo com sucesso</span>
              </span>
            )}

            <button
              data-testid="save-text-btn"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 shadow-sm ${
                isDirty 
                  ? 'bg-orbit-500 hover:bg-orbit-600 text-white shadow-orbit-500/20' 
                  : 'bg-accent/50 text-secondary cursor-not-allowed'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar</span>
            </button>

            <button
              data-testid="close-text-modal"
              onClick={handleClose}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              aria-label="Fechar editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative overflow-hidden bg-background">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-400" />
              <span className="text-sm">Carregando conteúdo...</span>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-rose-400 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-accent text-primary text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          ) : (
            <textarea
              data-testid="text-editor-area"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite seu texto aqui..."
              className="w-full h-full p-3 sm:p-6 bg-transparent text-primary font-mono text-xs sm:text-sm resize-none focus:outline-none leading-relaxed selection:bg-orbit-500/30"
              spellCheck={false}
              autoFocus
            />
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-t border-border bg-card text-[11px] sm:text-xs text-secondary">
          <div className="flex items-center gap-2 sm:gap-4">
            <span>Linhas: {lineCount}</span>
            <span>Caracteres: {charCount}</span>
            <span className="uppercase">{file.extension || 'TXT'} UTF-8</span>
          </div>
          <div>
            {isDirty ? (
              <span className="text-amber-400 font-medium">Modificado</span>
            ) : (
              <span className="text-emerald-400 font-medium">Salvo</span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
