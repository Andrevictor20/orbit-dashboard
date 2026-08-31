import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextEditorModal } from '../../components/files/TextEditorModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('TextEditorModal Component', () => {
  const mockFile = {
    name: 'README.md',
    path: '/DATA/README.md',
    is_dir: false,
    size: 1024,
    modified: '2026-08-22T10:05:00Z',
    extension: 'md'
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((_url: string, opts?: any) => {
      if (opts?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ content: '# Orbit Dashboard\n\nWelcome to **Orbit**!' }),
      });
    }));
  });

  it('renders editor with loaded content and allows switching to preview mode for markdown', async () => {
    render(<TextEditorModal file={mockFile} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('README.md')).toBeTruthy();
    const textarea = await screen.findByTestId('text-editor-area') as HTMLTextAreaElement;
    expect(textarea.value).toContain('# Orbit Dashboard');

    // Check preview button exists for .md file
    const previewTab = screen.getByTestId('tab-preview');
    expect(previewTab).toBeTruthy();

    fireEvent.click(previewTab);

    // Markdown preview should render formatted header
    expect(await screen.findByText('Orbit Dashboard')).toBeTruthy();
  });

  it('allows editing and saving content', async () => {
    const onSaved = vi.fn();
    render(<TextEditorModal file={mockFile} onClose={vi.fn()} onSaved={onSaved} />);

    const textarea = await screen.findByTestId('text-editor-area');
    fireEvent.change(textarea, { target: { value: '# Updated Content' } });

    const saveBtn = screen.getByTestId('save-text-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/files/content'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            path: '/DATA/README.md',
            content: '# Updated Content',
          }),
        })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('supports HTML preview mode for .html files', async () => {
    const htmlFile = {
      name: 'index.html',
      path: '/DATA/index.html',
      is_dir: false,
      size: 512,
      modified: '2026-08-22T10:05:00Z',
      extension: 'html'
    };

    render(<TextEditorModal file={htmlFile} onClose={vi.fn()} />);

    const previewTab = await screen.findByTestId('tab-preview');
    fireEvent.click(previewTab);

    const htmlPreview = await screen.findByTestId('html-preview-frame');
    expect(htmlPreview).toBeTruthy();
  });
});
