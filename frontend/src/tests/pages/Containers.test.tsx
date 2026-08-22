import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Containers } from '../../pages/Containers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

declare const global: any;
import { MemoryRouter } from 'react-router-dom';

describe('Containers list component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/docker/containers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'c1', name: 'nginx-proxy', image: 'nginx', state: 'running', status: 'Up 2 hours' },
            { id: 'c2', name: 'db', image: 'postgres', state: 'exited', status: 'Exited (0)' }
          ])
        });
      }
      if (url.includes('/api/docker/containers/stats/snapshot')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === '/api/docker/links') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/stop')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    }));
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    render(
      <MemoryRouter>
        <Containers />
      </MemoryRouter>
    );
  };

  it('renders a list of containers', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('nginx-proxy')).toBeTruthy();
      expect(screen.getByText('db')).toBeTruthy();
    });
  });

  it('calls container action endpoints when clicking control buttons', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('nginx-proxy')).toBeTruthy();
    });

    // We should see a "Parar" button for the running container
    const stopBtns = screen.getAllByText('Parar');
    expect(stopBtns.length).toBeGreaterThan(0);
    
    fireEvent.click(stopBtns[0]);
    
    await waitFor(() => {
      const stopCall = (global.fetch as any).mock.calls.find((c: any[]) => 
        c[0] === '/api/docker/containers/c1/stop' && c[1]?.method === 'POST'
      );
      expect(stopCall).toBeTruthy();
    });
  });
});
