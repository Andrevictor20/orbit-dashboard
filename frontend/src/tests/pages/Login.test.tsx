import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '../../pages/Login';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';

describe('Login component', () => {
  let originalFetch: typeof window.fetch;
  
  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/auth/login') {
        const body = JSON.parse(options.body);
        if (body.username === 'André' && body.password === 'andre1234') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ message: 'success' })
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' })
        });
      }
      return Promise.resolve({ ok: true });
    });
  });
  
  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it('renders login form', () => {
    renderComponent();
    expect(screen.getByLabelText('Usuário')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByText('Entrar no Dashboard')).toBeTruthy();
  });

  it('shows error on empty fields', async () => {
    renderComponent();
    fireEvent.submit(screen.getByRole('button', { name: /Entrar no Dashboard/i }).closest('form')!);
    
    await waitFor(() => {
      expect(screen.getByText('Por favor, preencha todos os campos.')).toBeTruthy();
    });
  });

  it('shows error on invalid credentials', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Dashboard/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas.')).toBeTruthy();
    });
  });

  it('successfully submits valid credentials', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'André' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'andre1234' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Dashboard/i }));
    
    await waitFor(() => {
      // It should call fetch with correct credentials
      const loginCall = (window.fetch as any).mock.calls.find((c: any[]) => c[0] === '/api/auth/login');
      expect(loginCall).toBeTruthy();
      expect(JSON.parse(loginCall[1].body)).toEqual({ username: 'André', password: 'andre1234' });
    });
  });
});
