import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../../shared/settings'
import { useAzkarProgress } from '../progressStore'
import { useAzkarSettings } from '../settingsStore'
import { hamd, takbir, tasbih } from '../testing/fixture'
import { renderRoute, resetStores } from '../testing/harness'
import { ADVANCE_DELAY_MS, SETTLE_MS } from './Reader'

vi.mock('../data', async () => (await import('../testing/fixture')).createDataModule())
vi.mock('../../prayer-times', () => ({ usePrayerDay: () => null }))

// The fixture's morning session: tasbih ×3, hamd ×1, takbir ×10. Evening: hamd ×1, tasbih ×3.
const DAY = '2026-10-12'
const MORNING = new Date(`${DAY}T08:00:00Z`)

const vibrate = vi.fn(() => true)

const progress = () => useAzkarProgress.getState()
const morningCounts = (dateKey = DAY) => progress().days[dateKey]?.morning
const counter = () => screen.getByRole('button', { name: /^(Tap to count|Done\.)/ })
const liveRegion = () => screen.getByRole('status')
const path = () => screen.getByTestId('path').textContent

function tap(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(counter())
}

function pass(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** Long enough for the reader to move on and accept taps again. */
function settle() {
  pass(ADVANCE_DELAY_MS + SETTLE_MS)
}

function reduceMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MORNING)
  resetStores()
  vibrate.mockClear()
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('routing', () => {
  it('shows the first dhikr of the session', () => {
    renderRoute('/azkar/morning')
    expect(screen.getByRole('heading', { level: 1, name: 'Morning azkar' })).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    const arabic = screen.getByText(tasbih.arabic)
    expect(arabic).toHaveAttribute('lang', 'ar')
    expect(arabic).toHaveAttribute('dir', 'rtl')
    expect(arabic).toHaveClass('recitation')
  })

  it('sends an unknown session back to the picker', () => {
    renderRoute('/azkar/midnight')
    expect(path()).toBe('/azkar')
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar' })).toBeInTheDocument()
  })

  it('sends a session the dataset does not provide back to the picker', () => {
    renderRoute('/azkar/sleep')
    expect(path()).toBe('/azkar')
  })

  it('sends deeper paths back to the picker', () => {
    renderRoute('/azkar/morning/extra')
    expect(path()).toBe('/azkar')
  })
})

