import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Networks } from '../../pages/Networks';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Networks Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('orbit_token', 'fake-token');
    
    // Default fetch mock for networks list
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: '12345', name: 'orbit_network', driver: 'bridge' },
        { id: '67890', name: 'my_custom_net', driver: 'overlay' }
      ])
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then lists networks', async () => {
    render(<Networks />);
    
    expect(screen.getByText('Carregando redes...')).toBeTruthy();
    
    await waitFor(() => {
      expect(screen.getByText('orbit_network')).toBeTruthy();
    });
    
    expect(screen.getByText('my_custom_net')).toBeTruthy();
    expect(screen.getByText('bridge')).toBeTruthy();
    expect(screen.getByText('overlay')).toBeTruthy();
  });

  it('handles empty networks list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([])
    });

    render(<Networks />);
    
    await waitFor(() => {
      expect(screen.getByText('Nenhuma rede encontrada.')).toBeTruthy();
    });
  });

  it('handles delete network action', async () => {
    render(<Networks />);
    
    await waitFor(() => {
      expect(screen.getByText('orbit_network')).toBeTruthy();
    });

    // Mock delete endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true
    });

    const deleteBtns = screen.getAllByTitle('Remover Rede');
    fireEvent.click(deleteBtns[0]); // delete orbit_network
    
    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Tem certeza que deseja remover a rede orbit_network\?/)).toBeTruthy();
    });
    
    // Confirm delete
    const confirmBtn = screen.getByText('Sim, continuar');
    fireEvent.click(confirmBtn);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/docker/networks/12345', expect.objectContaining({
        method: 'DELETE'
      }));
      expect(toast.success).toHaveBeenCalledWith('Rede removida com sucesso!', expect.anything());
    });
  });

  it('handles prune networks action', async () => {
    render(<Networks />);
    
    await waitFor(() => {
      expect(screen.getByText('orbit_network')).toBeTruthy();
    });

    // Mock prune endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true
    });

    const pruneBtn = screen.getByText('Limpar Não Utilizadas');
    fireEvent.click(pruneBtn);
    
    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Tem certeza que deseja remover TODAS as redes não utilizadas\?/)).toBeTruthy();
    });
    
    // Confirm prune
    const confirmBtn = screen.getByText('Sim, continuar');
    fireEvent.click(confirmBtn);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/docker/networks/prune', expect.objectContaining({
        method: 'POST'
      }));
      expect(toast.success).toHaveBeenCalledWith('Redes não utilizadas foram removidas!', expect.anything());
    });
  });
});
