import { render, screen, fireEvent } from '@testing-library/react';
import { InstallProgressModal } from '../../../components/docker/InstallProgressModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useInstall } from '../../../contexts/InstallContext';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

// Mock InstallContext
vi.mock('../../../contexts/InstallContext', () => ({
  useInstall: vi.fn()
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('InstallProgressModal Component', () => {
  const mockClear = vi.fn();
  const mockMinimize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useInstall as any).mockReturnValue({
      taskId: null,
      appName: '',
      isModalOpen: false,
      task: null,
      minimize: mockMinimize,
      clear: mockClear
    });
  });

  it('renders nothing when not open', () => {
    const { container } = render(<InstallProgressModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders progress state correctly', () => {
    (useInstall as any).mockReturnValue({
      taskId: '123',
      appName: 'TestApp',
      isModalOpen: true,
      task: {
        status: 'pulling',
        progress: 45,
        logs: ['[INFO] starting...', '[PULL] downloading layer...']
      },
      minimize: mockMinimize,
      clear: mockClear
    });

    render(<InstallProgressModal />);
    
    expect(screen.getByText('Instalando TestApp')).toBeTruthy();
    expect(screen.getByText('Baixando imagem Docker...')).toBeTruthy();
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('[PULL] downloading layer...')).toBeTruthy();
    
    // In progress has minimize button
    const minBtns = screen.getAllByTitle('Continuar em segundo plano');
    expect(minBtns.length).toBeGreaterThan(0);
  });

  it('renders error state and logs correctly', () => {
    (useInstall as any).mockReturnValue({
      taskId: '123',
      appName: 'TestApp',
      isModalOpen: true,
      task: {
        status: 'error',
        progress: 90,
        logs: ['[INFO] starting...', '[ERROR] failed to bind port'],
        error: 'Bind exception'
      },
      minimize: mockMinimize,
      clear: mockClear
    });

    render(<InstallProgressModal />);
    
    expect(screen.getByText('Falha na instalação')).toBeTruthy();
    expect(screen.getByText('[ERROR] failed to bind port')).toBeTruthy();
    expect(screen.getByText('Motivo do erro:')).toBeTruthy();
    expect(screen.getByText('Bind exception')).toBeTruthy();
    
    // Should have close button
    const closeBtns = screen.getAllByText('Fechar');
    expect(closeBtns.length).toBeGreaterThan(0);
    fireEvent.click(closeBtns[0]);
    expect(mockClear).toHaveBeenCalled();
  });

  it('renders done state correctly and navigates on success', () => {
    (useInstall as any).mockReturnValue({
      taskId: '123',
      appName: 'TestApp',
      isModalOpen: true,
      task: {
        status: 'done',
        progress: 100,
        logs: ['[INFO] container started']
      },
      minimize: mockMinimize,
      clear: mockClear
    });

    render(<InstallProgressModal />);
    
    expect(screen.getByText('Instalação concluída!')).toBeTruthy();
    
    // Click view containers
    const viewBtn = screen.getByText('Ver Containers');
    fireEvent.click(viewBtn);
    
    expect(mockClear).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/containers');
  });
});
