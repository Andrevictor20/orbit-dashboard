import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadProgressDrawer } from '../../../components/files/UploadProgressDrawer';
import * as UploadCtx from '../../../contexts/UploadManagerContext';

describe('UploadProgressDrawer', () => {
  it('renders nothing when there are no active uploads', () => {
    const { container } = render(<UploadProgressDrawer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders active uploads with progress and speed', () => {
    const mockUploads: UploadCtx.UploadItem[] = [
      {
        id: 'upl-1',
        fileName: 'ubuntu-server-24.04.iso',
        fileSize: 2.5 * 1024 * 1024 * 1024,
        destinationPath: '/DATA/isos',
        chunkSize: 5 * 1024 * 1024,
        totalChunks: 500,
        uploadedChunks: [0, 1, 2],
        progress: 42,
        speedMBs: 18.5,
        status: 'uploading',
        createdAt: Date.now(),
      },
    ];

    vi.spyOn(UploadCtx, 'useUploadManager').mockReturnValue({
      uploads: mockUploads,
      isDrawerOpen: true,
      setIsDrawerOpen: vi.fn(),
      isMinimized: false,
      setIsMinimized: vi.fn(),
      enqueueUpload: vi.fn(),
      enqueueMultipleUploads: vi.fn(),
      pauseUpload: vi.fn(),
      resumeUpload: vi.fn(),
      cancelUpload: vi.fn(),
      clearCompleted: vi.fn(),
    });

    render(<UploadProgressDrawer />);

    expect(screen.getByText(/Envio de Arquivos/i)).toBeInTheDocument();
    expect(screen.getByText('ubuntu-server-24.04.iso')).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getAllByText(/18.5 MB\/s/).length).toBeGreaterThanOrEqual(1);
  });
});
