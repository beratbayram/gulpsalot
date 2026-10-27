/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const isTest = Boolean(process.env.VITEST)

// The web build is served from the root of gulpsalot.beratbayram.com. Native builds
// (Capacitor) can pass GULPSALOT_BASE=./ to get relative paths instead.
const base = process.env.GULPSALOT_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    !isTest &&
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        scope: base,
        pwaAssets: { config: true, overrideManifestIcons: true },
        manifest: {
          id: base,
          name: 'Gulpsalot',
          short_name: 'Gulpsalot',
          description: 'Help Gulpsalot catch flies with a springy tongue. Never lick a bee.',
          lang: 'en',
          theme_color: '#78c6f0',
          background_color: '#bfe6fb',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'portrait',
          start_url: base,
          scope: base,
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
