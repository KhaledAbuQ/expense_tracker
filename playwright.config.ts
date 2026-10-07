import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/mobile',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --mode android --host 127.0.0.1 --port 4174 --strictPort`,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
