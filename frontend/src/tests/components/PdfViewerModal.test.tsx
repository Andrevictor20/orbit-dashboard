import { render, screen, fireEvent } from '@testing-library/react';
import { PdfViewerModal } from '../../components/files/PdfViewerModal';
import { vi, describe, it, expect } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('PdfViewerModal Component', () => {
  const mockFile = {
    name: 'document.pdf',
    path: '/DATA/document.pdf',
    is_dir: false,
    size: 2097152,
    modified: '2026-08-22T10:20:00Z',
    extension: 'pdf'
  };

  it('renders PDF viewer modal with embed/iframe source and download button', () => {
    render(<PdfViewerModal file={mockFile} onClose={vi.fn()} />);

    expect(screen.getByText('document.pdf')).toBeTruthy();
    const pdfEmbed = screen.getByTestId('pdf-viewer-embed');
    expect(pdfEmbed).toBeTruthy();
    expect(pdfEmbed.getAttribute('src')).toContain('/api/files/raw?path=%2FDATA%2Fdocument.pdf');
    expect(screen.getByTestId('download-pdf-btn')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PdfViewerModal file={mockFile} onClose={onClose} />);

    const closeBtn = screen.getByTestId('close-pdf-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
