import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileBadgeVisual } from '../../../components/files/FileBadgeVisual';
import type { FileItem } from '../../../types/fileManager';

describe('FileBadgeVisual', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const createItem = (overrides: Partial<FileItem>): FileItem => ({
    name: 'test-item',
    path: '/data/test-item',
    is_dir: false,
    size: 1024,
    modified: '2026-09-17T00:00:00Z',
    extension: '',
    mime_type: '',
    is_hidden: false,
    ...overrides,
  });

  it('renders modern folder graphic for directories', () => {
    const dirItem = createItem({ name: 'Documents', is_dir: true });
    const { container } = render(<FileBadgeVisual item={dirItem} />);
    
    // Check that Folder icon / folder graphic rendered
    expect(container.querySelector('.bg-amber-600')).toBeInTheDocument();
  });

  it('renders thumbnail image for image files with auth token', () => {
    localStorage.setItem('saturn_token', 'secret123');
    const imgItem = createItem({
      name: 'banner.png',
      path: '/data/banner.png',
      extension: 'png',
      mime_type: 'image/png',
    });

    render(<FileBadgeVisual item={imgItem} />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      '/api/files/thumbnail?path=%2Fdata%2Fbanner.png&token=secret123'
    );
    expect(screen.getByText('png')).toBeInTheDocument();
  });

  it('falls back to icon when image thumbnail fails to load', () => {
    const imgItem = createItem({
      name: 'corrupted.jpg',
      path: '/data/corrupted.jpg',
      extension: 'jpg',
      mime_type: 'image/jpeg',
    });

    render(<FileBadgeVisual item={imgItem} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('jpg')).toBeInTheDocument();
  });

  it('renders video thumbnail preview with play icon overlay', () => {
    localStorage.setItem('saturn_token', 'videoToken');
    const videoItem = createItem({
      name: 'movie.mp4',
      path: '/data/movie.mp4',
      extension: 'mp4',
      mime_type: 'video/mp4',
    });

    const { container } = render(<FileBadgeVisual item={videoItem} />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      '/api/files/thumbnail?path=%2Fdata%2Fmovie.mp4&token=videoToken'
    );
    expect(screen.getByText('mp4')).toBeInTheDocument();
    // Verify play button overlay is present
    expect(container.querySelector('.fill-current')).toBeInTheDocument();
  });

  it('falls back to Film icon when video thumbnail fails to load', () => {
    const videoItem = createItem({
      name: 'corrupt.mkv',
      path: '/data/corrupt.mkv',
      extension: 'mkv',
      mime_type: 'video/x-matroska',
    });

    render(<FileBadgeVisual item={videoItem} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('mkv')).toBeInTheDocument();
  });

  it('renders PDF thumbnail preview with PDF badge', () => {
    localStorage.setItem('token', 'pdfToken');
    const pdfItem = createItem({
      name: 'invoice.pdf',
      path: '/data/invoice.pdf',
      extension: 'pdf',
      mime_type: 'application/pdf',
    });

    render(<FileBadgeVisual item={pdfItem} />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      '/api/files/thumbnail?path=%2Fdata%2Finvoice.pdf&token=pdfToken'
    );
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('falls back to FileText icon when PDF thumbnail fails to load', () => {
    const pdfItem = createItem({
      name: 'broken.pdf',
      path: '/data/broken.pdf',
      extension: 'pdf',
      mime_type: 'application/pdf',
    });

    render(<FileBadgeVisual item={pdfItem} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('renders specialized badges for audio, archives, code and generic files', () => {
    const audioItem = createItem({ name: 'song.mp3', extension: 'mp3' });
    const { unmount: u1 } = render(<FileBadgeVisual item={audioItem} />);
    expect(screen.getByText('mp3')).toBeInTheDocument();
    u1();

    const zipItem = createItem({ name: 'backup.zip', extension: 'zip' });
    const { unmount: u2 } = render(<FileBadgeVisual item={zipItem} />);
    expect(screen.getByText('zip')).toBeInTheDocument();
    u2();

    const codeItem = createItem({ name: 'main.rs', extension: 'rs' });
    const { unmount: u3 } = render(<FileBadgeVisual item={codeItem} />);
    expect(screen.getByText('rs')).toBeInTheDocument();
    u3();

    const genericItem = createItem({ name: 'data.dat', extension: 'dat' });
    const { unmount: u4 } = render(<FileBadgeVisual item={genericItem} />);
    expect(screen.getByText('dat')).toBeInTheDocument();
    u4();
  });
});