describe('counting', () => {
  it('counts one repetition per tap and shows done over total', () => {
    renderRoute('/azkar/morning')
    expect(counter()).toHaveTextContent('0 / 3')
    tap()
    expect(counter()).toHaveTextContent('1 / 3')
    tap()
    expect(counter()).toHaveTextContent('2 / 3')
    expect(morningCounts()).toEqual({ tasbih: 2 })
  })

  it('gives a light haptic tick per tap and a stronger one on reaching the count', () => {
    renderRoute('/azkar/morning')
    tap(2)
    expect(vibrate).toHaveBeenCalledTimes(2)
    const tick = vibrate.mock.calls[0]
    tap()
    expect(vibrate).toHaveBeenCalledTimes(3)
    expect(vibrate.mock.calls[2]).not.toEqual(tick)
  })

  it('stays silent when haptics are off', () => {
    useAzkarSettings.getState().update({ haptics: false })
    renderRoute('/azkar/morning')
    tap(3)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('takes back an accidental tap', () => {
    renderRoute('/azkar/morning')
    const undo = screen.getByRole('button', { name: 'Undo one count' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')

    tap(2)
    expect(undo).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(undo)
    expect(counter()).toHaveTextContent('1 / 3')
    expect(morningCounts()).toEqual({ tasbih: 1 })

    fireEvent.click(undo)
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    expect(morningCounts()).toBeUndefined()
  })

  it('keeps keyboard focus on Undo when the count is back at zero, and ignores further presses', () => {
    renderRoute('/azkar/morning')
    const undo = screen.getByRole('button', { name: 'Undo one count' })
    tap()
    vibrate.mockClear()
    undo.focus()
    fireEvent.click(undo)
    expect(vibrate).toHaveBeenCalledOnce()

    // A disabled button would drop focus here, and the next Enter would land on the page and count.
    expect(undo).toBeEnabled()
    expect(undo).toHaveFocus()
    fireEvent.click(undo)
    fireEvent.keyDown(undo, { key: 'Enter' })
    expect(vibrate).toHaveBeenCalledOnce()
    expect(morningCounts()).toBeUndefined()
  })

  it('undoing the final tap cancels the move to the next dhikr', () => {
    renderRoute('/azkar/morning')
    tap(3)
    fireEvent.click(screen.getByRole('button', { name: 'Undo one count' }))
    settle()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('2 / 3')

    // No settle window is left over from the cancelled completion.
    tap()
    expect(counter()).toHaveTextContent('3 / 3')
  })

  it('offers "Mark all done" only for long counts', () => {
    renderRoute('/azkar/morning')
    expect(screen.queryByRole('button', { name: 'Mark all done' })).not.toBeInTheDocument() // ×3

    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    expect(screen.queryByRole('button', { name: 'Mark all done' })).not.toBeInTheDocument() // ×1

    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    expect(screen.getByText(takbir.arabic)).toBeInTheDocument() // ×10
    tap(2)
    fireEvent.click(screen.getByRole('button', { name: 'Mark all done' }))
    expect(morningCounts()).toEqual({ takbir: 10 })
    expect(counter()).toHaveTextContent('10 / 10')
    expect(screen.queryByRole('button', { name: 'Mark all done' })).not.toBeInTheDocument()
  })

  it('counts with Space or Enter when no control has focus, but not on key repeat', () => {
    renderRoute('/azkar/morning')
    fireEvent.keyDown(document.body, { key: ' ' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.keyDown(document.body, { key: ' ', repeat: true })
    expect(morningCounts()).toEqual({ tasbih: 2 })
  })

  it('leaves Space and Enter on a focused control to that control', () => {
    renderRoute('/azkar/morning')
    // The browser turns these into a click on the button itself; counting here too would double it.
    fireEvent.keyDown(counter(), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Undo one count' }), { key: ' ' })
    fireEvent.keyDown(screen.getByText('Virtue'), { key: ' ' })
    expect(morningCounts()).toBeUndefined()
  })

  it('leaves browser shortcuts alone', () => {
    renderRoute('/azkar/morning')
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(morningCounts()).toBeUndefined()
  })
})

describe('reaching the count', () => {
  it('shows a done state, then moves to the next dhikr after a moment', () => {
    renderRoute('/azkar/morning')
    tap(3)
    expect(counter()).toHaveAccessibleName('Done. Next dhikr')
    expect(counter()).toHaveTextContent('3 / 3')
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    pass(ADVANCE_DELAY_MS - 1)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    pass(1)
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByText(hamd.arabic)).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 1')
  })

  it('moves on immediately when the system asks for reduced motion', () => {
    reduceMotion()
    renderRoute('/azkar/morning')
    tap(3)
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('swallows extra taps from a thumb that is still counting', () => {
    renderRoute('/azkar/morning')
    tap(5) // two more than needed
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    pass(ADVANCE_DELAY_MS)
    tap() // lands just after the page turned
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(morningCounts()).toEqual({ tasbih: 3 })

    pass(SETTLE_MS)
    tap()
    expect(morningCounts()).toEqual({ tasbih: 3, hamd: 1 })
  })

  it('waits for the reader when auto-advance is off, then the counter becomes "next"', () => {
    useAzkarSettings.getState().update({ autoAdvance: false })
    renderRoute('/azkar/morning')
    tap(3)
    pass(10_000)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveAccessibleName('Done. Next dhikr')

    tap()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(morningCounts()).toEqual({ tasbih: 3 })
  })

  it('skips azkar that are already done and comes back for ones skipped earlier', () => {
    useAzkarProgress.setState({ days: { [DAY]: { morning: { hamd: 1 } } } })
    renderRoute('/azkar/morning')
    // Jump ahead to the last dhikr, leaving the first unfinished.
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark all done' }))
    settle()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    tap(3)
    settle()
    expect(screen.getByRole('heading', { name: 'Morning azkar complete' })).toBeInTheDocument()
  })
})

describe('navigation', () => {
  it('moves with the previous and next buttons and never loses counts', () => {
    renderRoute('/azkar/morning')
    const previous = screen.getByRole('button', { name: 'Previous dhikr' })
    const next = screen.getByRole('button', { name: 'Next dhikr' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveAttribute('aria-disabled', 'false')

    tap(2)
    fireEvent.click(next)
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    fireEvent.click(next)
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(previous).toHaveAttribute('aria-disabled', 'false')
    tap(4)

    fireEvent.click(previous)
    fireEvent.click(previous)
    expect(counter()).toHaveTextContent('2 / 3')
    expect(morningCounts()).toEqual({ tasbih: 2, takbir: 4 })
  })

  it('keeps keyboard focus on a navigation button at either end of the session', () => {
    renderRoute('/azkar/morning')
    const previous = screen.getByRole('button', { name: 'Previous dhikr' })
    const next = screen.getByRole('button', { name: 'Next dhikr' })

    next.focus()
    fireEvent.click(next)
    fireEvent.click(next)
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    // Not disabled: the reader keeps their place, and the button just stops responding.
    expect(next).toBeEnabled()
    expect(next).toHaveFocus()
    fireEvent.click(next)
    expect(screen.getByText('3 of 3')).toBeInTheDocument()

    previous.focus()
    fireEvent.click(previous)
    fireEvent.click(previous)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(previous).toBeEnabled()
    expect(previous).toHaveFocus()
    fireEvent.click(previous)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('goes forward with the right arrow in a left-to-right interface', () => {
    renderRoute('/azkar/morning')
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('goes forward with the left arrow in a right-to-left interface', () => {
    resetStores('ar')
    renderRoute('/azkar/morning')
    expect(screen.getByText('١ من ٣')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(screen.getByText('١ من ٣')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(screen.getByText('٢ من ٣')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(screen.getByText('١ من ٣')).toBeInTheDocument()
  })

  it('draws the undo arrow pointing back along the line, whichever way the line runs', () => {
    const undoIcon = (name: string) => screen.getByRole('button', { name }).querySelector('svg')
    const { unmount } = renderRoute('/azkar/morning')
    expect(undoIcon('Undo one count')).toHaveClass('lucide-undo-2')
    unmount()

    resetStores('ar')
    renderRoute('/azkar/morning')
    // Lucide's redo glyph is its undo glyph mirrored.
    expect(undoIcon('التراجع عن مرة واحدة')).toHaveClass('lucide-redo-2')
  })

  it('turns the page with a sideways swipe, mirrored in a right-to-left interface', () => {
    const swipe = (fromX: number, toX: number, extra: Record<string, unknown> = {}) => {
      const page = screen.getByRole('article')
      const base = { pointerType: 'touch', isPrimary: true, pointerId: 1, ...extra }
      fireEvent.pointerDown(page, { ...base, clientX: fromX, clientY: 300 })
      fireEvent.pointerUp(page, { ...base, clientX: toX, clientY: 310 })
    }

    const { unmount } = renderRoute('/azkar/morning')
    swipe(300, 150)
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    swipe(150, 300)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    swipe(300, 150, { pointerType: 'mouse' }) // dragging with a mouse selects text
    swipe(300, 280) // too short to be deliberate
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    unmount()

    resetStores('ar')
    renderRoute('/azkar/morning')
    swipe(150, 300)
    expect(screen.getByText('٢ من ٣')).toBeInTheDocument()
  })

  it('does not treat a vertical scroll as a swipe', () => {
    renderRoute('/azkar/morning')
    const page = screen.getByRole('article')
    const base = { pointerType: 'touch', isPrimary: true, pointerId: 1 }
    fireEvent.pointerDown(page, { ...base, clientX: 300, clientY: 500 })
    fireEvent.pointerUp(page, { ...base, clientX: 220, clientY: 200 })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('does not treat a slow drag as a swipe', () => {
    renderRoute('/azkar/morning')
    const page = screen.getByRole('article')
    const base = { pointerType: 'touch', isPrimary: true, pointerId: 1 }
    fireEvent.pointerDown(page, { ...base, clientX: 300, clientY: 300 })
    pass(1500)
    fireEvent.pointerUp(page, { ...base, clientX: 150, clientY: 300 })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('leaves the screen edges to the browser’s own gestures', () => {
    renderRoute('/azkar/morning')
    const page = screen.getByRole('article')
    const base = { pointerType: 'touch', isPrimary: true, pointerId: 1 }
    fireEvent.pointerDown(page, { ...base, clientX: window.innerWidth - 5, clientY: 300 })
    fireEvent.pointerUp(page, { ...base, clientX: window.innerWidth - 200, clientY: 300 })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('lists every dhikr with its state and jumps to the chosen one', () => {
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, takbir: 4 } } } })
    renderRoute('/azkar/morning')
    fireEvent.click(screen.getByRole('button', { name: 'All azkar' }))

    const rows = within(screen.getByRole('dialog')).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Done')
    expect(rows[1]).toHaveTextContent('0 / 1')
    expect(rows[2]).toHaveTextContent('4 / 10')
    expect(within(rows[1]!).getByRole('button')).toHaveAttribute('aria-current', 'true')

    fireEvent.click(within(rows[2]!).getByRole('button'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('4 / 10')
  })

  it('ignores the keyboard shortcuts while the overview is open', () => {
    renderRoute('/azkar/morning')
    fireEvent.click(screen.getByRole('button', { name: 'All azkar' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    fireEvent.keyDown(document.body, { key: ' ' })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(morningCounts()).toBeUndefined()
  })
})

describe('resume and start over', () => {
  it('reopens on the first unfinished dhikr', () => {
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, hamd: 1, takbir: 6 } } } })
    renderRoute('/azkar/morning')
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('6 / 10')
  })

  it('reopens on a dhikr that was skipped, even if later ones are done', () => {
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, takbir: 10 } } } })
    renderRoute('/azkar/morning')
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('does not resume another day’s counts', () => {
    useAzkarProgress.setState({ days: { '2026-10-11': { morning: { tasbih: 3, hamd: 1 } } } })
    renderRoute('/azkar/morning')
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 3')
  })

  it('starts over only after confirmation, and only for this session today', () => {
    useAzkarProgress.setState({
      days: {
        [DAY]: { morning: { tasbih: 3, hamd: 1 }, evening: { hamd: 1 } },
        '2026-10-11': { morning: { tasbih: 2 } },
      },
    })
    renderRoute('/azkar/morning')
    fireEvent.click(screen.getByRole('button', { name: 'All azkar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.getByRole('heading', { name: 'Start over?' })).toBeInTheDocument()
    expect(morningCounts()).toEqual({ tasbih: 3, hamd: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(morningCounts()).toEqual({ tasbih: 3, hamd: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 3')
    expect(progress().days).toEqual({
      [DAY]: { evening: { hamd: 1 } },
      '2026-10-11': { morning: { tasbih: 2 } },
    })
  })

  it('has nothing to start over before the first count', () => {
    renderRoute('/azkar/morning')
    fireEvent.click(screen.getByRole('button', { name: 'All azkar' }))
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled()
  })
})

describe('completion', () => {
  function finishMorning() {
    tap(3)
    settle()
    tap()
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all done' }))
  }

  it('ends on a calm screen and records the session', () => {
    renderRoute('/azkar/morning')
    finishMorning()
    expect(counter()).toHaveAccessibleName('Done. Finish')
    // Timed at the final count, which is now: the fake clock has moved on through the reading.
    expect(progress().sessions[DAY]?.morning).toMatchObject({ completed: true, completedAt: Date.now() })

    pass(ADVANCE_DELAY_MS)
    const heading = screen.getByRole('heading', { level: 1, name: 'Morning azkar complete' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('May Allah accept it from us and from you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tap to count|Done\./ })).not.toBeInTheDocument()
  })

  it('does not record a session that is only partly read', () => {
    renderRoute('/azkar/morning')
    tap(3)
    settle()
    tap()
    settle()
    tap(9)
    expect(progress().sessions[DAY]?.morning).toMatchObject({ completed: false, done: 2, recitations: 13 })
  })

  it('goes back to Today', () => {
    renderRoute('/azkar/morning')
    finishMorning()
    settle()
    fireEvent.click(screen.getByRole('link', { name: 'Back to Today' }))
    expect(path()).toBe('/')
  })

  it('lets the session be reviewed again without losing the completion', () => {
    renderRoute('/azkar/morning')
    finishMorning()
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'Review again' }))

    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveFocus()
    expect(counter()).toHaveAccessibleName('Done. Finish')
    expect(counter()).toHaveTextContent('3 / 3')

    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    tap()
    expect(screen.getByRole('heading', { name: 'Morning azkar complete' })).toBeInTheDocument()
    expect(progress().sessions[DAY]?.morning).toMatchObject({ completed: true })
  })

  it('shows the end screen straight away when a finished session is reopened', () => {
    useAzkarProgress.setState({ days: { [DAY]: { evening: { hamd: 1, tasbih: 3 } } } })
    renderRoute('/azkar/evening')
    expect(screen.getByRole('heading', { name: 'Evening azkar complete' })).toBeInTheDocument()
  })

  it('finishes from the counter when auto-advance is off', () => {
    useAzkarSettings.getState().update({ autoAdvance: false })
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, takbir: 10 } } } })
    renderRoute('/azkar/morning')
    tap()
    pass(SETTLE_MS)
    expect(counter()).toHaveAccessibleName('Done. Finish')
    tap()
    expect(screen.getByRole('heading', { name: 'Morning azkar complete' })).toBeInTheDocument()
  })
})

describe('day rollover', () => {
  it('starts the morning session afresh at local midnight', () => {
    vi.setSystemTime(new Date(`${DAY}T23:59:50Z`))
    renderRoute('/azkar/morning')
    tap(2)
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    expect(screen.getByText('2 of 3')).toBeInTheDocument()

    pass(30_000)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 3')

    tap()
    expect(progress().days).toEqual({
      [DAY]: { morning: { tasbih: 2 } },
      '2026-10-13': { morning: { tasbih: 1 } },
    })
  })

  it('uses the saved location’s midnight, not UTC’s', () => {
    resetStores('en', 'Asia/Tokyo') // UTC+9: already 08:00 on the 13th there at 23:00 UTC
    vi.setSystemTime(new Date(`${DAY}T23:00:00Z`))
    renderRoute('/azkar/morning')
    tap()
    expect(progress().days).toEqual({ '2026-10-13': { morning: { tasbih: 1 } } })
  })

  it('keeps the evening session going past midnight, until the night ends', () => {
    vi.setSystemTime(new Date(`${DAY}T23:59:50Z`))
    renderRoute('/azkar/evening')
    tap() // hamd ×1
    settle()
    tap() // tasbih 1 of 3
    expect(screen.getByText('2 of 2')).toBeInTheDocument()

    pass(60_000) // 00:00:50 on the 13th: still the same night
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('1 / 3')
    tap()
    expect(progress().days).toEqual({ [DAY]: { evening: { hamd: 1, tasbih: 2 } } })

    pass(4 * 60 * 60_000) // past 04:00, the stand-in for Fajr without a location's times
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 1')
  })
})

describe('session records', () => {
  it('files evening azkar read after midnight under the evening before, timed when they were read', () => {
    const oneAm = Date.parse('2026-10-13T01:00:00Z')
    vi.setSystemTime(oneAm)
    renderRoute('/azkar/evening')
    tap() // hamd ×1
    settle()
    tap(3) // tasbih ×3: the session is complete
    const finishedAt = Date.now()
    expect(progress().sessions).toEqual({
      [DAY]: {
        evening: {
          startedAt: oneAm,
          lastAt: finishedAt,
          completedAt: finishedAt,
          completed: true,
          done: 2,
          total: 2,
          recitations: 4,
        },
      },
    })
    expect(progress().totals).toEqual({ hamd: 1, tasbih: 3 })
  })

  it('files the morning azkar under the calendar day, even before dawn', () => {
    vi.setSystemTime(new Date('2026-10-13T01:00:00Z'))
    renderRoute('/azkar/morning')
    tap()
    expect(Object.keys(progress().sessions)).toEqual(['2026-10-13'])
  })

  it('keeps every repetition through "Start over", in the record and the totals', () => {
    renderRoute('/azkar/morning')
    tap(2)
    fireEvent.click(screen.getByRole('button', { name: 'All azkar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    tap()
    expect(progress().sessions[DAY]?.morning).toMatchObject({ completed: false, done: 0, recitations: 3 })
    expect(progress().totalRecitations).toBe(3)
  })
})

describe('reader settings', () => {
  it('shows transliteration and translation by default in English', () => {
    renderRoute('/azkar/morning')
    const translation = screen.getByText(tasbih.translation)
    expect(translation).toHaveAttribute('lang', 'en')
    expect(translation).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText('Subhan Allah')).toHaveAttribute('dir', 'ltr')
  })

  it('hides them by default in Arabic, until the user asks for them', () => {
    resetStores('ar')
    const { unmount } = renderRoute('/azkar/morning')
    expect(screen.queryByText(tasbih.translation)).not.toBeInTheDocument()
    expect(screen.queryByText('Subhan Allah')).not.toBeInTheDocument()
    unmount()

    useAzkarSettings.getState().update({ showTranslation: true })
    renderRoute('/azkar/morning')
    expect(screen.getByText(tasbih.translation)).toBeInTheDocument()
    expect(screen.queryByText('Subhan Allah')).not.toBeInTheDocument()
  })

  it('respects an explicit choice to hide them in English', () => {
    useAzkarSettings.getState().update({ showTranslation: false, showTransliteration: false })
    renderRoute('/azkar/morning')
    expect(screen.queryByText(tasbih.translation)).not.toBeInTheDocument()
    expect(screen.queryByText('Subhan Allah')).not.toBeInTheDocument()
  })

  it('sizes the Arabic from the chosen step', () => {
    const { unmount } = renderRoute('/azkar/morning')
    expect(screen.getByText(tasbih.arabic).style.fontSize).toBe('1.75rem')
    unmount()

    useAzkarSettings.getState().update({ arabicScale: 5 })
    renderRoute('/azkar/morning')
    expect(screen.getByText(tasbih.arabic).style.fontSize).toBe('2.375rem')
  })

  it('shows the reference and virtue in the interface language', () => {
    const { unmount } = renderRoute('/azkar/morning')
    expect(screen.getByText('Test reference one')).toBeInTheDocument()
    expect(screen.getByText('Test virtue in English')).toBeInTheDocument()
    unmount()

    useSettings.setState({ language: 'ar' })
    renderRoute('/azkar/morning')
    expect(screen.getByText('مرجع تجريبي أول')).toBeInTheDocument()
    expect(screen.getByText('فضل تجريبي بالعربية')).toBeInTheDocument()
    expect(screen.queryByText('Test virtue in English')).not.toBeInTheDocument()
  })

  it('keeps the virtue collapsed until asked, and omits it when there is none', () => {
    renderRoute('/azkar/morning')
    expect(screen.getByText('Virtue').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    expect(screen.queryByText('Virtue')).not.toBeInTheDocument()
  })
})

describe('screen readers', () => {
  it('names the counter with the repetitions that remain', () => {
    renderRoute('/azkar/morning')
    expect(counter()).toHaveAccessibleName('Tap to count: 3 repetitions left')
    tap(2)
    expect(counter()).toHaveAccessibleName('Tap to count: 1 repetition left')
  })

  it('uses the Arabic plural forms', () => {
    resetStores('ar')
    renderRoute('/azkar/morning')
    const arabicCounter = () => screen.getByRole('button', { name: /^اضغط للعدّ/ })
    expect(arabicCounter()).toHaveAccessibleName('اضغط للعدّ: بقيت ٣ مرات')
    fireEvent.click(arabicCounter())
    expect(arabicCounter()).toHaveAccessibleName('اضغط للعدّ: بقيت مرتان')
    fireEvent.click(arabicCounter())
    expect(arabicCounter()).toHaveAccessibleName('اضغط للعدّ: بقيت مرة واحدة')
  })

  it('announces a completed dhikr once, and never the individual taps', () => {
    renderRoute('/azkar/morning')
    expect(liveRegion()).toBeEmptyDOMElement()
    tap(2)
    expect(liveRegion()).toBeEmptyDOMElement()
    tap()
    expect(liveRegion()).toHaveTextContent('Dhikr 1 of 3 completed')

    settle()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Dhikr 1 of 3 completed')
    tap()
    expect(liveRegion()).toHaveTextContent('Dhikr 2 of 3 completed')
  })

  it('announces again when a completion is undone and redone', () => {
    useAzkarSettings.getState().update({ autoAdvance: false })
    renderRoute('/azkar/morning')
    tap(3)
    fireEvent.click(screen.getByRole('button', { name: 'Undo one count' }))
    expect(liveRegion()).toBeEmptyDOMElement()
    tap()
    expect(liveRegion()).toHaveTextContent('Dhikr 1 of 3 completed')
  })
})

describe('screen wake lock', () => {
  function installWakeLock() {
    const sentinels: Array<{ release: ReturnType<typeof vi.fn>; fireRelease: () => void }> = []
    const request = vi.fn(() => {
      let onRelease = () => {}
      const sentinel = {
        release: vi.fn(() => Promise.resolve()),
        addEventListener: (_type: string, listener: () => void) => {
          onRelease = listener
        },
        fireRelease: () => onRelease(),
      }
      sentinels.push(sentinel)
      return Promise.resolve(sentinel)
    })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    return { request, sentinels }
  }

  const flush = () => act(async () => {})

  it('holds the screen awake while reading and lets go on leaving', async () => {
    const { request, sentinels } = installWakeLock()
    const { unmount } = renderRoute('/azkar/morning')
    await flush()
    expect(request).toHaveBeenCalledExactlyOnceWith('screen')

    unmount()
    expect(sentinels[0]!.release).toHaveBeenCalledOnce()
  })

  it('takes the lock again when the page becomes visible after the browser dropped it', async () => {
    const { request, sentinels } = installWakeLock()
    renderRoute('/azkar/morning')
    await flush()

    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    sentinels[0]!.fireRelease()
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(request).toHaveBeenCalledOnce()

    visibility = 'visible'
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(request).toHaveBeenCalledTimes(2)

    // Still held: coming back again must not stack a second lock.
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not ask when the setting is off', async () => {
    const { request } = installWakeLock()
    useAzkarSettings.getState().update({ keepAwake: false })
    renderRoute('/azkar/morning')
    await flush()
    expect(request).not.toHaveBeenCalled()
  })

  it('carries on reading when the lock is refused', async () => {
    const request = vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    renderRoute('/azkar/morning')
    await flush()
    tap()
    expect(counter()).toHaveTextContent('1 / 3')
  })

  it('releases the lock on the end screen', async () => {
    const { sentinels } = installWakeLock()
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, takbir: 10 } } } })
    renderRoute('/azkar/morning')
    await flush()
    tap()
    pass(ADVANCE_DELAY_MS)
    expect(screen.getByRole('heading', { name: 'Morning azkar complete' })).toBeInTheDocument()
    expect(sentinels[0]!.release).toHaveBeenCalledOnce()
  })
})
