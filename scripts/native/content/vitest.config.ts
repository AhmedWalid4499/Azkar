import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Runs the parity-fixture generators for the native AzkarContent module (apple/AzkarKit):
//   npx vitest run --config scripts/native/content/vitest.config.ts
// They run the website's own code and write what it returns to scripts/native/content/fixtures,
// which the Swift tests read. Kept apart from the website's test suite, which never runs them.
export default defineConfig({
  root: new URL('../../..', import.meta.url).pathname,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['scripts/native/content/*.gen.ts'],
    testTimeout: 300_000,
  },
})
