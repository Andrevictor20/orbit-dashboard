import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../testUtils';
import { StoreRepositoriesModal } from '../../../components/appstore/StoreRepositoriesModal';

const mockRepositories = [
  {
    id: 'official',
    name: 'Saturn Apps Official',
    url: 'https://raw.githubusercontent.com/Andrevictor20/saturn-apps/main/catalog.json',
    is_official: true,
    enabled: true,
  },
  {
    id: 'community-1',
    name: 'Community Store Alpha',
    url: 'https://example.com/alpha/catalog.json',
    is_official: false,
    enabled: true,
  },
];

describe('StoreRepositoriesModal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/store/repositories') {
          if (init?.method === 'POST') {
            const body = JSON.parse(init.body as string);
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  message: 'Added',
                  repository: {
                    id: 'community-new',
                    name: body.name,
                    url: body.url,
                    is_official: false,
                    enabled: true,
                  },
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRepositories),
          });
        }
        if (url.startsWith('/api/store/repositories/') && init?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: 'Deleted' }),
          });
        }
        if (url.endsWith('/toggle') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enabled: false }),
          });
        }
        return Promise.reject(new Error(`Not mocked: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <StoreRepositoriesModal isOpen={false} onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders repository list with official and community badges', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['store-repositories'], mockRepositories);

    render(
      <QueryClientProvider client={queryClient}>
        <StoreRepositoriesModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Repositórios da Loja')).toBeInTheDocument();
    expect(screen.getByText('Saturn Apps Official')).toBeInTheDocument();
    expect(screen.getByText('Community Store Alpha')).toBeInTheDocument();
    expect(screen.getByText('Oficial')).toBeInTheDocument();
    expect(screen.getByText('Comunidade')).toBeInTheDocument();
  });

  it('allows adding a new community repository', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['store-repositories'], mockRepositories);
    const onSync = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <StoreRepositoriesModal isOpen={true} onClose={vi.fn()} onSyncTriggered={onSync} />
      </QueryClientProvider>
    );

    const nameInput = screen.getByPlaceholderText(/Minha Loja Homelab/i);
    const urlInput = screen.getByPlaceholderText(/raw.githubusercontent.com/i);
    const submitBtn = screen.getByText('Adicionar Fonte');

    fireEvent.change(nameInput, { target: { value: 'Beta Store' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com/beta/catalog.json' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(nameInput).toHaveValue('');
      expect(urlInput).toHaveValue('');
    });
  });
});
