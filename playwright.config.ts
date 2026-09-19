import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 2,
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    {
      name: 'mobile',
      testMatch: /(workspace|routes|marketing|assistant-ui|assistant-stream)\.spec\.ts/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    env: { BIDXCHANGE_AI_DEMO_ENABLED: 'true', BIDXCHANGE_AI_ENABLED: 'false' },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
