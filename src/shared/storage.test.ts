import { describe, expect, it } from 'vitest'
import { clearAllData, exportBackup, importBackup, isBackupFile, storageKey } from './storage'

describe('backup', () => {
  it('round-trips only the app’s own keys', () => {
    localStorage.setItem(storageKey('a'), JSON.stringify({ state: { x: 1 }, version: 1 }))
    localStorage.setItem('someone-else', '"keep me"')

    const backup = exportBackup(new Date('2026-10-11T00:00:00Z'))
    expect(backup.data).toEqual({ 'azkar:a': { state: { x: 1 }, version: 1 } })
    expect(isBackupFile(JSON.parse(JSON.stringify(backup)))).toBe(true)

    localStorage.setItem(storageKey('b'), '1')
    importBackup(backup)
    expect(localStorage.getItem(storageKey('b'))).toBeNull()
    expect(JSON.parse(localStorage.getItem(storageKey('a'))!)).toEqual({ state: { x: 1 }, version: 1 })
    expect(localStorage.getItem('someone-else')).toBe('"keep me"')
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
