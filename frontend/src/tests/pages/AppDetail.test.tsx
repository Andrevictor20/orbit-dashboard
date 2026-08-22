import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppDetail } from '../../../src/pages/AppDetail';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallProvider } from '../../../src/contexts/InstallContext';

const mockApp = {
  id: 'adguard-home',
  name: 'AdGuard Home',
  description: 'Network-wide ads & trackers blocking DNS server',
  icon: 'https://example.com/icon.png',
  category: 'Network',
  store: 'official',
  compose_file: '...'
};

describe('AppDetail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/store/apps') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockApp]),
        });
      }
      return Promise.reject(new Error('Not found'));
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders app details correctly and shows install button', async () => {
    window.history.pushState({}, 'Test', '/store/app/adguard-home');

    render(
      <BrowserRouter>
        <InstallProvider>
          <Routes>
            <Route path="/store/app/:id" element={<AppDetail />} />
          </Routes>
        </InstallProvider>
      </BrowserRouter>
    );

    // Should fetch and show app details
    await screen.findByRole('heading', { name: /AdGuard Home/i });
    expect(screen.getByText(/Network-wide ads & trackers blocking/i)).toBeInTheDocument();

    // Should have a prominent Install button
    const installButton = screen.getByRole('button', { name: /instalar/i });
    expect(installButton).toBeInTheDocument();
    
    // Should display category
    expect(screen.getByText('Network')).toBeInTheDocument();
  });
});
