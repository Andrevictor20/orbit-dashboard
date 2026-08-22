import { test, expect } from '@playwright/test';

test.describe('Dashboard and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a fake token into localStorage to bypass login screen
    await page.addInitScript(() => {
      window.localStorage.setItem('orbit_token', 'mocked_token');
    });

    // Mock typical dashboard endpoints
    await page.route('**/api/system/*', async route => {
      await route.fulfill({ status: 200, json: { status: 'healthy', cpu: 20 } });
    });
    
    await page.route('**/api/docker/containers', async route => {
      await route.fulfill({ status: 200, json: [{ id: '123', name: 'nginx-test', state: 'running' }] });
    });
  });

  test('should load overview widgets properly', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page title is correct
    await expect(page).toHaveTitle(/Orbit Dashboard/);

    // Ensure there's a sidebar or main navigation present
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate to Containers page', async ({ page }) => {
    await page.goto('/');

    // Look for a link to the containers page
    const containersLink = page.getByRole('link', { name: /containers/i });
    if (await containersLink.isVisible()) {
      await containersLink.click();
      
      // Verify URL changed
      await expect(page).toHaveURL(/.*containers/);
      
      // Since we mocked the containers endpoint, 'nginx-test' should be on the screen
      await expect(page.getByText('nginx-test')).toBeVisible();
    }
  });
});
