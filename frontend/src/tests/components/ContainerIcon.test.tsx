import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContainerIcon } from '../../components/ui/ContainerIcon';
import { ThemeProvider } from '../../contexts/ThemeContext';

describe('ContainerIcon Component', () => {
  it('renders OrbitLogo for orbit container', () => {
    const { container } = render(
      <ThemeProvider>
        <ContainerIcon src="__orbit__" name="Orbit" />
      </ThemeProvider>
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders standard image tag with provided url', () => {
    const { container } = render(
      <ContainerIcon src="https://example.com/icon.png" name="Test App" />
    );

    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('falls back to docker.svg when image loading fails', () => {
    const { container } = render(
      <ContainerIcon src="https://example.com/invalid-404.png" name="Unknown App" />
    );

    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    // Trigger image error
    fireEvent.error(img!);

    const fallbackImg = container.querySelector('img');
    expect(fallbackImg?.getAttribute('src')).toBe('/icons/docker.svg');
  });

  it('falls back to docker.svg when no src is provided', () => {
    const { container } = render(
      <ContainerIcon name="Generic Container" />
    );

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/icons/docker.svg');
  });
});
