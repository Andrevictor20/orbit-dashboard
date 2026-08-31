import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPlayerModal } from '../../../components/files/AudioPlayerModal';
import { vi, describe, it, expect } from 'vitest';

describe('AudioPlayerModal Component', () => {
  const mockFile = {
    name: 'track.mp3',
    path: '/DATA/music/track.mp3',
    is_dir: false,
    size: 5242880,
    modified: '2026-08-22T10:10:00Z',
    extension: 'mp3'
  };

  it('renders audio player with track title and controls', () => {
    render(<AudioPlayerModal file={mockFile} onClose={vi.fn()} />);

    expect(screen.getByText('track.mp3')).toBeTruthy();
    expect(screen.getByTestId('play-pause-btn')).toBeTruthy();
    expect(screen.getByTestId('volume-slider')).toBeTruthy();
    expect(screen.getByTestId('audio-progress')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<AudioPlayerModal file={mockFile} onClose={onClose} />);

    const closeBtn = screen.getByTestId('close-audio-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
