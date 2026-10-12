import { describe, expect, it, vi } from 'vitest'
import { backupDate, clearAllData, exportBackup, importBackup, isBackupFile, storageKey, STORE_KEYS } from './storage'
import type { BackupFile } from './storage'

const LOG_KEY = storageKey('prayer-log')
const LOCATION_KEY = storageKey('location')
const SETTINGS_KEY = storageKey('settings')

/** A backup as it would be read from a file, where `exportedAt` can be anything or absent. */
function backupOf(data: Record<string, unknown>, rest: object = { exportedAt: '2026-10-11T00:00:00.000Z' }): BackupFile {
  return { app: 'azkar', version: 1, data, ...rest } as BackupFile
}

/** Storage that refuses any single value longer than `limit`, as a browser does when the quota is used up. */
function limitValues(limit: number) {
  const { setItem } = Storage.prototype
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (value.length > limit) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
}

describe('backup', () => {
  it('round-trips only the app’s own keys', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify({ state: { x: 1 }, version: 1 }))
    localStorage.setItem('someone-else', '"keep me"')

    const backup = exportBackup(new Date('2026-10-11T00:00:00Z'))
    expect(backup.data).toEqual({ 'azkar:prayer-log': { state: { x: 1 }, version: 1 } })
    expect(isBackupFile(JSON.parse(JSON.stringify(backup)))).toBe(true)

    localStorage.setItem(LOCATION_KEY, '1')
    importBackup(backup)
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toEqual({ state: { x: 1 }, version: 1 })
    expect(localStorage.getItem('someone-else')).toBe('"keep me"')
  })

  it('accepts a backup with keys it does not know and leaves them out', () => {
    const backup = backupOf({ [LOG_KEY]: { state: { x: 1 }, version: 1 }, 'azkar:from-a-newer-build': { a: 1 }, 'azkar:junk': 'x' })
    expect(isBackupFile(backup)).toBe(true)

    localStorage.setItem('azkar:stale', '1')
    importBackup(backup)

    expect(STORE_KEYS).toContain(LOG_KEY)
    expect(Object.keys(localStorage)).toEqual([LOG_KEY])
  })

  it('puts the previous data back when the backup cannot be written in full', () => {
    const before = {
      [LOCATION_KEY]: JSON.stringify({ state: { location: null }, version: 1 }),
      [LOG_KEY]: JSON.stringify({ state: { entries: { '2026-10-10': { fajr: 'ontime' } } }, version: 1 }),
      'azkar:left-by-an-older-build': '"kept too"',
    }
    for (const [key, raw] of Object.entries(before)) localStorage.setItem(key, raw)
    localStorage.setItem('someone-else', '"keep me"')
    limitValues(200)

    // The first key fits and is written before the second one fails.
    const backup = backupOf({
      [SETTINGS_KEY]: { state: { theme: 'dark' }, version: 1 },
      [LOG_KEY]: { state: { entries: {}, padding: 'x'.repeat(500) }, version: 1 },
    })
    expect(() => importBackup(backup)).toThrow(/quota/i)

    expect({ ...localStorage }).toEqual({ ...before, 'someone-else': '"keep me"' })
  })

  it('reads the export date only when the file carries a usable one', () => {
    expect(backupDate(exportBackup(new Date('2026-10-11T00:00:00Z')))).toEqual(new Date('2026-10-11T00:00:00Z'))
    expect(backupDate(backupOf({}, {}))).toBeNull()
    for (const exportedAt of [null, 0, 1.2e19, {}, '', 'not a date', '2026-13-45T00:00:00Z']) {
      const backup = backupOf({}, { exportedAt })
      // Still a backup: the date is informational and the data is what matters.
      expect(isBackupFile(backup)).toBe(true)
      expect(backupDate(backup)).toBeNull()
    }
  })

  it('rejects files that are not backups or would write foreign keys', () => {
    expect(isBackupFile(null)).toBe(false)
    expect(isBackupFile({ app: 'other', version: 1, data: {} })).toBe(false)
    expect(isBackupFile({ app: 'azkar', version: 2, data: {} })).toBe(false)
    expect(isBackupFile({ app: 'azkar', version: 1, data: [] })).toBe(false)
    expect(isBackupFile({ app: 'azkar', version: 1, exportedAt: '', data: { token: 'x' } })).toBe(false)
  })

  it('clears only the app’s own keys', () => {
    localStorage.setItem(storageKey('a'), '1')
    localStorage.setItem('someone-else', '1')
    clearAllData()
    expect(localStorage.getItem(storageKey('a'))).toBeNull()
    expect(localStorage.getItem('someone-else')).toBe('1')
  })
})
