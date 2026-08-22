import { test, expect } from '@playwright/test';

test('has expected title', async ({ page }) => {
  await page.goto('/');

  // Assuming Orbit has a title set or a specific main element.
  // We'll just verify the page loads and has a basic title to start.
  await expect(page).toHaveTitle(/Orbit Dashboard/); 
  // We can update this once we verify the actual app title.
});
