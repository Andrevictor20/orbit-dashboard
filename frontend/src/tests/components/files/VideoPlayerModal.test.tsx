import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayerModal } from '../../../components/files/VideoPlayerModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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
    expect(await screen.findByText(/Português/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<VideoPlayerModal file={mockFile} onClose={onClose} />);

    const closeBtn = await screen.findByTestId('close-video-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders play button and progress slider', async () => {
    render(<VideoPlayerModal file={mockFile} onClose={vi.fn()} />);

    const playBtn = await screen.findByTestId('video-play-btn');
    expect(playBtn).toBeTruthy();

    const progressSlider = await screen.findByTestId('video-progress');
    expect(progressSlider).toBeTruthy();
  });

  it('allows changing active subtitle track', async () => {
    render(<VideoPlayerModal file={mockFile} onClose={vi.fn()} />);

    const subSelector = await screen.findByTestId('subtitle-selector') as HTMLSelectElement;
    expect(subSelector).toBeTruthy();

    // Wait for subtitles to be loaded from fetch and populated as options
    await screen.findByRole('option', { name: /English/i });

    fireEvent.change(subSelector, { target: { value: '/DATA/movies/movie.en.vtt' } });
    expect(subSelector.value).toBe('/DATA/movies/movie.en.vtt');
  });
});

