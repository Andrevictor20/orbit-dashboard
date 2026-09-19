import { render, screen, fireEvent } from '@testing-library/react';
import { VideoHeaderOverlay } from '../../../components/files/VideoHeaderOverlay';
import { describe, it, expect, vi } from 'vitest';

describe('VideoHeaderOverlay Component', () => {
  const mockFile = {
    name: 'anime_episode_01.mkv',
    path: '/DATA/anime/anime_episode_01.mkv',
    is_dir: false,
    size: 500000000,
    modified: '2026-09-18T10:00:00Z',
    extension: 'mkv',
  };

  it('renders video filename, extension badge, and remux indicator', () => {
    render(
      <VideoHeaderOverlay
        file={mockFile}
        showControls={true}
        isTranscodeMode={true}
        isForceTranscode={false}
        copied={false}
        onToggleForceTranscode={vi.fn()}
        onCopyStreamLink={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('anime_episode_01.mkv')).toBeTruthy();
    expect(screen.getByText('MKV')).toBeTruthy();
    expect(screen.getByText(/Remux Direto/i)).toBeTruthy();
  });

  it('toggles mode when clicking mode badge', () => {
    const onToggle = vi.fn();
    render(
      <VideoHeaderOverlay
        file={mockFile}
        showControls={true}
        isTranscodeMode={true}
        isForceTranscode={false}
        copied={false}
        onToggleForceTranscode={onToggle}
        onCopyStreamLink={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const toggleBtn = screen.getByText(/Remux Direto/i);
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onCopyStreamLink and onClose callbacks', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();

    render(
      <VideoHeaderOverlay
        file={mockFile}
        showControls={true}
        isTranscodeMode={true}
        isForceTranscode={false}
        copied={false}
        onToggleForceTranscode={vi.fn()}
        onCopyStreamLink={onCopy}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTitle(/Copiar link direto/i));
    expect(onCopy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('close-video-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
