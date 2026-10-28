import { describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import type { CollectionId } from './data'
import type { DaySessions, SessionRecord } from './progressData'
import { snippet } from './reader/text'
import { hamd, takbir, tasbih } from './testing/fixture'
import {
  azkarCompletionRate,
  computeAzkarStreaks,
  lifetimeTotals,
  ratePercent,
  sessionsInRange,
} from './tracking'
import type { SessionHistory } from './tracking'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

const TODAY = '2026-10-12'
const day = (offset: number): DateKey => shiftDateKey(TODAY, offset)

const finished: SessionRecord = { completed: true, done: 3, total: 3, recitations: 14 }
const begun: SessionRecord = { completed: false, done: 1, total: 3, recitations: 3 }

/**
 * Builds a history from a compact description: `{ [-1]: 'me' }` is yesterday with the
 * morning (m) and evening (e) completed; an upper-case letter is a session begun but not
 * finished.
 */
function history(description: Record<number, string>): SessionHistory {
  const sessions: SessionHistory = {}
  for (const [offset, letters] of Object.entries(description)) {
    const entry: DaySessions = {}
    for (const letter of letters) {
      const collection: CollectionId = letter.toLowerCase() === 'm' ? 'morning' : 'evening'
      entry[collection] = letter === letter.toLowerCase() ? finished : begun
    }
    sessions[day(Number(offset))] = entry
  }
  return sessions
}

describe('streaks', () => {
  const daytime = (sessions: SessionHistory) => computeAzkarStreaks(sessions, TODAY, 'morning')

  it('is nothing at all for a new user', () => {
    expect(daytime({})).toEqual({
      morning: { current: 0, best: 0 },
      evening: { current: 0, best: 0 },
      both: { current: 0, best: 0 },
    })
  })

  it('does not hold today against the user while it can still be read', () => {
    const sessions = history({ [-3]: 'me', [-2]: 'me', [-1]: 'me' })
    expect(daytime(sessions).morning).toEqual({ current: 3, best: 3 })
    // A session begun today but not finished does not break it either.
    expect(daytime({ ...sessions, [TODAY]: { morning: begun } }).morning).toEqual({ current: 3, best: 3 })
  })

  it('adds today once it is completed', () => {
    const streaks = daytime(history({ [-2]: 'm', [-1]: 'm', 0: 'm' }))
    expect(streaks.morning).toEqual({ current: 3, best: 3 })
  })

  it('ends at a day with nothing read, and at a day begun but not finished', () => {
    expect(daytime(history({ [-5]: 'm', [-4]: 'm', [-2]: 'm', [-1]: 'm' })).morning).toEqual({ current: 2, best: 2 })
    expect(daytime(history({ [-4]: 'm', [-3]: 'm', [-2]: 'm', [-1]: 'M' })).morning).toEqual({ current: 0, best: 3 })
  })

  it('remembers the best run long after it ended', () => {
    const sessions = history({ [-40]: 'm', [-39]: 'm', [-38]: 'm', [-37]: 'm', [-2]: 'm', 0: 'm' })
    expect(daytime(sessions).morning).toEqual({ current: 1, best: 4 })
  })

  it('counts runs across the end of a month and of a year', () => {
    const sessions: SessionHistory = {
      '2026-12-30': { morning: finished },
      '2026-12-31': { morning: finished },
      '2027-01-01': { morning: finished },
    }
    expect(computeAzkarStreaks(sessions, '2027-01-01', 'evening').morning).toEqual({ current: 3, best: 3 })
  })

  it('follows each session on its own', () => {
    const streaks = daytime(history({ [-3]: 'me', [-2]: 'm', [-1]: 'me' }))
    expect(streaks.morning).toEqual({ current: 3, best: 3 })
    expect(streaks.evening).toEqual({ current: 1, best: 1 })
  })

  it('counts days with both sessions for the combined streak', () => {
    const streaks = daytime(history({ [-4]: 'me', [-3]: 'me', [-2]: 'm', [-1]: 'me', 0: 'm' }))
    expect(streaks.both).toEqual({ current: 1, best: 2 })
    // Today's morning alone does not add to it, and its evening is still to come.
    expect(streaks.morning.current).toBe(5)
  })

  it('counts records carried over from version 1, which have no times', () => {
    const migrated = { completed: true, done: 3, total: 3, recitations: 0 }
    const sessions: SessionHistory = { [day(-2)]: { evening: migrated }, [day(-1)]: { evening: migrated } }
    expect(daytime(sessions).evening).toEqual({ current: 2, best: 2 })
  })

  it('ignores records dated after today, as from a clock that was wrong', () => {
    const sessions = history({ [-1]: 'me', 1: 'me', 2: 'me' })
    expect(daytime(sessions)).toEqual({
      morning: { current: 1, best: 1 },
      evening: { current: 1, best: 1 },
      both: { current: 1, best: 1 },
    })
  })

  it('is nothing at all for a malformed today, rather than an error', () => {
    const none = { current: 0, best: 0 }
    expect(computeAzkarStreaks(history({ [-1]: 'me' }), 'today', 'morning')).toEqual({
      morning: none,
      evening: none,
      both: none,
    })
    expect(azkarCompletionRate(history({ [-1]: 'me' }), '2026-02-30', 'morning', 7).all.rate).toBeNull()
  })

  it('handles a run of years', () => {
    const sessions: SessionHistory = {}
    for (let offset = -800; offset <= 0; offset++) sessions[day(offset)] = { morning: finished }
    expect(daytime(sessions).morning).toEqual({ current: 801, best: 801 })
  })

  describe('before dawn, while last night is still open', () => {
    const night = (sessions: SessionHistory) => computeAzkarStreaks(sessions, TODAY, 'beforeDawn')

    it('keeps the evening run going until Fajr, though the calendar day has turned', () => {
      // At 1 am yesterday's evening can still be read: it is the session open now.
      const sessions = history({ [-3]: 'e', [-2]: 'e' })
      expect(night(sessions).evening).toEqual({ current: 2, best: 2 })
      // By daylight it is over, and the run with it.
      expect(daytime(sessions).evening).toEqual({ current: 0, best: 2 })
    })

    it('adds last night once its evening is read after midnight', () => {
      // Evening azkar read at 1 am are filed under the evening before.
      expect(night(history({ [-2]: 'e', [-1]: 'e' })).evening).toEqual({ current: 2, best: 2 })
    })

    it('does not count an evening of the new day that has not begun', () => {
      expect(night(history({ [-1]: 'e', 0: 'e' })).evening).toEqual({ current: 1, best: 1 })
    })

    it('leaves the morning run to the calendar day', () => {
      expect(night(history({ [-2]: 'm', [-1]: 'm' })).morning).toEqual({ current: 2, best: 2 })
    })

    it('keeps the combined run open across both open sessions', () => {
      // Yesterday's morning is done and its evening still open; today's morning is yet to come.
      const sessions = history({ [-3]: 'me', [-2]: 'me', [-1]: 'm' })
      expect(night(sessions).both).toEqual({ current: 2, best: 2 })
      expect(night({ ...sessions, [day(-1)]: { morning: finished, evening: finished } }).both).toEqual({
        current: 3,
        best: 3,
      })
    })

    it('ends the combined run at yesterday when its morning was missed, though its evening is still open', () => {
      // Yesterday can no longer be a day with both sessions, whatever is read before Fajr.
      expect(night(history({ [-3]: 'me', [-2]: 'me' })).both).toEqual({ current: 0, best: 2 })
      expect(night(history({ [-3]: 'me', [-2]: 'me', [-1]: 'M' })).both).toEqual({ current: 0, best: 2 })
      // Reading last night's evening now does not mend it either.
      expect(night(history({ [-3]: 'me', [-2]: 'me', [-1]: 'e' })).both).toEqual({ current: 0, best: 2 })
    })

    it('does not count a combined day whose evening is dated after the evening open now', () => {
      // Before dawn the open evening is yesterday's; an evening record for today is from a wrong clock.
      expect(night(history({ [-1]: 'me', 0: 'me' })).both).toEqual({ current: 1, best: 1 })
    })
  })
})

describe('completion rate', () => {
  const rate = (sessions: SessionHistory, days: number) => azkarCompletionRate(sessions, TODAY, 'morning', days)

  it('has nothing to measure for a new user', () => {
    expect(rate({}, 7)).toEqual({
      all: { completed: 0, due: 0, rate: null },
      morning: { completed: 0, due: 0, rate: null },
      evening: { completed: 0, due: 0, rate: null },
    })
    expect(ratePercent(rate({}, 7).all)).toBeNull()
  })

  it('measures from the first day anything was read, not from an empty week', () => {
    const result = rate(history({ [-2]: 'm', [-1]: 'me' }), 7)
    expect(result.morning).toEqual({ completed: 2, due: 2, rate: 1 })
    expect(result.evening).toEqual({ completed: 1, due: 2, rate: 0.5 })
    expect(result.all).toEqual({ completed: 3, due: 4, rate: 0.75 })
  })

  it('counts a closed session that was not finished, or not read at all, as due', () => {
    const result = rate(history({ [-5]: 'me', [-3]: 'Me' }), 7)
    // Days -5 to -1, both sessions: 10 due, three completed.
    expect(result.all).toEqual({ completed: 3, due: 10, rate: 0.3 })
  })

  it('counts today’s sessions only once they are completed', () => {
    expect(rate(history({ [-1]: 'me', 0: 'M' }), 7).all).toEqual({ completed: 2, due: 2, rate: 1 })
    expect(rate(history({ [-1]: 'me', 0: 'm' }), 7).all).toEqual({ completed: 3, due: 3, rate: 1 })
  })

  it('keeps last night’s evening open before dawn, and the new day’s evening out', () => {
    const sessions = history({ [-2]: 'me', [-1]: 'm' })
    expect(azkarCompletionRate(sessions, TODAY, 'beforeDawn', 7).evening).toEqual({ completed: 1, due: 1, rate: 1 })
    // At daylight the evening of yesterday is over and was missed.
    expect(azkarCompletionRate(sessions, TODAY, 'morning', 7).evening).toEqual({ completed: 1, due: 2, rate: 0.5 })
  })

  it('looks only at the window asked for', () => {
    const sessions = history({ [-20]: 'me', [-10]: 'me', [-1]: 'me' })
    expect(rate(sessions, 7).all).toEqual({ completed: 2, due: 12, rate: 2 / 12 })
    expect(rate(sessions, 30).all).toEqual({ completed: 6, due: 40, rate: 6 / 40 })
  })

  it('ignores bedtime azkar and records from the future', () => {
    const sessions: SessionHistory = { [day(-1)]: { sleep: finished }, [day(3)]: { morning: finished } }
    expect(rate(sessions, 7).all).toEqual({ completed: 0, due: 0, rate: null })
  })

  it('rounds a percentage down, so 100% means nothing was missed', () => {
    expect(ratePercent({ completed: 199, due: 200, rate: 0.995 })).toBe(99)
    expect(ratePercent({ completed: 2, due: 2, rate: 1 })).toBe(100)
  })
})

describe('sessions in a range', () => {
  const sessions = history({ [-10]: 'm', [-3]: 'Me', [-1]: 'e', 0: 'M' })

  it('lists the days with records, oldest first, both ends included', () => {
    expect(sessionsInRange(sessions, day(-3), TODAY)).toEqual([
      { dateKey: day(-3), sessions: { morning: begun, evening: finished } },
      { dateKey: day(-1), sessions: { evening: finished } },
      { dateKey: TODAY, sessions: { morning: begun } },
    ])
    expect(sessionsInRange(sessions, day(-10), day(-10))).toHaveLength(1)
  })

  it('is empty for a range with nothing in it, an inverted range or a malformed date', () => {
    expect(sessionsInRange(sessions, day(-9), day(-4))).toEqual([])
    expect(sessionsInRange(sessions, TODAY, day(-3))).toEqual([])
    expect(sessionsInRange(sessions, 'last week', TODAY)).toEqual([])
  })
})

describe('lifetime totals', () => {
  it('counts completed sessions per collection, and every repetition per dhikr', () => {
    const lifetime = lifetimeTotals({
      sessions: {
        ...history({ [-400]: 'me', [-2]: 'mE', [-1]: 'm' }),
        [day(-1)]: { morning: finished, sleep: finished },
      },
      totals: { tasbih: 40, takbir: 120, hamd: 40, retired: 7 },
      totalRecitations: 207,
    })
    expect(lifetime.sessionsCompleted).toEqual({ morning: 3, evening: 1, sleep: 1 })
    expect(lifetime.recitations).toBe(207)
    expect(lifetime.byDhikr).toEqual([
      { id: 'takbir', recitations: 120, snippet: snippet(takbir.arabic) },
      { id: 'hamd', recitations: 40, snippet: snippet(hamd.arabic) },
      { id: 'tasbih', recitations: 40, snippet: snippet(tasbih.arabic) },
      // No longer in the dataset: still counted, with nothing to show of its text.
      { id: 'retired', recitations: 7, snippet: null },
    ])
  })

  it('is all zeros for a new user', () => {
    expect(lifetimeTotals({ sessions: {}, totals: {}, totalRecitations: 0 })).toEqual({
      sessionsCompleted: { morning: 0, evening: 0, sleep: 0 },
      recitations: 0,
      byDhikr: [],
    })
  })
})
