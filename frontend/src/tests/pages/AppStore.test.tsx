import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AppStore } from '../../../src/pages/AppStore';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallProvider } from '../../../src/contexts/InstallContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils';

const mockApps = [
  {
    id: 'adguard-home',
    name: 'AdGuard Home',
    description: 'Network-wide ads & trackers blocking DNS server',
    icon: 'https://example.com/icon.png',
    category: 'Network',
    store: 'official',
    compose_file: '...'
  },
  {
    id: 'pi-hole',
    name: 'Pi-hole',
    description: 'A black hole for Internet advertisements',
    icon: 'https://example.com/pihole.png',
    category: 'Network',
    store: 'official',
    compose_file: '...'
  }
];

describe('AppStore', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/store/apps') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApps),
        });
      }
      return Promise.reject(new Error('Not found'));
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders explicit explore and install buttons on app cards', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['store-apps'], mockApps);
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <InstallProvider>
            <AppStore />
          </InstallProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for apps to load
    const headings = await screen.findAllByRole('heading', { name: /AdGuard Home/i });
    expect(headings.length).toBeGreaterThan(0);

    // Check if the card has an explicit "Instalar" button and "Explorar" or redirects to details
    const exploreLinks = screen.getAllByText(/explorar/i);
    expect(exploreLinks.length).toBeGreaterThan(0);
    
    // Check if install buttons exist
    const installButtons = screen.getAllByRole('button', { name: /install/i });
    expect(installButtons.length).toBeGreaterThan(0);
  });

  it('filters apps instantly when typing', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['store-apps'], mockApps);
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <InstallProvider>
            <AppStore />
          </InstallProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    await screen.findAllByRole('heading', { name: /AdGuard Home/i });

    const searchInput = screen.getByPlaceholderText(/buscar|search/i);
    fireEvent.change(searchInput, { target: { value: 'Pi-hole' } });

    const piHoleHeadings = await screen.findAllByRole('heading', { name: /Pi-hole/i });
    expect(piHoleHeadings.length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /AdGuard Home/i })).not.toBeInTheDocument();
  });

  it('handles sync repositories action', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/store/apps') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApps),
        });
      }
      if (url === '/api/store/sync') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'App Store synced successfully', total_apps: 1000 }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }));

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <InstallProvider>
            <AppStore />
          </InstallProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    const syncBtn = screen.getByRole('button', { name: /sincronizar lojas/i });
    expect(syncBtn).toBeInTheDocument();
    fireEvent.click(syncBtn);

    expect(syncBtn).toBeDisabled();
  });
});
