import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'fs'
import path from 'path'

// Load .env.e2e if present (Node 20.12+ built-in — no dotenv dependency needed)
const envFile = path.resolve('.env.e2e')
if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  timeout: 35_000,
  expect: { timeout: 10_000 },

  // Run sequentially — tests share Supabase state and must run in order
  workers: 1,
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  // Start the dev server automatically; reuse an already-running one in development
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
