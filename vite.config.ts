import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { GOLD_RETAIL_HEADERS } from './src/lib/goldRetail'

const goldProxy = { '/api/gold-price': { target: 'https://api.royanews.tv', changeOrigin: true, headers: GOLD_RETAIL_HEADERS, rewrite: () => '/api/v2/gold-prices?type=1' } }

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: goldProxy },
  preview: { proxy: goldProxy },
  ...(mode === 'android' ? {
    root: 'mobile',
    envDir: '..',
    publicDir: false,
    build: { outDir: '../dist-android', emptyOutDir: true },
  } : {}),
}))
