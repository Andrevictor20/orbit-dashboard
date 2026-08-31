import { render, screen, fireEvent } from '@testing-library/react';
import { PdfViewerModal } from '../../components/files/PdfViewerModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PdfViewerModal Component', () => {
  const mockFile = {
    name: 'document.pdf',
    path: '/DATA/document.pdf',
    is_dir: false,
    size: 2097152,
    modified: '2026-08-22T10:20:00Z',
    extension: 'pdf'
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' }))
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders PDF viewer modal with embed/iframe source, fullscreen button and download button', async () => {
    render(<PdfViewerModal file={mockFile} onClose={vi.fn()} />);

    expect(screen.getByText('document.pdf')).toBeTruthy();
    expect(await screen.findByTestId('pdf-viewer-embed')).toBeTruthy();
    expect(screen.getByTestId('download-pdf-btn')).toBeTruthy();
    expect(screen.getByTestId('toggle-fullscreen-pdf')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PdfViewerModal file={mockFile} onClose={onClose} />);

    const closeBtn = screen.getByTestId('close-pdf-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
