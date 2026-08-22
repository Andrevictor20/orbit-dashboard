import { test, expect } from '@playwright/test';

test.describe('Visual Regression Guardian', () => {
  test('Página de Login (Light e Dark mode) e Estados', async ({ page, browserName }) => {
    await page.goto('/login');

    // 1. Baseline - Default view
    await expect(page).toHaveScreenshot(`login-page-${browserName}.png`, { maxDiffPixelRatio: 0.05 });

    // 2. Dark Mode Toggle (Simulating preference if supported or adding a class)
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login'); // Reload to apply CSS if needed
    await expect(page).toHaveScreenshot(`login-page-dark-${browserName}.png`, { maxDiffPixelRatio: 0.05 });

    // 3. Hover State on Login Button
    await page.hover('button[type="submit"]');
    await expect(page).toHaveScreenshot(`login-button-hover-${browserName}.png`, { maxDiffPixelRatio: 0.05 });
  });

  test('Página de Dashboard (Mocked)', async ({ page, browserName }) => {
    // Navigate to a mocked overview state to prevent dynamic data from breaking visual tests
    await page.goto('/overview');
    await expect(page).toHaveScreenshot(`overview-page-${browserName}.png`, { maxDiffPixelRatio: 0.1 });
  });

  test('Página de Containers', async ({ page, browserName }) => {
    await page.goto('/containers');
    await expect(page).toHaveScreenshot(`containers-page-${browserName}.png`, { maxDiffPixelRatio: 0.1 });
  });

  test('Página de Images', async ({ page, browserName }) => {
    await page.goto('/images');
    await expect(page).toHaveScreenshot(`images-page-${browserName}.png`, { maxDiffPixelRatio: 0.1 });
  });

  test('Página de Networks', async ({ page, browserName }) => {
    await page.goto('/networks');
    await expect(page).toHaveScreenshot(`networks-page-${browserName}.png`, { maxDiffPixelRatio: 0.1 });
  });
});
