import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 1100 },
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm.cmd run start:dev',
      cwd: '../backend',
      url: 'http://localhost:3001/api',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm.cmd run dev -- --host localhost --port 5173',
      cwd: '.',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
