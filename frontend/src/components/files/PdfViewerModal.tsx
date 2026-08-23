import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import type { FileItem } from './AudioPlayerModal';

interface PdfViewerModalProps {
  file: FileItem;
  onClose: () => void;
}

export function PdfViewerModal({ file, onClose }: PdfViewerModalProps) {
  const [zoom, setZoom] = useState(100);

  const pdfUrl = `/api/files/raw?path=${encodeURIComponent(file.path)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(file.path)}`;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative w-full max-w-5xl h-[92vh] sm:h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-primary text-sm sm:text-base truncate max-w-[150px] sm:max-w-md" title={file.name}>
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

        {/* PDF Frame */}
        <div className="flex-1 w-full h-full bg-zinc-900 overflow-auto flex items-center justify-center">
          <iframe
            data-testid="pdf-viewer-embed"
            src={`${pdfUrl}#zoom=${zoom}`}
            title={file.name}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
