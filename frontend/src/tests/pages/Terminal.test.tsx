import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Terminal } from '../../pages/Terminal';
import { vi, describe, it, expect } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    loadAddon: vi.fn(),
    writeln: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

describe('Terminal Page', () => {
  it('renders the SSH connection form with accessible button styling', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Conexão SSH')).toBeTruthy();
    expect(screen.getByPlaceholderText('pi')).toBeTruthy();
    
    const submitButton = screen.getByRole('button', { name: /conectar via ssh/i });
    expect(submitButton).toBeTruthy();
    
    // The button must use brand orbit colors and NOT bg-primary with text-white (which breaks contrast in dark mode)
    expect(submitButton.className).not.toContain('bg-primary');
    expect(submitButton.className).toMatch(/bg-orbit-(500|600)/);
    expect(submitButton.className).toContain('text-white');
  });
});
