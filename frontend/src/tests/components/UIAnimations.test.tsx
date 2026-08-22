import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { InstallProvider } from '../../contexts/InstallContext';
import { ThemeProvider } from '../../components/ThemeProvider';

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
});
