import { test, expect } from '@playwright/test';

test.describe('Dashboard and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass auth and setup checks
    await page.route('**/api/auth/status', async route => {
      await route.fulfill({ status: 200, json: { needs_setup: false } });
    });

    await page.route('**/api/auth/me', async route => {
      await route.fulfill({ status: 200, json: { username: 'admin' } });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('orbit_token', 'mocked_token');
    });

    // Mock typical dashboard endpoints
    await page.route('**/api/docker/containers', async route => {
      await route.fulfill({
        status: 200,
        json: [{
          id: '1234567890ab',
          name: 'nginx-test',
          image: 'nginx:latest',
          status: 'Up 2 hours',
          state: 'running',
          created: 1700000000,
          ports: []
        }]
      });
    });

    await page.route('**/api/docker/containers/stats/snapshot', async route => {
      await route.fulfill({
        status: 200,
        json: { cpu_percent: 15.5, memory_percent: 25.0, memory_used: 1024, memory_limit: 4096 }
      });
    });
  });

  test('should load overview widgets properly', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page title is correct
    await expect(page).toHaveTitle(/Orbit Dashboard/);

    // Ensure the main layout or sidebar is present
    await expect(page.locator('aside, nav, header').first()).toBeVisible();
  });

  test('should navigate to Containers page', async ({ page }) => {
    await page.goto('/');

    // Look for link to containers page
    const containersLink = page.locator('a[href="/containers"]').first();
    await expect(containersLink).toBeVisible();
    await containersLink.click();
    
    // Verify URL changed
    await expect(page).toHaveURL(/.*containers/);
  });
});
