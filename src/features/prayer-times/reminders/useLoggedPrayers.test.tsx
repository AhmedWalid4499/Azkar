import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogEntries } from '../../prayer-log'
import { usePrayerLog } from '../../prayer-log/store'
import { CAIRO, resetStores, zonedInstant } from '../test-helpers'
import { loggedSignature, useLoggedPrayers } from './useLoggedPrayers'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(zonedInstant('2026-10-12', '15:58:30', 'Africa/Cairo'))
  resetStores({ location: CAIRO })
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loggedSignature', () => {
  const entries: LogEntries = {
    '2026-10-10': { fajr: 'ontime' },
    '2026-10-11': { isha: 'late' },
    '2026-10-12': { fajr: 'missed', dhuhr: 'excused', asr: 'jamaah' },
    '2026-10-20': { fajr: 'ontime' },
  }

  it('lists every prayer logged in the range, whatever its status, and nothing outside it', () => {
    expect(loggedSignature(entries, '2026-10-11', '2026-10-19')).toBe('2026-10-11-isha 2026-10-12-fajr 2026-10-12-dhuhr 2026-10-12-asr')
    expect(loggedSignature({}, '2026-10-11', '2026-10-19')).toBe('')
  })

  it('stays the same when a status only changes into another', () => {
    const changed = { ...entries, '2026-10-12': { ...entries['2026-10-12'], asr: 'ontime' as const } }
    expect(loggedSignature(changed, '2026-10-11', '2026-10-19')).toBe(loggedSignature(entries, '2026-10-11', '2026-10-19'))
  })

  it('reads no inherited keys as days', () => {
    expect(loggedSignature(Object.create({ '2026-10-12': { fajr: 'ontime' } }) as LogEntries, '2026-10-11', '2026-10-13')).toBe('')
  })
})

describe('useLoggedPrayers', () => {
  const log = (dateKey: string, prayer: 'asr' | 'isha', status: 'ontime' | 'jamaah' | null) =>
    act(() => usePrayerLog.getState().setStatus(dateKey, prayer, status))

  it('answers from the prayer log, from yesterday on', () => {
    log('2026-10-11', 'isha', 'ontime')
    log('2026-10-12', 'asr', 'ontime')
    const { result } = renderHook(() => useLoggedPrayers('2026-10-12'))
    expect(result.current('2026-10-11', 'isha')).toBe(true)
    expect(result.current('2026-10-12', 'asr')).toBe(true)
    expect(result.current('2026-10-12', 'isha')).toBe(false)
  })

  it('gives a new answer the moment a prayer is logged or cleared, and keeps it while only a status changes', () => {
    const { result } = renderHook(() => useLoggedPrayers('2026-10-12'))
    const before = result.current
    log('2026-10-12', 'asr', 'ontime')
    const logged = result.current
    expect(logged).not.toBe(before)
    expect(logged('2026-10-12', 'asr')).toBe(true)

    log('2026-10-12', 'asr', 'jamaah')
    expect(result.current).toBe(logged)

    log('2026-10-12', 'asr', null)
    expect(result.current).not.toBe(logged)
    expect(result.current('2026-10-12', 'asr')).toBe(false)
  })

  it('does not change for a prayer logged long before the days it is about', () => {
    const { result } = renderHook(() => useLoggedPrayers('2026-10-12'))
    const before = result.current
    log('2026-09-01', 'asr', 'ontime')
    expect(result.current).toBe(before)
  })
})
