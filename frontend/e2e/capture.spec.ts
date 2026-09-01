import { test, expect } from '@playwright/test';

test('Capture Screenshots for README', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Navigate to root to set local storage and intercept routes
  await page.goto('http://localhost:5173/');

  await page.evaluate(() => {
    localStorage.setItem('orbit_token', 'fake_token');
    localStorage.setItem('theme', 'zinc');
  });

  // Mock API routes to ensure dashboard/metrics/files load nicely if backend is missing
  await page.route('**/api/auth/status', async route => {
    await route.fulfill({ status: 200, json: { needs_setup: false } });
  });
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({ status: 200, json: { username: 'admin' } });
  });
  await page.route('**/api/docker/**', async route => {
    await route.fulfill({ status: 200, json: [] });
  });
  await page.route('**/api/system/metrics', async route => {
    await route.fulfill({ status: 200, json: { cpu: 25, ram: 4096, network: { rx: 1024, tx: 2048 } } });
  });

  // Disk Analyzer
  await page.goto('http://localhost:5173/disk-analyzer');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../docs/images/13_disk_analyzer.png' });

  // File Manager - show orbit folder
  await page.route('**/api/files/list*', async route => {
    await route.fulfill({ status: 200, json: [
      { name: 'frontend', path: '/home/andrevmp/Downloads/Orbit/frontend', is_dir: true, size: 4096, modified_at: '2023-10-01' },
      { name: 'backend', path: '/home/andrevmp/Downloads/Orbit/backend', is_dir: true, size: 4096, modified_at: '2023-10-01' },
      { name: 'README.md', path: '/home/andrevmp/Downloads/Orbit/README.md', is_dir: false, size: 10240, modified_at: '2023-10-01' },
      { name: 'docker-compose.yml', path: '/home/andrevmp/Downloads/Orbit/docker-compose.yml', is_dir: false, size: 512, modified_at: '2023-10-01' }
    ] });
  });
  await page.goto('http://localhost:5173/files');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../docs/images/08_file_manager.png' });

  // Terminal
  await page.goto('http://localhost:5173/terminal');
  await page.waitForTimeout(2000);
  
  // Fill the SSH login form
  // We use more robust locators
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('andrevmp');
    await inputs[1].fill('andre1234');
  }
  
  // Click connect
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text && text.toLowerCase().includes('conectar')) {
      await btn.click();
      break;
    }
  }
  
  // Wait for the xterm canvas to appear
  try {
    await page.waitForSelector('.xterm', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(3000); // Wait for the terminal to print MOTD/prompt
  } catch (e) {
    console.log("Terminal might not have loaded properly", e);
  }
  await page.screenshot({ path: '../docs/images/10_terminal.png' });

  // Logs
  // await page.goto('http://localhost:5173/logs');
  // await page.waitForTimeout(2000);
  // await page.screenshot({ path: '../docs/images/11_logs.png' });
  // Logs were correct according to the user, no need to overwrite if not necessary, but let's do it for completeness if we want.

  // Themes
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  
  await page.evaluate(() => {
    localStorage.setItem('orbit_theme', 'catppuccin-mocha');
    localStorage.setItem('orbit_color', 'blue');
    document.documentElement.className = 'dark theme-catppuccin-mocha color-blue';
  });
  
  // Click the theme switcher to show the dropdown open
  try {
    const headerButtons = await page.$$('header button');
    if (headerButtons.length > 0) {
      await headerButtons[headerButtons.length - 2].click();
    }
  } catch(e) {}
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '../docs/images/12_themes.png' });
});
