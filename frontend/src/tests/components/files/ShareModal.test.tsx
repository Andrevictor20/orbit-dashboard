import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ShareModal } from '../../../components/files/ShareModal';
import type { FileItem } from '../../../pages/FileManager';

describe('ShareModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockFile: FileItem = {
    name: 'document.pdf',
    path: '/documents/document.pdf',
    is_dir: false,
    size: 1024 * 120,
    modified: '2026-08-23T00:00:00Z',
    extension: 'pdf',
    mime_type: 'application/pdf',
    is_hidden: false,
  };

  it('renders target file details and generates share link on click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, opts) => {
      if (url === '/api/files/shares') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ shares: [] }),
        });
      }
      if (url === '/api/files/share' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            token: 'test_token_123',
            file_path: '/documents/document.pdf',
            file_name: 'document.pdf',
            is_dir: false,
            size: 1024 * 120,
            created_at: '2026-08-23T00:00:00Z',
            expires_at: '2026-08-24T00:00:00Z',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    render(
      <ShareModal
        file={mockFile}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Compartilhar Arquivo')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();

    const generateBtn = screen.getByText('Gerar Novo Link de Compartilhamento');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Link Criado com Sucesso!')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/test_token_123/)).toBeInTheDocument();
    });
  });
});
