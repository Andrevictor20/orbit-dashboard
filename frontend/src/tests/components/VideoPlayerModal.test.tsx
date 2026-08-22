import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayerModal } from '../../components/files/VideoPlayerModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('VideoPlayerModal Component', () => {
  const mockFile = {
    name: 'movie.mkv',
    path: '/DATA/movies/movie.mkv',
    is_dir: false,
    size: 104857600,
    modified: '2026-08-22T10:15:00Z',
    extension: 'mkv'
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          subtitles: [
            { name: 'movie.pt-BR.vtt', path: '/DATA/movies/movie.pt-BR.vtt', label: 'Português' },
            { name: 'movie.en.vtt', path: '/DATA/movies/movie.en.vtt', label: 'English' },
          ]
        }),
      })
    ));
  });

  it('renders video player modal with MKV title and subtitle options', async () => {
    render(<VideoPlayerModal file={mockFile} onClose={vi.fn()} />);

    expect(screen.getByText('movie.mkv')).toBeTruthy();
    expect(screen.getByTestId('video-element')).toBeTruthy();
    
    // Subtitles selector
    expect(await screen.findByTestId('subtitle-selector')).toBeTruthy();
    expect(screen.getByText(/Português/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<VideoPlayerModal file={mockFile} onClose={onClose} />);

    const closeBtn = screen.getByTestId('close-video-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
