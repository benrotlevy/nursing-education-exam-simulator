import { defineConfig, devices } from '@playwright/test';

/**
 * Target Viewport Profiles (per v2 Engineering Standards):
 * 1. Laptop (1440x900)           -> Desktop layout (> 768px)
 * 2. Tablet (768x1024)           -> Tablet breakpoint (<= 768px)
 * 3. Pixel 10 Pro XL (448x998)   -> Smartphone breakpoint (<= 640px, 6.8" 1344x2992 @ 3x DPR)
 * 4. Galaxy S25 (360x780)        -> Ultra-compact smartphone breakpoint (<= 420px, 6.2" 1080x2340 @ 3x DPR)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    locale: 'he-IL',
    channel: process.env.CI ? undefined : 'msedge',
  },
  projects: [
    {
      name: 'laptop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'pixel-10-pro-xl',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 448, height: 998 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'galaxy-s25',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node tools/serve.js --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
