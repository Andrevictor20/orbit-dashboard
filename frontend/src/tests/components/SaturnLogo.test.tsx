import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SaturnLogo } from '../../components/ui/SaturnLogo';
import { ThemeProvider } from '../../contexts/ThemeContext';

describe('SaturnLogo Component', () => {
  it('renders correctly with default theme', () => {
    const { container } = render(
      <ThemeProvider>
        <SaturnLogo size={32} />
      </ThemeProvider>
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('renders correctly with custom size and className', () => {
    const { container } = render(
      <ThemeProvider>
        <SaturnLogo size={64} className="custom-saturn-class" />
      </ThemeProvider>
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('64');
    expect(svg?.getAttribute('height')).toBe('64');
    expect(svg?.getAttribute('class')).toContain('custom-saturn-class');
  });

  it('renders with explicit theme and mode overrides', () => {
    const themes = ['zinc', 'catppuccin', 'tokyonight', 'rose', 'blue', 'green'] as const;
    const modes = ['light', 'dark'] as const;

    for (const theme of themes) {
      for (const mode of modes) {
        const { container } = render(
          <SaturnLogo theme={theme} mode={mode} size={48} />
        );
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
      }
    }
  });
});
