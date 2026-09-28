import { defineConfig } from '@playwright/test';
const production = process.env.TEST_PRODUCTION === '1';
const baseURL = production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 90000,
  use: { baseURL, channel: 'chrome', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: production ? 'npm run preview' : 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60000 },
});
