/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const isTest = Boolean(process.env.VITEST)

// The web build is served at beratbayram.com/pofik. Native builds (Capacitor) can
// pass POFIK_BASE=./ to get relative paths instead.
const base = process.env.POFIK_BASE ?? '/pofik/'
// The public URL has no trailing slash (the main Next.js site strips it), so the
// service worker scope is "/pofik" and sw.js is served with Service-Worker-Allowed.
const scope = base === './' ? './' : base.replace(/\/$/, '')

export default defineConfig({
  base,
  plugins: [
    react(),
    !isTest &&
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        scope,
        pwaAssets: { config: true, overrideManifestIcons: true },
        manifest: {
          id: scope,
          name: 'Pofik',
          short_name: 'Pofik',
          description: 'Help Pofik catch flies with a springy tongue. Never lick a bee.',
          lang: 'en',
          theme_color: '#78c6f0',
          background_color: '#bfe6fb',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'portrait',
          start_url: scope,
          scope,
          categories: ['games', 'entertainment'],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          cleanupOutdatedCaches: true,
        },
      }),
  ],
  build: {
    target: 'es2022',
    // Pixi alone is ~550 kB minified (~160 kB gzipped); that is expected.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Separate long-lived vendor chunks so game updates don't invalidate them in caches.
        codeSplitting: {
          groups: [
            {
              name: (id: string) =>
                /[\\/]node_modules[\\/]pixi\.js[\\/]/.test(id) ? 'pixi' : null,
            },
            { name: (id: string) => (id.includes('node_modules') ? 'vendor' : null) },
          ],
        },
      },
    },
  },
  // Mirrors the production header so `pnpm preview` can register the worker.
  preview: {
    headers: scope === './' ? {} : { 'Service-Worker-Allowed': scope },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
