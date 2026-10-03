import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mediaProxyPlugin } from './vite-plugins/mediaProxyPlugin'
import { metaProxyPlugin } from './vite-plugins/metaProxyPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mediaProxyPlugin(), metaProxyPlugin()],
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'vite-plugins/**/*.{test,spec}.{ts,tsx}',
      'api/**/*.{test,spec}.{js,ts}',
    ],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
