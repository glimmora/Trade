import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE: docs/internal/** is never imported by the app and is excluded
// from the bundle by construction — no import path reaches it, and the
// build only bundles files under apps/web/src and its workspace deps.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Trade — Charting Terminal',
        short_name: 'Trade',
        description: 'Technical-analysis charting terminal.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Offline shell: cache the app shell; market data is always fresh.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Bundle-size budget: initial JS <= 250 KB gz. Only the charting
    // library chunk is lazy-loaded (ChartView via React.lazy in
    // ChartHost); the rest is the initial bundle. Enforced in CI by the
    // bundle-size check job, which excludes the lazy `charts` chunk.
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['lightweight-charts'],
        },
      },
    },
  },
});
