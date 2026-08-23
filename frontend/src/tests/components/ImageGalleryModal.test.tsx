import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImageGalleryModal } from '../../components/files/ImageGalleryModal';
import type { FileItem } from '../../pages/FileManager';

describe('ImageGalleryModal', () => {
  const mockFiles: FileItem[] = [
    {
      name: 'photo1.jpg',
      path: '/pictures/photo1.jpg',
      is_dir: false,
      size: 1024 * 500,
      modified: '2026-08-23T00:00:00Z',
      extension: 'jpg',
      mime_type: 'image/jpeg',
      is_hidden: false,
    },
    {
      name: 'vector.svg',
      path: '/pictures/vector.svg',
      is_dir: false,
      size: 1024 * 50,
      modified: '2026-08-23T00:00:00Z',
      extension: 'svg',
      mime_type: 'image/svg+xml',
      is_hidden: false,
    },
  ];

  it('renders active image and controls when open', () => {
    const onClose = vi.fn();
    render(
      <ImageGalleryModal
        currentFile={mockFiles[0]}
        files={mockFiles}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
    expect(screen.getByTitle('Girar para Direita (R)')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Mais (+)')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Menos (-)')).toBeInTheDocument();
    expect(screen.getByTitle('Baixar Imagem')).toBeInTheDocument();
  });

  it('navigates to next image on right chevron click', () => {
    const onClose = vi.fn();
    render(
      <ImageGalleryModal
        currentFile={mockFiles[0]}
        files={mockFiles}
        isOpen={true}
        onClose={onClose}
      />
    );

    const nextBtn = screen.getByTitle('Próximo (→)');
    fireEvent.click(nextBtn);

    expect(screen.getByText('vector.svg')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <ImageGalleryModal
        currentFile={mockFiles[0]}
        files={mockFiles}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByTitle('Fechar (Esc / Espaço)');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
