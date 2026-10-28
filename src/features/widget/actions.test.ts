import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetAction } from '../../native'
import { useLocationStore } from '../../shared/location'
import { usePrayerLog } from '../prayer-log'
import { applyWidgetActions } from './actions'

// Times are UTC; the location is left unset, so "today" is the device's day (UTC in the tests' clock).
const NOW = Date.parse('2026-10-12T18:00:00Z')
const AT = (clock: string) => Date.parse(`2026-10-12T${clock}Z`)

let counter = 0
function tap(patch: Partial<WidgetAction> = {}): WidgetAction {
  counter++
  return { id: `tap-${counter}`, date: '2026-10-12', prayer: 'asr', status: 'ontime', at: AT('13:05'), ...patch }
}

const log = () => usePrayerLog.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('TZ', 'UTC')
  useLocationStore.setState({ location: null })
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('applyWidgetActions', () => {
  it('logs the prayer with the moment it was tapped, not the moment the app saw it', () => {
    expect(applyWidgetActions([tap()])).toBe(1)
    expect(log().entries).toEqual({ '2026-10-12': { asr: 'ontime' } })
    expect(log().loggedAt).toEqual({ '2026-10-12': { asr: AT('13:05') } })
  })

  it('keeps the rest of the day as it was', () => {
    log().setStatus('2026-10-12', 'fajr', 'jamaah')
    const fajrAt = log().loggedAt['2026-10-12']?.fajr
    applyWidgetActions([tap({ prayer: 'dhuhr', at: AT('10:00') }), tap({ prayer: 'asr', at: AT('13:05') })])
    expect(log().entries['2026-10-12']).toEqual({ fajr: 'jamaah', dhuhr: 'ontime', asr: 'ontime' })
    expect(log().loggedAt['2026-10-12']).toEqual({ fajr: fajrAt, dhuhr: AT('10:00'), asr: AT('13:05') })
  })

  it('stores the record, so it survives a restart', () => {
    applyWidgetActions([tap()])
    const stored = JSON.parse(localStorage.getItem('azkar:prayer-log') ?? '{}')
    expect(stored.state.entries).toEqual({ '2026-10-12': { asr: 'ontime' } })
    expect(stored.state.loggedAt).toEqual({ '2026-10-12': { asr: AT('13:05') } })
  })

  it('keeps a status set in the app after the tap', () => {
    vi.setSystemTime(AT('14:00'))
    log().setStatus('2026-10-12', 'asr', 'jamaah')
    vi.setSystemTime(NOW)
    expect(applyWidgetActions([tap({ at: AT('13:05') })])).toBe(0)
    expect(log().entries['2026-10-12']).toEqual({ asr: 'jamaah' })
    expect(log().loggedAt['2026-10-12']?.asr).toBe(AT('14:00'))
  })

  it('replaces a status set in the app before the tap', () => {
    vi.setSystemTime(AT('12:00'))
    log().setStatus('2026-10-12', 'asr', 'missed')
    vi.setSystemTime(NOW)
    expect(applyWidgetActions([tap({ at: AT('13:05') })])).toBe(1)
    expect(log().entries['2026-10-12']).toEqual({ asr: 'ontime' })
    expect(log().loggedAt['2026-10-12']?.asr).toBe(AT('13:05'))
  })

  it('replaces a status logged before times were kept', () => {
    usePrayerLog.setState({ entries: { '2026-10-12': { asr: 'missed' } }, loggedAt: {} })
    expect(applyWidgetActions([tap()])).toBe(1)
    expect(log().entries['2026-10-12']).toEqual({ asr: 'ontime' })
  })

  it('keeps the earlier time of a prayer that already has the same status', () => {
    vi.setSystemTime(AT('12:00'))
    log().setStatus('2026-10-12', 'asr', 'ontime')
    vi.setSystemTime(NOW)
    expect(applyWidgetActions([tap({ at: AT('13:05') })])).toBe(0)
    expect(log().loggedAt['2026-10-12']?.asr).toBe(AT('12:00'))
  })

  it('records a prayer tapped twice once, at the first tap', () => {
    expect(applyWidgetActions([tap({ at: AT('13:10') }), tap({ at: AT('13:05') })])).toBe(1)
    expect(log().loggedAt['2026-10-12']?.asr).toBe(AT('13:05'))
  })

  it('never stamps a prayer in the future', () => {
    applyWidgetActions([tap({ at: NOW + 3_600_000 })])
    expect(log().loggedAt['2026-10-12']?.asr).toBe(NOW)
  })

  it('skips anything the log cannot hold', () => {
    const recorded = applyWidgetActions([
      tap({ date: '2026-02-30' }),
      tap({ date: 'today' }),
      tap({ prayer: 'sunrise' }),
      tap({ prayer: 'witr' }),
      tap({ status: 'prayed' }),
      tap({ at: 0 }),
      tap({ at: Number.NaN }),
      // A day that has not begun yet.
      tap({ date: '2026-10-13' }),
    ])
    expect(recorded).toBe(0)
    expect(log().entries).toEqual({})
    expect(log().loggedAt).toEqual({})
  })
})
