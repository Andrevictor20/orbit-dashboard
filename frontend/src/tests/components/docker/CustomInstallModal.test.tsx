import { render, screen, fireEvent } from '@testing-library/react';
import { CustomInstallModal } from '../../../components/docker/CustomInstallModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CustomInstallModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnInstall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default inputs and handles submit', () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);
    
    expect(screen.getByText('Instalação Personalizada')).toBeTruthy();
    
    const installBtn = screen.getByText('Instalar');
    fireEvent.click(installBtn);
    
    expect(mockOnInstall).toHaveBeenCalledWith(expect.objectContaining({
      env: { 'TZ': 'America/Sao_Paulo' },
      ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
      volumes: [{ host: '/DATA/AppData', container: '/config' }]
    }));
  });

  it('can add and remove ports', () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);
    
    const addBtns = screen.getAllByText('Adicionar');
    // first add button is for ports
    fireEvent.click(addBtns[0]);
    
    const hostInputs = screen.getAllByPlaceholderText('Host');
    const containerInputs = screen.getAllByPlaceholderText('Container');
    
    // Default 1 port + 1 new = 2
    expect(hostInputs.length).toBe(2);
    
    // Type in new port
    fireEvent.change(hostInputs[1], { target: { value: '9090' } });
    fireEvent.change(containerInputs[1], { target: { value: '90' } });
    
    const installBtn = screen.getByText('Instalar');
    fireEvent.click(installBtn);
    
    expect(mockOnInstall).toHaveBeenCalledWith(expect.objectContaining({
      ports: [
        { host: 8080, container: 80, protocol: 'tcp' },
        { host: 9090, container: 90, protocol: 'tcp' }
      ]
    }));
  });

  it('can remove a port', () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);
    
    // There is an X button for each port and volume row, plus the main close button.
    // The main close button is the first one in the DOM usually, or we can look for button inside port row
    // Let's use getByPlaceholderText to find the row, then traverse up or just click the right X.
    const hostInputs = screen.getAllByPlaceholderText('Host');
    const portRow = hostInputs[0].closest('div');
    const removeBtn = portRow?.querySelector('button');
    
    if (removeBtn) {
      fireEvent.click(removeBtn);
    }
    
    // Try to install
    const installBtn = screen.getByText('Instalar');
    fireEvent.click(installBtn);
    
    // No ports should be left
    expect(mockOnInstall).toHaveBeenCalledWith(expect.objectContaining({
      ports: []
    }));
  });

  it('calls onClose when cancel is clicked', () => {
    render(<CustomInstallModal appId="test-app" onClose={mockOnClose} onInstall={mockOnInstall} />);
    
    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
