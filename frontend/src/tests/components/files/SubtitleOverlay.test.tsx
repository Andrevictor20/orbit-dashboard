import { render, screen } from '@testing-library/react';
import { SubtitleOverlay } from '../../../components/files/SubtitleOverlay';
import { describe, it, expect } from 'vitest';

describe('SubtitleOverlay Component', () => {
  it('renders nothing when currentCue is empty', () => {
    const { container } = render(<SubtitleOverlay currentCue="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders subtitle text with overlay container when currentCue is provided', () => {
    render(<SubtitleOverlay currentCue="Isso é uma legenda em português" />);
    
    const overlay = screen.getByTestId('subtitle-overlay');
    expect(overlay).toBeTruthy();
    expect(screen.getByText('Isso é uma legenda em português')).toBeTruthy();
  });
});
