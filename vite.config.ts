import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

/** `--bg` of the light theme in src/shared/styles/tokens.css: the splash screen and window chrome. */
const PARCHMENT = '#f5f1e8'

/**
 * Copyright and permission notices of every bundled package (React, React
 * Router, zustand, adhan, Lucide, workbox-window, the fonts), which their MIT,
 * ISC and OFL licences require to travel with each copy. Not the default
 * `.vite/license.md`: the Pages upload leaves dot-directories out, and a .md
 * file is served as text/markdown, which some browsers download instead of showing.
 */
const LICENSES_FILE = 'licenses.txt'

const shortcutIcons = [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]

// Every URL here is relative, so it resolves against the manifest's own location
// and the app installs the same way at a domain root and under /Azkar/.
const manifest: Partial<ManifestOptions> = {
  name: 'Azkar — أذكار',
  short_name: 'Azkar',
  description: 'Morning and evening azkar, prayer times for your location and a daily prayer log, private and offline.',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: PARCHMENT,
  theme_color: PARCHMENT,
  lang: 'en',
  // The name carries both scripts. 'auto' is valid in the manifest spec; the plugin's type only lists ltr and rtl.
  dir: 'auto' as ManifestOptions['dir'],
  categories: ['lifestyle', 'utilities'],
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Morning azkar', short_name: 'Morning', url: './#/azkar/morning', icons: shortcutIcons },
    { name: 'Evening azkar', short_name: 'Evening', url: './#/azkar/evening', icons: shortcutIcons },
    { name: 'Prayer log', short_name: 'Log', url: './#/log', icons: shortcutIcons },
  ],
}

// Relative base so the same build works at a domain root and under a
// sub-path such as GitHub Pages' /Azkar/. Routing is hash-based for the same reason.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      // A waiting update is offered in a banner (src/pwa); the page is never reloaded behind the reader's back.
      registerType: 'prompt',
      // Registered from src/app/start.tsx, in production websites only (never inside the iOS and Android apps).
      injectRegister: false,
      manifest,
      // The globs below already pick the icons up from dist/.
      includeManifestIcons: false,
      workbox: {
        // The whole app shell. Legacy .woff copies are left out: every browser that
        // runs a service worker takes the .woff2 listed first in @font-face.
        // The licence notices are precached too, so the link in Settings opens offline
        // and is answered with the file itself rather than the navigation fallback.
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,ico}', LICENSES_FILE],
        globIgnores: ['**/node_modules/**/*', 'sw-notifications.js'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Take over the page that installed the worker, so fonts not yet used are served offline in that first visit too.
        clientsClaim: true,
        // The new worker waits until the reader accepts the update.
        skipWaiting: false,
        // Brings the app forward when a prayer-time notification is tapped.
        importScripts: ['sw-notifications.js'],
        // Deliberately no runtimeCaching: requests to other origins (the geocoding
        // services) go straight to the network, are never stored, and fail offline.
      },
    }),
  ],
  build: {
    license: { fileName: LICENSES_FILE },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // Whole-page tests with user-event run several seconds each when every file runs at once.
    testTimeout: 20_000,
  },
})
