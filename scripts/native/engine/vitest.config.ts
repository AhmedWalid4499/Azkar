// Runs the fixture generator with the repo's own vitest, so the website's TypeScript is
// executed exactly as its tests execute it. Usage (from the repository root):
//
//   WIP_SNAPSHOT_DIR=/some/scratch/dir npx vitest run --config scripts/native/engine/vitest.config.ts
//
// It writes apple/AzkarKit/Tests/PrayerEngineTests/Fixtures/*.json.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The snapshot of the other branch's files is written outside the repository.
  server: { fs: { strict: false } },
  test: {
    root: new URL('../../..', import.meta.url).pathname,
    include: ['scripts/native/engine/generate.fixtures.ts'],
    environment: 'jsdom',
    testTimeout: 600_000,
  },
})
