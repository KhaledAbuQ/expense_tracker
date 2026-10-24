import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/web',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort`,
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
})
