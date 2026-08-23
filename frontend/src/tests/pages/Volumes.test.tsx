import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Volumes } from '../../pages/Volumes';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('Volumes component', () => {
  let originalFetch: typeof window.fetch;
  
  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/docker/volumes') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'test_vol', driver: 'local', mountpoint: '/var/lib/docker/volumes/test_vol' }])
        });
      }
      return Promise.resolve({ ok: true });
    });
    
    // Mock confirm dialog
    window.confirm = vi.fn(() => true);
    
    // Set a fake token
    localStorage.setItem('orbit_token', 'test_token');
  });
  
  afterEach(() => {
    window.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('passes auth token when fetching volumes and pruning', async () => {
    render(<Volumes />);
    
    // Wait for the volumes to load
    await waitFor(() => {
      expect(screen.getAllByText('test_vol').length).toBeGreaterThan(0);
    });
    
    // Check that fetch was called with token
    const fetchArgs = (window.fetch as any).mock.calls;
    const fetchVolumesCall = fetchArgs.find((call: any[]) => call[0] === '/api/docker/volumes');
    
    // This will FAIL initially because Volumes doesn't pass the token
    expect(fetchVolumesCall[1]?.headers?.Authorization).toBe('Bearer test_token');
    
    const pruneButton = screen.getByText('Limpar Não Utilizados (Prune)');
    fireEvent.click(pruneButton);
    
    const confirmButton = await screen.findByRole('button', { name: 'Sim, excluir' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const pruneCall = (window.fetch as any).mock.calls.find((call: any[]) => call[0] === '/api/docker/volumes/prune');
      expect(pruneCall).toBeTruthy();
      expect(pruneCall[1]?.headers?.Authorization).toBe('Bearer test_token');
    });
  });
});
