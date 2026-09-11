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

  it('renders update success banner when ?updated=true is present in url', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?updated=true&version=1.9.8']}>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Orbit Atualizado com Sucesso!')).toBeInTheDocument();
    expect(screen.getByText('v1.9.8')).toBeInTheDocument();
    expect(screen.getByText(/O sistema foi atualizado para a versão mais recente/i)).toBeInTheDocument();
  });

  it('transitions to 2FA view when login requires two factor authentication', async () => {
    (window.fetch as any).mockImplementation((url: string, options: any) => {
      if (url === '/api/auth/login') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ requires_2fa: true, temp_token: 'temp_token_xyz' }),
        });
      }
      if (url === '/api/auth/2fa/login') {
        const body = JSON.parse(options.body);
        if (body.code === '123456') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ message: 'success' }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Invalid code' }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'André' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'andre1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Dashboard/i }));

    // Should now show 2FA screen
    await waitFor(() => {
      expect(screen.getByText('Verificação em Duas Etapas')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    // Test entering wrong 2FA code
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /Verificar e Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Código inválido|Código de autenticação/i)).toBeInTheDocument();
    });

    // Test entering correct 2FA code
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verificar e Entrar/i }));

    await waitFor(() => {
      const calls2fa = (window.fetch as any).mock.calls.filter((c: any[]) => c[0] === '/api/auth/2fa/login');
      expect(calls2fa.length).toBe(2);
      expect(JSON.parse(calls2fa[1][1].body)).toEqual({
        temp_token: 'temp_token_xyz',
        code: '123456',
      });
    });
  });

  it('can navigate back from 2FA to credentials form', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/auth/login') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ requires_2fa: true, temp_token: 'temp_token_xyz' }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'André' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'andre1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Verificação em Duas Etapas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Voltar para usuário e senha/i }));

    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });
});
