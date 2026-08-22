import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextEditorModal } from '../../components/files/TextEditorModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('TextEditorModal Component', () => {
  const mockFile = {
    name: 'notes.txt',
    path: '/DATA/notes.txt',
    is_dir: false,
    size: 1024,
    modified: '2026-08-22T10:05:00Z',
    extension: 'txt'
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
        json: () => Promise.resolve({ content: 'Original text content in notes.txt' }),
      });
    }));
  });

  it('renders editor with loaded content', async () => {
    render(<TextEditorModal file={mockFile} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('notes.txt')).toBeTruthy();
    const textarea = await screen.findByTestId('text-editor-area') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Original text content in notes.txt');
  });

  it('allows editing and saving content', async () => {
    const onSaved = vi.fn();
    render(<TextEditorModal file={mockFile} onClose={vi.fn()} onSaved={onSaved} />);

    const textarea = await screen.findByTestId('text-editor-area');
    fireEvent.change(textarea, { target: { value: 'Edited text content' } });

    const saveBtn = screen.getByTestId('save-text-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/files/content'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            path: '/DATA/notes.txt',
            content: 'Edited text content'
          })
        })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
