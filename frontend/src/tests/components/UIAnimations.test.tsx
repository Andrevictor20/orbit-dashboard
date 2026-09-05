import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { InstallProvider } from '../../contexts/InstallContext';
import { ThemeProvider } from '../../contexts/ThemeContext';

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({ logout: vi.fn(), isAuthenticated: true }),
    AuthProvider: ({ children }: any) => <div>{children}</div>
  };
});

vi.mock('../../contexts/InstallContext', async () => {
  const actual = await vi.importActual('../../contexts/InstallContext');
  return {
    ...actual,
    useInstall: () => ({ taskId: null, appName: null, task: null, maximize: vi.fn() }),
    InstallProvider: ({ children }: any) => <div>{children}</div>
  };
});

describe('DashboardLayout UI/UX', () => {
  it('should have animation classes for layout and content wrapper', () => {
    const { container } = render(
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" defaultColor="zinc">
          <AuthProvider>
            <InstallProvider>
              <DashboardLayout>
                <div data-testid="page-content">Test Content</div>
              </DashboardLayout>
            </InstallProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Assert main content has animate-fade-in
    const mainContent = container.querySelector('main > div.animate-fade-in');
    expect(mainContent).not.toBeNull();
    expect(mainContent?.className).toContain('animate-fade-in');
    expect(mainContent?.className).toContain('p-3.5');
  });

  it('renders mobile-optimized top bar controls with touch targets and preferences menu', async () => {
    const { container } = render(
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" defaultColor="zinc">
          <AuthProvider>
            <InstallProvider>
              <DashboardLayout>
                <div>Content</div>
              </DashboardLayout>
            </InstallProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Verify mobile hamburger button has ergonomic w-9 h-9 target
    const mobileMenuBtn = container.querySelector('button[aria-label="Abrir menu de navegação"]');
    expect(mobileMenuBtn).not.toBeNull();
    expect(mobileMenuBtn?.className).toContain('w-9');
    expect(mobileMenuBtn?.className).toContain('h-9');

    // Verify mobile preferences dropdown button is present
    const prefBtn = container.querySelector('button[aria-label="Preferências (Tema e Idioma)"]');
    expect(prefBtn).not.toBeNull();
    expect(prefBtn?.className).toContain('w-9');
    expect(prefBtn?.className).toContain('h-9');

    // Click preferences to open popup
    fireEvent.click(prefBtn!);

    // Should display color themes and languages
    expect(container.textContent).toContain('Tema');
    expect(container.textContent).toContain('Idioma');
    expect(container.textContent).toContain('Zinc');
    expect(container.textContent).toContain('Tokyo Night');
  });
});
