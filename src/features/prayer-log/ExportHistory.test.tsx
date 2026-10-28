import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTextFile } from '../../native'
import { parseCsv } from './csvTesting'
import { ExportHistory } from './ExportHistory'
import { freezeToday, resetApp, seedLog, seedLoggedAt, seedSessions, seedSunnah, setLanguage } from './test-utils'

vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveTextFile: vi.fn(async () => true),
}))

const TODAY = '2026-10-11'
const save = vi.mocked(saveTextFile)

/** The rows of the file handed over, read as a spreadsheet reads them. */
const exported = (call = 0) => parseCsv((save.mock.calls[call]?.[1] ?? '').replace(/^\uFEFF/, ''))

beforeEach(() => {
  save.mockClear()
  save.mockImplementation(async () => true)
  freezeToday(TODAY, 'Asia/Riyadh')
})

afterEach(() => {
  resetApp()
})

describe('ExportHistory', () => {
  it('says what it will do before anything is recorded, and offers no empty file', () => {
    render(<ExportHistory hasRecord={false} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Your history' })).toBeInTheDocument()
    expect(screen.getByText('Once you have recorded a day, your whole history can be exported here.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hands every recorded day over as a CSV file named for today', async () => {
    seedLog({ '2026-10-09': { fajr: 'ontime' } })
    seedLoggedAt({ '2026-10-09': { fajr: Date.parse('2026-10-09T02:12:00Z') } })
    seedSunnah({ '2026-10-10': { witr: Date.parse('2026-10-10T19:00:00Z') } })
    seedSessions({ [TODAY]: { morning: { completed: false, done: 2, total: 23, recitations: 9 } } })
    const user = userEvent.setup()
    render(<ExportHistory hasRecord />)

    expect(screen.getByText(/Every day you have recorded/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export history (CSV)' }))

    expect(save).toHaveBeenCalledTimes(1)
    const [name, text, type] = save.mock.calls[0]!
    expect(name).toBe('azkar-history-2026-10-11.csv')
    expect(type).toBe('text/csv')
    expect(text.startsWith('\uFEFFDate,Hijri date,Time zone,Fajr: status,Fajr: logged at,')).toBe(true)
    const [header = [], ...rows] = exported()
    expect(rows.map((row) => row[0])).toEqual(['2026-10-09', '2026-10-10', TODAY])
    const column = (title: string) => header.indexOf(title)
    expect(rows[0]![column('Time zone')]).toBe('Asia/Riyadh')
    expect(rows[0]![column('Fajr: logged at')]).toBe('2026-10-09 05:12')
    expect(rows[1]![column('Witr: logged at')]).toBe('2026-10-10 22:00')
    expect(rows[2]![column('Morning azkar: status')]).toBe('In progress')
  })

  it('writes the file in the language of the app', async () => {
    setLanguage('ar')
    seedLog({ '2026-10-09': { fajr: 'late' } })
    const user = userEvent.setup()
    render(<ExportHistory hasRecord />)

    await user.click(screen.getByRole('button', { name: 'تصدير السجل (CSV)' }))
    const [header = [], row = []] = exported()
    expect(header.slice(0, 4)).toEqual(['التاريخ', 'التاريخ الهجري', 'المنطقة الزمنية', 'الفجر: الحالة'])
    expect(row[3]).toBe('قضاء')
  })

  it('names the file for the date where the user is', async () => {
    // Noon in London is already the next day on Kiritimati.
    freezeToday(TODAY, 'Pacific/Kiritimati')
    seedLog({ [TODAY]: { fajr: 'ontime' } })
    const user = userEvent.setup()
    render(<ExportHistory hasRecord />)

    await user.click(screen.getByRole('button', { name: 'Export history (CSV)' }))
    expect(save.mock.calls[0]![0]).toBe('azkar-history-2026-10-12.csv')
    expect(exported()[1]![2]).toBe('Pacific/Kiritimati')
  })

  it('says so when the file could not be saved, and clears that once it is', async () => {
    seedLog({ [TODAY]: { fajr: 'ontime' } })
    save.mockRejectedValueOnce(new Error('disk full'))
    const user = userEvent.setup()
    render(<ExportHistory hasRecord />)

    await user.click(screen.getByRole('button', { name: 'Export history (CSV)' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The file could not be saved. Please try again.')

    await user.click(screen.getByRole('button', { name: 'Export history (CSV)' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not ask twice while the share sheet is still up', async () => {
    seedLog({ [TODAY]: { fajr: 'ontime' } })
    let close: (shared: boolean) => void = () => {}
    save.mockImplementationOnce(() => new Promise<boolean>((resolve) => (close = resolve)))
    const user = userEvent.setup()
    render(<ExportHistory hasRecord />)

    const button = screen.getByRole('button', { name: 'Export history (CSV)' })
    await user.click(button)
    await user.click(button)
    expect(save).toHaveBeenCalledTimes(1)

    close(false)
    await user.click(button)
    expect(save).toHaveBeenCalledTimes(2)
  })
})
