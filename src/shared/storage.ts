/**
 * Everything the app persists lives in localStorage under this prefix, one key
 * per zustand store. Nothing leaves the device.
 */
export const STORAGE_PREFIX = 'azkar:'

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}

/**
 * The keys the app reads, one per persisted store. A backup may carry other
 * `azkar:` keys (written by a newer build, say); import leaves those out, since
 * nothing would ever read them.
 */
export const STORE_KEYS: readonly string[] = [
  'settings',
  'location',
  'prayer-times',
  'prayer-log',
  'azkar-progress',
  'azkar-settings',
].map(storageKey)

export interface BackupFile {
  app: 'azkar'
  version: 1
  /** Informational only, and not checked by `isBackupFile`: read it through `backupDate`. */
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

/** When the backup was exported, or `null` if the file does not say so in a form that can be shown. */
export function backupDate(backup: BackupFile): Date | null {
  const exportedAt: unknown = backup.exportedAt
  if (typeof exportedAt !== 'string') return null
  const date = new Date(exportedAt)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Replaces all stored data with the backup. Reload afterwards so stores rehydrate.
 *
 * All or nothing: if the backup cannot be written in full (the storage quota,
 * usually), what was stored before is put back and the error is rethrown.
 */
export function importBackup(backup: BackupFile): void {
  // Serialised before anything is removed, so no failure here can cost the old data.
  const incoming = Object.entries(backup.data)
    .filter(([key]) => STORE_KEYS.includes(key))
    .map(([key, value]) => [key, JSON.stringify(value)] as const)
  const previous = ownKeys().map((key) => [key, localStorage.getItem(key)] as const)

  try {
    for (const [key] of previous) localStorage.removeItem(key)
    for (const [key, raw] of incoming) localStorage.setItem(key, raw)
  } catch (error) {
    for (const [key] of incoming) localStorage.removeItem(key)
    // It fitted before, so it fits again.
    for (const [key, raw] of previous) {
      if (raw !== null) localStorage.setItem(key, raw)
    }
    throw error
  }
}

/** Removes all stored data. Reload afterwards so stores reset. */
export function clearAllData(): void {
  for (const key of ownKeys()) localStorage.removeItem(key)
}
