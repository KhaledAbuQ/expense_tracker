import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const goldProxy = { '/api/gold-price': { target: 'https://www.jjsjo.com', changeOrigin: true, rewrite: () => '/' } }

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
