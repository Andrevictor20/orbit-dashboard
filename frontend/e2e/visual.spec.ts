import { test, expect } from '@playwright/test';

test.describe('Visual Regression Guardian', () => {
  test.beforeEach(async ({ page }) => {
    // Setup and auth mocks
    await page.route('**/api/auth/status', async route => {
      await route.fulfill({ status: 200, json: { needs_setup: false } });
    });
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({ status: 200, json: { username: 'admin' } });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('orbit_token', 'mocked_token');
    });

    // Mock data for all routes
    await page.route('**/api/docker/containers', async route => {
      await route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/docker/images', async route => {
      await route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/docker/networks', async route => {
      await route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/docker/volumes', async route => {
      await route.fulfill({ status: 200, json: [] });
    });
    await page.route('**/api/store/apps', async route => {
      await route.fulfill({ status: 200, json: [] });
    });
  });

  test('Página de Login (Light e Dark mode)', async ({ page, browserName }) => {
    await page.goto('/login');
    await expect(page).toHaveScreenshot(`login-page-${browserName}.png`, { maxDiffPixelRatio: 0.2 });

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await expect(page).toHaveScreenshot(`login-page-dark-${browserName}.png`, { maxDiffPixelRatio: 0.2 });
  });

  test('Página de Dashboard (Mocked)', async ({ page, browserName }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot(`overview-page-${browserName}.png`, { maxDiffPixelRatio: 0.2 });
  });
});
