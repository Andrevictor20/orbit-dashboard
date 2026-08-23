import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, X, ZoomIn, ZoomOut, ExternalLink, Maximize, Minimize, Loader2, AlertCircle } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface PdfViewerModalProps {
  file: FileItem;
  onClose: () => void;
}

export function PdfViewerModal({ file, onClose }: PdfViewerModalProps) {
  const [zoom, setZoom] = useState(100);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const pdfUrl = `/api/files/raw?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  // Fetch as blob for seamless browser compatibility
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem('orbit_token');
    fetch(pdfUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível carregar o arquivo PDF.');
        return res.blob();
      })
      .then(blob => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.warn('Fallback to direct PDF URL:', err);
        setBlobUrl(pdfUrl);
        setIsLoading(false);
      });

    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file.path]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto ${
          isFullscreen ? 'h-full max-w-none rounded-none border-0' : 'max-w-6xl h-[94vh] sm:h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-3.5 border-b border-border bg-card/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-primary text-sm sm:text-base truncate max-w-[150px] xs:max-w-xs sm:max-w-md" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[11px] text-secondary">Documento PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-accent/60 px-2 py-1 rounded-xl border border-border">
              <button
                onClick={() => setZoom(z => Math.max(50, z - 25))}
                className="p-1 text-secondary hover:text-primary transition-colors"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-secondary px-1">{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(200, z + 25))}
                className="p-1 text-secondary hover:text-primary transition-colors"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Native Fullscreen Button */}
            <button
              data-testid="toggle-fullscreen-pdf"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <a
              data-testid="download-pdf-btn"
              href={downloadUrl}
              download={file.name}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 hover:bg-orbit-500/20 transition-colors text-xs font-medium"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Open in new tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              data-testid="close-pdf-modal"
              onClick={onClose}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              aria-label="Fechar PDF"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Body Container */}
        <div className="flex-1 w-full h-full bg-zinc-950 overflow-hidden relative flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-400" />
              <span className="text-sm font-medium">Carregando PDF...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-secondary p-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-medium text-primary">{error}</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-orbit-500 text-white text-xs font-semibold hover:bg-orbit-600 transition-colors"
              >
                Abrir em nova aba
              </a>
            </div>
          ) : (
            <object
              data-testid="pdf-viewer-embed"
              data={`${blobUrl || pdfUrl}#zoom=${zoom}`}
              type="application/pdf"
              className="w-full h-full border-0"
            >
              <iframe
                src={`${blobUrl || pdfUrl}#zoom=${zoom}`}
                title={file.name}
                className="w-full h-full border-0"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center text-secondary">
                  <FileText className="w-12 h-12 text-zinc-600" />
                  <p className="text-sm font-medium text-primary">Não foi possível embutir o PDF diretamente.</p>
                  <div className="flex gap-2">
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-orbit-500/20 text-orbit-400 border border-orbit-500/30 text-xs font-semibold"
                    >
                      Abrir em nova aba
                    </a>
                    <a
                      href={downloadUrl}
                      download={file.name}
                      className="px-3 py-1.5 rounded-xl bg-accent text-primary text-xs font-semibold"
                    >
                      Baixar arquivo
                    </a>
                  </div>
                </div>
              </iframe>
            </object>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
