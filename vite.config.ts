import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  ...(mode === 'android' ? {
    root: 'mobile',
    envDir: '..',
    publicDir: false,
    build: { outDir: '../dist-android', emptyOutDir: true },
  } : {}),
}))
