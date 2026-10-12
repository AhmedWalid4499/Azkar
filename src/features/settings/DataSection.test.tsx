import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import { storageKey } from '../../shared/storage'
import { DataSection } from './DataSection'

const LOG_KEY = storageKey('prayer-log')
const OLD_LOG = JSON.stringify({ state: { entries: { '2026-10-10': { fajr: 'ontime' } } }, version: 1 })
const NEW_LOG = { state: { entries: { '2026-09-01': { asr: 'late' } } }, version: 1 }

const reload = vi.fn()

function backupFile(content: object | string, name = 'azkar-backup.json') {
  return new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })
}

function choose(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [file] } })
}

const confirmSheet = () => screen.findByRole('dialog', { name: 'Replace your data?' })

beforeEach(() => {
  reload.mockClear()
  vi.stubGlobal('location', { reload })
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
  localStorage.setItem(LOG_KEY, OLD_LOG)
})

afterEach(() => {
  vi.unstubAllGlobals()
  useSettings.setState(DEFAULT_SETTINGS)
})

describe('DataSection import', () => {
  it('shows the export date and replaces the data on confirmation', async () => {
    render(<DataSection />)
    const exportedAt = '2026-10-11T09:00:00.000Z'
    choose(backupFile({ app: 'azkar', version: 1, exportedAt, data: { [LOG_KEY]: NEW_LOG } }))

    const sheet = await confirmSheet()
    // The day is the reader's own: far enough west it is still the 10th, so it is worked out here the same way.
    const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(exportedAt))
    expect(date).toMatch(/^Oct 1[01], 2026$/)
    expect(sheet).toHaveTextContent(`Importing this backup from ${date} will replace everything`)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Replace and import' }))

    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toEqual(NEW_LOG)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['missing', {}],
    ['not a date', { exportedAt: 'not a date' }],
    ['null', { exportedAt: null }],
    ['a number out of range', { exportedAt: 1.2e19 }],
    ['an object', { exportedAt: {} }],
  ])('asks without a date, instead of crashing, when exportedAt is %s', async (_case, rest) => {
    render(<DataSection />)
    choose(backupFile({ app: 'azkar', version: 1, data: { [LOG_KEY]: NEW_LOG }, ...rest }))

    const sheet = await confirmSheet()
    expect(sheet).toHaveTextContent('Importing this backup will replace everything currently stored in the app on this device.')
    expect(sheet).not.toHaveTextContent('1970')

    // The file is still a good backup and can be imported.
    await userEvent.click(within(sheet).getByRole('button', { name: 'Replace and import' }))
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toEqual(NEW_LOG)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('keeps the old data and says so when the backup cannot be stored', async () => {
    const { setItem } = Storage.prototype
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (value.length > 1000) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    render(<DataSection />)
    choose(
      backupFile({
        app: 'azkar',
        version: 1,
        exportedAt: '2026-10-11T09:00:00.000Z',
        data: { [storageKey('settings')]: { state: {}, version: 1 }, [LOG_KEY]: { ...NEW_LOG, padding: 'x'.repeat(2000) } },
      }),
    )
    const before = { ...localStorage }
    expect(before[LOG_KEY]).toBe(OLD_LOG)
    await userEvent.click(within(await confirmSheet()).getByRole('button', { name: 'Replace and import' }))

    expect(screen.getByRole('alert')).toHaveTextContent('The backup could not be saved, so nothing was changed.')
    expect(screen.queryByRole('dialog', { name: 'Replace your data?' })).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    expect({ ...localStorage }).toEqual(before)
  })

  it('turns down a file that is not a backup, and one far too large to be one', async () => {
    render(<DataSection />)
    choose(backupFile('{"app":"something else"}'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That file is not an Azkar backup.'))

    // A good file clears the message again.
    choose(backupFile({ app: 'azkar', version: 1, exportedAt: '2026-10-11T09:00:00.000Z', data: {} }))
    await userEvent.click(within(await confirmSheet()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).toBeNull()

    const huge = backupFile({ app: 'azkar', version: 1, data: {} })
    const text = vi.spyOn(huge, 'text')
    Object.defineProperty(huge, 'size', { value: 6 * 1024 * 1024 })
    choose(huge)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That file is not an Azkar backup.'))
    // Refused on its size alone, before being read into memory.
    expect(text).not.toHaveBeenCalled()
    expect(localStorage.getItem(LOG_KEY)).toBe(OLD_LOG)
  })
})
