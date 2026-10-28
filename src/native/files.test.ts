import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  native: false,
  writeFile: vi.fn(async (_options: { path: string; data: string; directory: string; encoding: string }) => ({
    uri: 'file:///cache/backup.json',
  })),
  share: vi.fn(async (_options: { title: string; files: string[] }) => ({})),
}))

vi.mock('./platform', () => ({ isNativeApp: () => mocks.native, appPlatform: () => (mocks.native ? 'ios' : 'web') }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: { writeFile: mocks.writeFile },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }))

const { saveTextFile } = await import('./files')

const BACKUP = '{"app":"azkar","version":1}'

beforeEach(() => {
  mocks.native = false
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saveTextFile', () => {
  it('downloads the file in a browser, as the website always has', async () => {
    const blobs: Blob[] = []
    // jsdom has no object URLs.
    class ObjectUrls extends URL {
      static createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob)
        return 'blob:backup'
      })
      static revokeObjectURL = vi.fn()
    }
    vi.stubGlobal('URL', ObjectUrls)
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })

    await expect(saveTextFile('azkar-backup-2026-10-27.json', BACKUP, 'application/json')).resolves.toBe(true)

    expect(clicked).toHaveLength(1)
    expect(clicked[0]!.download).toBe('azkar-backup-2026-10-27.json')
    expect(clicked[0]!.href).toBe('blob:backup')
    expect(clicked[0]!.isConnected).toBe(false)
    expect(blobs[0]!.type).toBe('application/json')
    expect(await blobs[0]!.text()).toBe(BACKUP)
    expect(ObjectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:backup')
    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(mocks.share).not.toHaveBeenCalled()
  })

  it('in the app, writes the file and hands it to the share sheet', async () => {
    mocks.native = true
    await expect(saveTextFile('azkar-backup-2026-10-27.json', BACKUP, 'application/json')).resolves.toBe(true)
    expect(mocks.writeFile).toHaveBeenCalledWith({
      path: 'azkar-backup-2026-10-27.json',
      data: BACKUP,
      directory: 'CACHE',
      encoding: 'utf8',
    })
    expect(mocks.share).toHaveBeenCalledWith({ title: 'azkar-backup-2026-10-27.json', files: ['file:///cache/backup.json'] })
  })

  it('treats closing the share sheet as a choice, not a failure', async () => {
    mocks.native = true
    // The words iOS and Android reject with.
    mocks.share.mockRejectedValueOnce(new Error('Share canceled'))
    await expect(saveTextFile('backup.json', BACKUP, 'application/json')).resolves.toBe(false)
  })

  it('passes on a real failure, so the user is told', async () => {
    mocks.native = true
    mocks.writeFile.mockRejectedValueOnce(new Error('No space left on device'))
    await expect(saveTextFile('backup.json', BACKUP, 'application/json')).rejects.toThrow('No space left')

    mocks.share.mockRejectedValueOnce(new Error('No activity found'))
    await expect(saveTextFile('backup.json', BACKUP, 'application/json')).rejects.toThrow('No activity found')
  })
})
