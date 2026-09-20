import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mediaProxyPlugin } from './vite-plugins/mediaProxyPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mediaProxyPlugin()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'vite-plugins/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
