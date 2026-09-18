import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersTab } from '../../components/layout/UsersTab';

const mockUsers = [
  {
    id: 'user-admin-1',
    username: 'admin',
    display_name: 'Administrador Principal',
    role: 'admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-member-1',
    username: 'membro_familia',
    display_name: 'Membro da Família',
    role: 'member',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('UsersTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/users') && (!init || init.method === 'GET' || !init.method)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        } as Response);
      }
      if (url.includes('/api/users') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    }) as any;
  });

  it('renders user list with admin and member badges', async () => {
    render(<UsersTab />);

    expect(await screen.findByText('Administrador Principal')).toBeTruthy();
    expect(screen.getByText('@membro_familia')).toBeTruthy();
    expect(screen.getByText('Membro da Família')).toBeTruthy();

    const adminBadges = screen.getAllByText('Administrador');
    expect(adminBadges.length).toBeGreaterThan(0);

    const memberBadges = screen.getAllByText('Membro');
    expect(memberBadges.length).toBeGreaterThan(0);
  });

  it('opens new user modal when clicking Novo Usuário button', async () => {
    render(<UsersTab />);

    const newBtn = await screen.findByText('Novo Usuário');
    fireEvent.click(newBtn);

    expect(await screen.findByText('Criar Novo Usuário')).toBeTruthy();
    expect(screen.getByPlaceholderText('ex: maria, lucas')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
  });

  it('allows filling form and submitting new user', async () => {
    render(<UsersTab />);

    const newBtn = await screen.findByText('Novo Usuário');
    fireEvent.click(newBtn);

    const usernameInput = await screen.findByPlaceholderText('ex: maria, lucas');
    const passwordInput = screen.getByPlaceholderText('Mínimo 6 caracteres');

    fireEvent.change(usernameInput, { target: { value: 'novo_membro' } });
    fireEvent.change(passwordInput, { target: { value: 'senhaForte123!' } });

    const submitBtn = screen.getByRole('button', { name: /^Criar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
