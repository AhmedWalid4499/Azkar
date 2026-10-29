// Checks that the website opens a backup the native app exported: fixtures/native-backup.json is
// written by the AzkarStore tests (BackupTests.theNativeBackupFixtureIsCurrent). The website must
// accept the file, import it, and load from it exactly the records and settings it holds, for
// every store and field the website knows. Run with the other fixtures:
//
//   TZ=UTC npx vitest run --config scripts/native/store/vitest.config.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hydrate, loadStores, localStorageSnapshot, STORE_NAMES } from './web'

const FIXTURES = `${process.env.AZKAR_STORE_FIXTURES}/`

interface Backup {
  data: Record<string, { state: Record<string, unknown>; version: number }>
}

/** Only the fields `like` has: what the website's own stores keep of a richer native state. */
function only(value: Record<string, unknown>, like: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(like).map((key) => [key, value[key]]))
}

describe('a backup exported by the native app', () => {
  const backup = JSON.parse(readFileSync(`${FIXTURES}native-backup.json`, 'utf8')) as Backup

  it('is a backup file the website accepts and loads in full', async () => {
    localStorage.clear()
    const { storage } = await loadStores()
    expect(storage.isBackupFile(backup)).toBe(true)
    storage.importBackup(backup as never)
    const loaded = await hydrate(localStorageSnapshot())

    for (const name of STORE_NAMES) {
      const state = backup.data[`azkar:${name}`]?.state
      expect(state, name).toBeDefined()
      const stored = loaded[name] as Record<string, unknown>
      // Every field the website keeps comes back exactly as the native app wrote it.
      expect(only(state as Record<string, unknown>, stored), name).toEqual(stored)
    }
  })

  it('holds records of every kind the website shows', () => {
    const log = backup.data['azkar:prayer-log']?.state as { entries: object; loggedAt: object; sunnah: object }
    const progress = backup.data['azkar:azkar-progress']?.state as { sessions: object; totals: object; history: object }
    expect(Object.keys(log.entries).length).toBeGreaterThan(0)
    expect(Object.keys(log.sunnah).length).toBeGreaterThan(0)
    expect(Object.keys(progress.sessions).length).toBeGreaterThan(0)
    expect(Object.keys(progress.totals).length).toBeGreaterThan(0)
  })
})
