import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { AppIcon } from '../../../components/appstore/AppIcon';

describe('AppIcon', () => {
  it('renders img with provided src', () => {
    render(<AppIcon src="https://example.com/icon.png" name="Test App" id="test-app" />);
    const img = screen.getByTestId('app-icon-img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
    expect(img).toHaveAttribute('alt', '');
  });

  it('attempts CDN fallback on first image load error', () => {
    render(<AppIcon src="https://example.com/broken.png" name="Test App" id="test-app" />);
    const img = screen.getByTestId('app-icon-img');
    
    // Simulate image error
    fireEvent.error(img);

    // Expect fallback to walkxcode CDN URL
    expect(img).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/test-app.png'
    );
  });

  it('renders stylized initials when fallback also fails', () => {
    render(<AppIcon src="https://example.com/broken.png" name="Actual Budget" id="actual-budget" />);
    const img = screen.getByTestId('app-icon-img');

    // First error triggers CDN fallback
    fireEvent.error(img);
    // Second error on CDN URL triggers initials fallback
    fireEvent.error(img);

    expect(screen.queryByTestId('app-icon-img')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-icon-fallback')).toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders initials immediately when no src is provided', () => {
    render(<AppIcon name="2FAuth" id="2fauth" />);
    expect(screen.queryByTestId('app-icon-img')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-icon-fallback')).toBeInTheDocument();
    expect(screen.getByText('2F')).toBeInTheDocument();
  });

  it('renders default icon when no src and no name are provided', () => {
    const { container } = render(<AppIcon />);
    expect(screen.queryByTestId('app-icon-img')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-icon-fallback')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
