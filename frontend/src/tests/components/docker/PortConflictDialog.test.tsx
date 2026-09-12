import { render, screen, fireEvent } from '@testing-library/react';
import { PortConflictDialog, type PortConflictItem } from '../../../components/docker/PortConflictDialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: any) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      if (fallbackOrOpts && typeof fallbackOrOpts === 'object' && fallbackOrOpts.defaultValue) {
        return fallbackOrOpts.defaultValue;
      }
      return key;
    }
  })
}));

describe('PortConflictDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnAcceptSuggested = vi.fn();
  const mockOnOpenCustom = vi.fn();

  const sampleConflicts: PortConflictItem[] = [
    {
      host_port: 5172,
      container_port: 5172,
      protocol: 'tcp',
      in_use: true,
      in_use_by: "Container 'stirling-pdf'",
      suggested_port: 5173,
    },
    {
      host_port: 8081,
      container_port: 8080,
      protocol: 'tcp',
      in_use: true,
      in_use_by: 'Serviço do Host / Socket em uso',
      suggested_port: 8080, // testing closest lower port (-1)
    },
    {
      host_port: 9000,
      container_port: 9000,
      protocol: 'tcp',
      in_use: false,
      in_use_by: null,
      suggested_port: 9000,
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PortConflictDialog
        isOpen={false}
        onClose={mockOnClose}
        appName="Stirling PDF"
        conflicts={sampleConflicts}
        onAcceptSuggested={mockOnAcceptSuggested}
        onOpenCustom={mockOnOpenCustom}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders conflict details and suggested ports when open', () => {
    render(
      <PortConflictDialog
        isOpen={true}
        onClose={mockOnClose}
        appName="Stirling PDF"
        conflicts={sampleConflicts}
        onAcceptSuggested={mockOnAcceptSuggested}
        onOpenCustom={mockOnOpenCustom}
      />
    );

    // Title and app name
    expect(screen.getByText('Conflito de Portas Detectado')).toBeTruthy();
    expect(screen.getByText(/Portas solicitadas por Stirling PDF/)).toBeTruthy();

    // Occupied ports shown
    expect(screen.getByText('5172')).toBeTruthy();
    expect(screen.getByText("Container 'stirling-pdf'")).toBeTruthy();

    // Suggested ports shown (+1 and -1)
    expect(screen.getByText('5173')).toBeTruthy();
    expect(screen.getByText('8081')).toBeTruthy();
    expect(screen.getByText('8080')).toBeTruthy();

    // Free port (9000) should not be rendered in the occupied list
    expect(screen.queryByText('9000')).toBeNull();
  });

  it('triggers onAcceptSuggested when clicking install with suggested port', () => {
    render(
      <PortConflictDialog
        isOpen={true}
        onClose={mockOnClose}
        appName="Stirling PDF"
        conflicts={sampleConflicts}
        onAcceptSuggested={mockOnAcceptSuggested}
        onOpenCustom={mockOnOpenCustom}
      />
    );

    const acceptBtn = screen.getByText('Instalar com Porta Sugerida');
    fireEvent.click(acceptBtn);
    expect(mockOnAcceptSuggested).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenCustom when clicking customize button', () => {
    render(
      <PortConflictDialog
        isOpen={true}
        onClose={mockOnClose}
        appName="Stirling PDF"
        conflicts={sampleConflicts}
        onAcceptSuggested={mockOnAcceptSuggested}
        onOpenCustom={mockOnOpenCustom}
      />
    );

    const customBtn = screen.getByText('Personalizar');
    fireEvent.click(customBtn);
    expect(mockOnOpenCustom).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when clicking cancel button', () => {
    render(
      <PortConflictDialog
        isOpen={true}
        onClose={mockOnClose}
        appName="Stirling PDF"
        conflicts={sampleConflicts}
        onAcceptSuggested={mockOnAcceptSuggested}
        onOpenCustom={mockOnOpenCustom}
      />
    );

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
