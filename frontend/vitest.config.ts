import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Exclude Playwright E2E and Pact contract tests — they run in their own separate runners
    exclude: [
      'e2e/**',
      'tests/contract/**',
      'node_modules/**',
    ],
  },
});
