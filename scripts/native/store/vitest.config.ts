import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Runs the website's real stores to produce the fixtures the native AzkarStore tests compare
// against (see generate.test.ts), and checks that the website reads a backup the native app
// wrote (verify-native-backup.test.ts).
//
//   TZ=UTC npx vitest run --config scripts/native/store/vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  test: {
    env: { AZKAR_STORE_FIXTURES: fileURLToPath(new URL('./fixtures', import.meta.url)) },
    environment: 'jsdom',
    include: ['scripts/native/store/*.test.ts'],
    testTimeout: 60_000,
  },
})
