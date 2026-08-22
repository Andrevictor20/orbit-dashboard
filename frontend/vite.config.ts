/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5172',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // Warn on chunks > 600KB (recharts is ~500KB minified, that's acceptable)
    chunkSizeWarningLimit: 600,
  },
})
