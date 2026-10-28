import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../shared/settings'
import type { DateKey } from '../../shared/types'
import type { SessionRecord } from '../azkar'
import { DayPanel } from './DayPanel'
import { usePrayerLog } from './store'
import { freezeToday, resetApp, seedLog, seedLoggedAt, seedSessions, seedSunnah, setLanguage } from './test-utils'

vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))
vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))

const TODAY = '2026-10-11'
const PAST = '2026-10-09'
/** An instant given as UTC wall-clock time. Riyadh, where these tests are set, is three hours ahead. */
const AT = (dateKey: DateKey, time: string) => Date.parse(`${dateKey}T${time}:00Z`)

function renderPanel(dateKey: DateKey, onOpenDay = vi.fn()) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<DayPanel dateKey={dateKey} isToday={dateKey === TODAY} onOpenDay={onOpenDay} />} />
        <Route path="azkar/:collection" element={<h1>Reader</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Text with every kind of space as a plain one: Intl puts a narrow no-break space before AM and PM. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ')
const prayerRow = (name: string) => screen.getByRole('heading', { level: 4, name }).closest('li')!
const session = (name: string) => screen.getByRole('heading', { level: 4, name }).closest('li')!
/** A session's facts as "label value" pairs. */
const facts = (name: string) =>
  [...session(name).querySelectorAll('dl > div')].map(
    (fact) => plain(`${fact.querySelector('dt')?.textContent} ${fact.querySelector('dd')?.textContent}`),
  )

beforeEach(() => {
  freezeToday(TODAY, 'Asia/Riyadh')
})

afterEach(() => {
  resetApp()
})

describe('the time each prayer was logged', () => {
  it('is shown in the active zone, with the date when it was logged on another day', () => {
    seedLog({ [PAST]: { fajr: 'ontime', dhuhr: 'late', asr: 'jamaah' } })
    seedLoggedAt({ [PAST]: { fajr: AT(PAST, '02:12'), dhuhr: AT('2026-10-10', '18:03') } })
    renderPanel(PAST)

    expect(prayerRow('Fajr')).toHaveTextContent(/Logged at 5:12\sAM$/)
    expect(prayerRow('Dhuhr')).toHaveTextContent(/Logged on Oct 10 at 9:03\sPM$/)
    // Logged before times were kept: the status alone.
    expect(prayerRow('Asr')).not.toHaveTextContent('Logged')
    expect(prayerRow('Maghrib')).not.toHaveTextContent('Logged')
  })

  it('follows the 24-hour clock setting', () => {
    useSettings.setState({ timeFormat: '24h' })
    seedLog({ [PAST]: { fajr: 'ontime' } })
    seedLoggedAt({ [PAST]: { fajr: AT(PAST, '02:12') } })
    renderPanel(PAST)
    expect(prayerRow('Fajr')).toHaveTextContent(/Logged at 05:12$/)
  })

  it('appears as soon as a prayer is logged, and goes when it is cleared', async () => {
    const user = userEvent.setup()
    renderPanel(TODAY)

    const isha = within(screen.getByRole('radiogroup', { name: 'Isha status' }))
    await user.click(isha.getByRole('radio', { name: 'On time' }))
    // Noon UTC is 3 pm in Riyadh.
    expect(prayerRow('Isha')).toHaveTextContent(/Logged at 3:00\sPM$/)
    expect(usePrayerLog.getState().loggedAt[TODAY]?.isha).toBe(AT(TODAY, '12:00'))

    await user.click(screen.getByRole('button', { name: 'Clear Isha entry' }))
    expect(prayerRow('Isha')).not.toHaveTextContent('Logged')
  })

  it('is written in Arabic', () => {
    setLanguage('ar')
    seedLog({ [PAST]: { fajr: 'ontime', dhuhr: 'late' } })
    seedLoggedAt({ [PAST]: { fajr: AT(PAST, '02:12'), dhuhr: AT('2026-10-10', '18:03') } })
    renderPanel(PAST)

    expect(prayerRow('الفجر')).toHaveTextContent('سُجِّلت الساعة ٥:١٢ ص')
    expect(prayerRow('الظهر')).toHaveTextContent('سُجِّلت يوم ١٠ أكتوبر الساعة ٩:٠٣ م')
  })
})

describe('the sunnah prayers', () => {
  const group = () => screen.getByRole('group', { name: 'Sunnah prayers, Friday, October 9' })

  it('are all there, as toggles grouped under the day', () => {
    renderPanel(PAST)
    const toggles = within(group()).getAllByRole('button')
    expect(toggles.map((toggle) => toggle.textContent)).toEqual([
      '2 before Fajr',
      'Duha',
      '4 before Dhuhr',
      '2 after Dhuhr',
      '2 after Maghrib',
      '2 after Isha',
      'Night prayer',
      'Witr',
    ])
    for (const toggle of toggles) expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 of 8')).toBeInTheDocument()
  })

  it('are ticked off for the day on show, with the rak’ahs of the rawatib and the time of each', async () => {
    seedSunnah({ [PAST]: { beforeFajr: AT(PAST, '01:40'), beforeDhuhr: AT(PAST, '08:50') } })
    const user = userEvent.setup()
    renderPanel(PAST)

    expect(screen.getByText('2 of 8')).toBeInTheDocument()
    expect(screen.getByText('Rawatib: 6 of 12 rak’ahs')).toBeInTheDocument()
    const times = () =>
      within(screen.getByRole('heading', { level: 4, name: 'Logged' }).parentElement!)
        .getAllByRole('listitem')
        .map((item) => plain(item.textContent))
    expect(times()).toEqual(['2 before Fajr: 4:40 AM', '4 before Dhuhr: 11:50 AM'])

    await user.click(within(group()).getByRole('button', { name: 'Witr' }))
    expect(usePrayerLog.getState().sunnah[PAST]).toEqual({
      beforeFajr: AT(PAST, '01:40'),
      beforeDhuhr: AT(PAST, '08:50'),
      witr: AT(TODAY, '12:00'),
    })
    expect(within(group()).getByRole('button', { name: 'Witr' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('3 of 8')).toBeInTheDocument()
    // Ticked off two days later, so the day is given with the time.
    expect(times()).toContain('Witr: Oct 11, 3:00 PM')
  })

  it('are named in Arabic', () => {
    setLanguage('ar')
    seedSunnah({ [PAST]: { witr: AT(PAST, '19:00') } })
    renderPanel(PAST)

    const chips = screen.getByRole('group', { name: 'السنن والنوافل، الجمعة، ٩ أكتوبر' })
    expect(within(chips).getByRole('button', { name: 'الوتر' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('السنن الرواتب: ٠ من ١٢ ركعة')).toBeInTheDocument()
    expect(screen.getByText('١ من ٨')).toBeInTheDocument()
  })
})

describe('the azkar sessions', () => {
  const morning: SessionRecord = {
    startedAt: AT(PAST, '05:00'),
    lastAt: AT(PAST, '05:20'),
    completedAt: AT(PAST, '05:20'),
    completed: true,
    done: 3,
    total: 3,
    recitations: 40,
  }
  const evening: SessionRecord = {
    startedAt: AT(PAST, '15:10'),
    lastAt: AT(PAST, '15:16'),
    completed: false,
    done: 1,
    total: 3,
    recitations: 7,
  }

  it('show how far each got, when it was begun and finished, and the repetitions counted', () => {
    seedSessions({ [PAST]: { morning, evening } })
    renderPanel(PAST)

    expect(session('Morning azkar')).toHaveTextContent('Completed')
    expect(session('Morning azkar')).toHaveTextContent('3 of 3 done')
    expect(facts('Morning azkar')).toEqual(['Started 8:00 AM', 'Finished 8:20 AM', 'Recitations 40'])

    expect(session('Evening azkar')).toHaveTextContent('In progress')
    expect(session('Evening azkar')).toHaveTextContent('1 of 3 done')
    expect(facts('Evening azkar')).toEqual(['Started 6:10 PM', 'Last count 6:16 PM', 'Recitations 7'])
  })

  it('say when a session was not read, and list bedtime azkar only on a day they were read', () => {
    const { unmount } = renderPanel(PAST)
    expect(session('Morning azkar')).toHaveTextContent('Not read')
    expect(facts('Morning azkar')).toEqual([])
    expect(screen.queryByRole('heading', { name: 'Before sleep' })).not.toBeInTheDocument()
    unmount()

    seedSessions({ [PAST]: { sleep: { ...morning, startedAt: AT(PAST, '19:30'), completedAt: AT(PAST, '19:40') } } })
    renderPanel(PAST)
    expect(facts('Before sleep')).toEqual(['Started 10:30 PM', 'Finished 10:40 PM', 'Recitations 40'])
  })

  it('list a session that was recorded even when the app no longer offers it, with no way into it', () => {
    seedSessions({ [TODAY]: { sleep: { ...morning, startedAt: AT(TODAY, '19:30'), completedAt: AT(TODAY, '19:40') } } })
    renderPanel(TODAY)
    expect(session('Before sleep')).toHaveTextContent('Completed')
    expect(screen.queryByRole('link', { name: /Before sleep/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start: Morning azkar' })).toBeInTheDocument()
  })

  it('give the day as well when the evening azkar were finished after midnight', () => {
    seedSessions({ [PAST]: { evening: { ...morning, startedAt: AT(PAST, '20:50'), completedAt: AT(PAST, '21:40') } } })
    renderPanel(PAST)
    expect(facts('Evening azkar')).toEqual(['Started 11:50 PM', 'Finished Oct 10, 12:40 AM', 'Recitations 40'])
  })

  it('never make up a time for a completion carried over from the first version of the store', () => {
    seedSessions({ [PAST]: { morning: { completed: true, done: 3, total: 3, recitations: 0 } } })
    renderPanel(PAST)
    expect(session('Morning azkar')).toHaveTextContent('Completed')
    expect(facts('Morning azkar')).toEqual(['Finished Time not recorded'])
  })

  it('show a second reading begun after "Start over" beside the completion', () => {
    seedSessions({ [PAST]: { morning: { ...morning, done: 1, recitations: 45 } } })
    renderPanel(PAST)
    expect(session('Morning azkar')).toHaveTextContent('Completed')
    expect(session('Morning azkar')).toHaveTextContent('Reading again: 1 of 3')
  })

  it('give the last count when it came after the completion, as in a second reading', () => {
    seedSessions({
      [PAST]: {
        morning: { ...morning, done: 1, lastAt: AT(PAST, '09:45'), recitations: 45 },
        // Carried over from the first version, then counted again that day: no start or finish time, but a last count.
        evening: { lastAt: AT(PAST, '15:30'), completed: true, done: 3, total: 3, recitations: 2 },
      },
    })
    renderPanel(PAST)
    expect(facts('Morning azkar')).toEqual(['Started 8:00 AM', 'Finished 8:20 AM', 'Last count 12:45 PM', 'Recitations 45'])
    expect(facts('Evening azkar')).toEqual(['Finished Time not recorded', 'Last count 6:30 PM', 'Recitations 2'])
  })

  it('lead into today’s sessions, and only today’s', async () => {
    seedSessions({ [PAST]: { morning }, [TODAY]: { morning: { ...morning, startedAt: AT(TODAY, '05:00') }, evening } })
    const user = userEvent.setup()
    const { unmount } = renderPanel(PAST)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    unmount()

    renderPanel(TODAY)
    expect(screen.getByRole('link', { name: 'Read again: Morning azkar' })).toHaveAttribute('href', '/azkar/morning')
    const next = screen.getByRole('link', { name: 'Continue: Evening azkar' })
    expect(next).toHaveTextContent(/^Continue$/)
    await user.click(next)
    expect(screen.getByRole('heading', { level: 1, name: 'Reader' })).toBeInTheDocument()
  })

  it('offer to start a session not begun yet', () => {
    renderPanel(TODAY)
    expect(screen.getByRole('link', { name: 'Start: Morning azkar' })).toHaveAttribute('href', '/azkar/morning')
    expect(screen.getByRole('link', { name: 'Start: Evening azkar' })).toHaveAttribute('href', '/azkar/evening')
  })

  it('leave the evening open on last night’s day until Fajr', () => {
    // 1 am in Riyadh: the evening session still belongs to the 10th.
    vi.setSystemTime(new Date('2026-10-10T22:00:00Z'))
    const { unmount } = renderPanel(TODAY)
    expect(screen.getByRole('link', { name: 'Start: Morning azkar' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Evening azkar/ })).not.toBeInTheDocument()
    unmount()

    renderPanel('2026-10-10')
    expect(screen.getByRole('link', { name: 'Start: Evening azkar' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Morning azkar/ })).not.toBeInTheDocument()
  })

  it('are written in Arabic, with Arabic digits', () => {
    setLanguage('ar')
    seedSessions({ [TODAY]: { evening: { ...evening, startedAt: AT(TODAY, '15:10'), lastAt: AT(TODAY, '15:16') } } })
    renderPanel(TODAY)

    expect(screen.getByRole('heading', { level: 3, name: 'الأذكار' })).toBeInTheDocument()
    expect(session('أذكار المساء')).toHaveTextContent('لم تكتمل بعد')
    expect(session('أذكار المساء')).toHaveTextContent('اكتمل ١ من ٣')
    expect(facts('أذكار المساء')).toEqual(['البدء ٦:١٠ م', 'آخر عدّ ٦:١٦ م', 'مرات الذكر ٧'])
    expect(screen.getByRole('link', { name: 'متابعة: أذكار المساء' })).toBeInTheDocument()
    expect(session('أذكار الصباح')).toHaveTextContent('لم تُقرأ')
  })
})
