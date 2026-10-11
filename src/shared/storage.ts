/**
 * Everything the app persists lives in localStorage under this prefix, one key
 * per zustand store. Nothing leaves the device.
 */
export const STORAGE_PREFIX = 'azkar:'

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}

export interface BackupFile {
  app: 'azkar'
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

function ownKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  return keys
}

export function exportBackup(now: Date = new Date()): BackupFile {
  const data: Record<string, unknown> = {}
  for (const key of ownKeys()) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      // Skip anything that is not ours to interpret.
    }
  }
  return { app: 'azkar', version: 1, exportedAt: now.toISOString(), data }
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BackupFile>
  if (candidate.app !== 'azkar' || candidate.version !== 1) return false
  if (typeof candidate.data !== 'object' || candidate.data === null || Array.isArray(candidate.data)) return false
  return Object.keys(candidate.data).every((key) => key.startsWith(STORAGE_PREFIX))
}

/** Replaces all stored data with the backup. Reload afterwards so stores rehydrate. */
export function importBackup(backup: BackupFile): void {
  for (const key of ownKeys()) localStorage.removeItem(key)
  for (const [key, value] of Object.entries(backup.data)) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}

/** Removes all stored data. Reload afterwards so stores reset. */
export function clearAllData(): void {
  for (const key of ownKeys()) localStorage.removeItem(key)
}
