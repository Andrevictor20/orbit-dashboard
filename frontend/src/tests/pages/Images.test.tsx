import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Images } from '../../pages/Images';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Images component', () => {
  let originalFetch: typeof window.fetch;
  
  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/docker/images') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'test_img', tags: ['latest'], size: 1024 }])
        });
      }
      return Promise.resolve({ ok: true });
    });
    
    window.confirm = vi.fn(() => true);
    localStorage.setItem('orbit_token', 'test_token');
  });
  
  afterEach(() => {
    window.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('passes auth token when pruning and deleting images', async () => {
    render(<Images />);
    
    await waitFor(() => {
      expect(screen.getByText('test_img')).toBeTruthy();
    });
    
    const pruneButton = screen.getByText('Limpar Não Utilizadas (Prune)');
    fireEvent.click(pruneButton);
    
    const confirmButton = await screen.findByRole('button', { name: 'Sim, excluir' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const pruneCall = (window.fetch as any).mock.calls.find((call: any[]) => call[0] === '/api/docker/images/prune');
      expect(pruneCall).toBeTruthy();
      expect(pruneCall[1]?.headers?.Authorization).toBe('Bearer test_token');
    });
  });
});
