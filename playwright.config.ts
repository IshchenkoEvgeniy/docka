import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:1420', headless: true, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: false,
  },
});
