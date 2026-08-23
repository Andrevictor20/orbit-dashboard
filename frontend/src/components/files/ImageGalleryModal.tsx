import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Download, 
  Image as ImageIcon 
} from 'lucide-react';
import type { FileItem } from '../../pages/FileManager';

interface ImageGalleryModalProps {
  currentFile: FileItem;
  files: FileItem[];
  isOpen: boolean;
  onClose: () => void;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];

export function ImageGalleryModal({ currentFile, files, isOpen, onClose }: ImageGalleryModalProps) {
  const imageFiles = files.filter(f => !f.is_dir && IMAGE_EXTENSIONS.includes(f.extension.toLowerCase()));
  
  const initialIndex = Math.max(0, imageFiles.findIndex(f => f.path === currentFile.path));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const idx = imageFiles.findIndex(f => f.path === currentFile.path);
    if (idx !== -1) {
      setCurrentIndex(idx);
    }
    setScale(1);
    setRotation(0);
  }, [currentFile, imageFiles.length]);

  const activeImage = imageFiles[currentIndex] || currentFile;

  const handleNext = useCallback(() => {
    if (imageFiles.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % imageFiles.length);
    setScale(1);
    setRotation(0);
  }, [imageFiles.length]);

  const handlePrev = useCallback(() => {
    if (imageFiles.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + imageFiles.length) % imageFiles.length);
    setScale(1);
    setRotation(0);
  }, [imageFiles.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.25));
  const handleResetZoom = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/files/raw?path=${encodeURIComponent(activeImage.path)}`;
    link.download = activeImage.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key.toLowerCase() === 'r') {
        handleRotateCw();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md text-white select-none animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <ImageIcon size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 max-w-md truncate">
              {activeImage.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{currentIndex + 1} de {imageFiles.length || 1}</span>
              <span>•</span>
              <span>{(activeImage.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Zoom Menos (-)"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Redefinir Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Zoom Mais (+)"
          >
            <ZoomIn size={18} />
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          <button
            onClick={handleRotateCcw}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Girar para Esquerda"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleRotateCw}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Girar para Direita (R)"
          >
            <RotateCw size={18} />
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
            title="Baixar Imagem"
          >
            <Download size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 ml-2"
            title="Fechar (Esc / Espaço)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-6">
        {imageFiles.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-20 p-3.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white/70 hover:text-white border border-white/10 backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-2xl"
              title="Anterior (←)"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 p-3.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white/70 hover:text-white border border-white/10 backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-2xl"
              title="Próximo (→)"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}

        <div className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out">
          <img
            src={`/api/files/raw?path=${encodeURIComponent(activeImage.path)}`}
            alt={activeImage.name}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              maxWidth: '90vw',
              maxHeight: '80vh',
              objectFit: 'contain',
            }}
            className="rounded-lg shadow-2xl transition-transform duration-150"
            draggable={false}
          />
        </div>
      </div>

      {/* Bottom Thumbnail Strip */}
      {imageFiles.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-black/40 border-t border-white/10 overflow-x-auto max-w-full">
          {imageFiles.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => {
                setCurrentIndex(idx);
                setScale(1);
                setRotation(0);
              }}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex
                  ? 'border-violet-500 scale-105 shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/30'
                  : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={`/api/files/raw?path=${encodeURIComponent(file.path)}`}
                alt={file.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
