import { defineConfig } from '@playwright/test'

const env = { PORT: '3000', DATABASE_PATH: './data/e2e.db', ADMIN_PASSWORD: 'e2e-password', SESSION_SECRET: 'e2e-secret', NODE_ENV: 'production', SEED_DEMO_EVENT: 'true' }
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  globalSetup: './e2e/reset.ts',
  webServer: { command: 'npm run build && npm run start', port: 3000, reuseExistingServer: false, timeout: 240000, env },
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
})
