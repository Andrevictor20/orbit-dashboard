import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Terminal } from '../../pages/Terminal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockXTerm = {
  open: vi.fn(),
  loadAddon: vi.fn(),
  writeln: vi.fn(),
  write: vi.fn(),
  dispose: vi.fn(),
  onData: vi.fn(),
  onResize: vi.fn(),
  onSelectionChange: vi.fn(),
  attachCustomKeyEventHandler: vi.fn(),
  getSelection: vi.fn().mockReturnValue('sample selected text'),
  clear: vi.fn(),
  selectAll: vi.fn(),
  options: { fontSize: 14 },
  cols: 120,
  rows: 35,
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => mockXTerm),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

describe('Terminal Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('pasted clipboard text'),
      },
    });
    window.getSelection = vi.fn().mockReturnValue({
      toString: () => 'sample selected text',
    });
  });

  it('renders the SSH connection form with accessible button styling and inputs', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Conexão SSH')).toBeTruthy();
    expect(screen.getByPlaceholderText('pi ou root')).toBeTruthy();
    
    const submitButton = screen.getByRole('button', { name: /conectar via ssh/i });
    expect(submitButton).toBeTruthy();
    expect(submitButton.className).toMatch(/bg-orbit-(500|600)/);
    expect(submitButton.className).toContain('text-white');
  });

  it('toggles advanced configuration options for Host and Port', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );

    const advancedToggle = screen.getByText(/Configurações Avançadas/i);
    expect(advancedToggle).toBeTruthy();

    // Expand
    fireEvent.click(advancedToggle);
    expect(screen.getByPlaceholderText('localhost')).toBeTruthy();
    expect(screen.getByPlaceholderText('22')).toBeTruthy();
  });

  it('renders terminal action buttons (Copiar, Colar, Limpar, Tela Cheia)', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Copiar texto selecionado')).toBeTruthy();
    expect(screen.getByLabelText('Colar da área de transferência')).toBeTruthy();
    expect(screen.getByLabelText('Limpar terminal')).toBeTruthy();
    expect(screen.getByLabelText('Alternar tela cheia')).toBeTruthy();
    expect(screen.getByLabelText('Aumentar fonte')).toBeTruthy();
    expect(screen.getByLabelText('Diminuir fonte')).toBeTruthy();
  });

  it('copies selected text to clipboard when copy button is clicked', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );

    const copyBtn = screen.getByLabelText('Copiar texto selecionado');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sample selected text');
  });

  it('reads clipboard when paste button is clicked', () => {
    render(
      <MemoryRouter>
        <Terminal />
      </MemoryRouter>
    );

    const pasteBtn = screen.getByLabelText('Colar da área de transferência');
    fireEvent.click(pasteBtn);

    expect(navigator.clipboard.readText).toHaveBeenCalled();
  });
});
