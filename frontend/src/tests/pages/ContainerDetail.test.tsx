import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContainerDetail } from '../../pages/ContainerDetail';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

describe('ContainerDetail component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/docker/containers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'test_container_123', name: 'my-container', image: 'nginx', state: 'running', status: 'Up 2 hours' }])
        });
      }
      if (url.includes('/api/docker/containers/stats/snapshot')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === '/api/docker/links') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === '/api/docker/containers/test_container_123') {
        // Inspect response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            Id: 'test_container_123',
            Config: { Env: ['PORT=80'] },
            NetworkSettings: { Ports: { '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }] } }
          })
        });
      }
      if (url === '/api/docker/containers/test_container_123/env') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'recreated_container_456' }) });
      }
      return Promise.resolve({ ok: true });
    }));
    
    window.confirm = vi.fn(() => true);
    localStorage.setItem('orbit_token', 'test_token');
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    render(
      <MemoryRouter initialEntries={['/containers/test_container_123']}>
        <Routes>
          <Route path="/containers/:id" element={<ContainerDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders tabs and overview data', async () => {
    renderComponent();
    
    // Wait for container load
    await waitFor(() => {
      expect(screen.getByText('my-container')).toBeTruthy();
    });

    // Verify tabs exist (TDD RED: they do not exist yet)
    expect(screen.getByText('Visão Geral')).toBeTruthy();
    expect(screen.getByText('Logs')).toBeTruthy();
    expect(screen.getByText('Terminal')).toBeTruthy();
    
    // Verify mapped ports (TDD RED)
    await waitFor(() => {
      expect(screen.getByText(/8080/)).toBeTruthy(); // Should show the mapped host port
    });

    // Verify Open button exists and has correct href (TDD RED)
    const openBtn = screen.getByTitle('Abrir Aplicação') as HTMLAnchorElement;
    expect(openBtn).toBeTruthy();
    expect(openBtn.href).toMatch(/:8080\/?$/);
  });

  it('calls delete endpoint when trash button is clicked', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('my-container')).toBeTruthy();
    });

    // Find delete button by title (TDD RED: doesn't exist yet)
    const deleteButton = screen.getByRole('button', { name: /excluir/i });
    fireEvent.click(deleteButton);
    
    const confirmButton = await screen.findByRole('button', { name: 'Sim, excluir' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const deleteCall = (window.fetch as any).mock.calls.find((c: any) => 
        c[0].includes('/api/docker/containers/test_container_123') && c[1]?.method === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
      expect(deleteCall[1].headers.Authorization).toBe('Bearer test_token');
    });
  });

  it('edits environment variables, adds a pair and recreates the container after confirmation', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('my-container')).toBeTruthy();
    });

    expect(screen.getByText('Variáveis (Env)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Variáveis' }));
    
    // Check if the input with the current env is rendered
    expect(screen.getByDisplayValue('PORT')).toBeTruthy();
    expect(screen.getByDisplayValue('80')).toBeTruthy();
    
    // Click on "Adicionar" button for Env Vars
    const addBtn = screen.getByRole('button', { name: '+ Adicionar' });
    fireEvent.click(addBtn);
    
    // Now there should be an empty input pair
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4); // Initial pair + new pair
    
    // Type a new env
    fireEvent.change(inputs[2], { target: { value: 'TEST_KEY' } });
    fireEvent.change(inputs[3], { target: { value: '123' } });
    
    const saveButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(saveButton);

    const confirmModalButton = await screen.findByRole('button', { name: 'Sim, continuar' });
    fireEvent.click(confirmModalButton);

    await waitFor(() => {
      const updateCall = (window.fetch as any).mock.calls.find((c: any) => 
        c[0] === '/api/docker/containers/test_container_123/env' && c[1]?.method === 'POST'
      );
      expect(updateCall).toBeTruthy();
      expect(JSON.parse(updateCall[1].body).env).toContain('PORT=80');
      expect(JSON.parse(updateCall[1].body).env).toContain('TEST_KEY=123');
      expect(updateCall[1].headers.Authorization).toBe('Bearer test_token');
    });
  });
});
