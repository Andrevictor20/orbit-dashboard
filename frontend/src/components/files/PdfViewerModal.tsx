import { useState } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-primary text-base truncate max-w-md" title={file.name}>
                {file.name}
              </h3>
              <p className="text-xs text-secondary">Documento PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-accent/60 px-2 py-1 rounded-lg border border-border">
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orbit-500/10 text-orbit-400 border border-orbit-500/20 hover:bg-orbit-500/20 transition-colors text-xs font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>

            {/* Open in new tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              data-testid="close-pdf-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
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
    </div>
  );
}
