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
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // OPT-F5: Split heavy dependencies into separate chunks for better caching
    // and so pages that don't need recharts/xterm don't load them
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes rarely, long cache lifetime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts — heavy (~500KB), only used in Overview, Metrics, ContainerDetail
          'vendor-recharts': ['recharts'],
          // Terminal — heavy (~300KB), only used in ContainerDetail and Terminal pages
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          // Misc UI libs
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          // i18n — only needed at startup
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
    // Warn on chunks > 600KB (recharts is ~500KB minified, that's acceptable)
    chunkSizeWarningLimit: 600,
  },
})
