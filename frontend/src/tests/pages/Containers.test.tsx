import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Containers } from '../../pages/Containers';
import { resetContainerCache } from '../../components/docker/ContainerList';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

declare const global: any;
import { MemoryRouter } from 'react-router-dom';

describe('Containers list component', () => {
  beforeEach(() => {
    resetContainerCache();
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

  it('renders stack groups and opens sub-containers modal when clicked', async () => {
    resetContainerCache();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/docker/containers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'as1', name: 'ar-saude-coletor', image: 'coletor:latest', state: 'running', status: 'Up 1 day', labels: { 'com.docker.compose.project': 'ar-saude' } },
            { id: 'as2', name: 'ar-saude-frontend', image: 'frontend:latest', state: 'running', status: 'Up 1 day', labels: { 'com.docker.compose.project': 'ar-saude' } },
            { id: 'c1', name: 'orbit', image: 'orbit:latest', state: 'running', status: 'Up 1 day' },
          ])
        });
      }
      if (url === '/api/docker/links') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes('/api/docker/containers/stats/snapshot')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    const { findByText, getAllByText } = render(
      <MemoryRouter>
        <Containers />
      </MemoryRouter>
    );

    const groupTitle = await findByText('Ar Saude');
    expect(groupTitle).toBeTruthy();
    expect(await findByText('Stack (2 containers)')).toBeTruthy();
    expect(screen.getAllByText('orbit').length).toBeGreaterThan(0);

    const subBtns = getAllByText('Ver Sub-containers');
    expect(subBtns.length).toBeGreaterThan(0);
    fireEvent.click(subBtns[0]);

    expect(await findByText('Sub-containers do Grupo (2)')).toBeTruthy();
    expect(screen.getByText('ar-saude-coletor')).toBeTruthy();
    expect(screen.getByText('ar-saude-frontend')).toBeTruthy();
  });
});
