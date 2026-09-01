import { render, screen, waitFor } from '@testing-library/react';
import { Containers } from '../../pages/Containers';
import { resetContainerCache } from '../../components/docker/ContainerList';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('Containers list component', () => {
  beforeEach(() => {
    resetContainerCache();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/docker/containers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'c1', name: '/nginx-proxy', image: 'nginx', state: 'running', status: 'Up 2 hours' },
            { id: 'c2', name: '/db', image: 'postgres', state: 'exited', status: 'Exited (0)' }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders containers page', async () => {
    render(<MemoryRouter><Containers /></MemoryRouter>);
    await waitFor(() => {
      // Just check if it renders the page without crashing
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });
  });
});
