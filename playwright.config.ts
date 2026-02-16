import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Setup projects - run first to authenticate
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Tests that don't require auth
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /landing\.spec\.ts|navigation\.spec\.ts/,
    },
    // Tests that require parent auth
    {
      name: 'parent',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/parent.json',
      },
      dependencies: ['setup'],
      testMatch: /quests\.spec\.ts|me\.spec\.ts|family\.spec\.ts|family-invite\.spec\.ts|rewards\.spec\.ts/,
    },
    // Tests that require child auth
    {
      name: 'child',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/child.json',
      },
      dependencies: ['setup'],
      testMatch: /permissions\.spec\.ts/,
    },
    // Auth page tests (login, signup, join) - no auth needed
    {
      name: 'auth-pages',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
