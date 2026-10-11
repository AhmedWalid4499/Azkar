import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { usePrayerTimesStore } from './config'
import * as engine from './engine/compute'
import { useNextPrayer, usePrayerDay, usePrayerSchedule } from './hooks'
import { CAIRO, resetStores, restoreDeviceZone, setDeviceZone, zonedInstant } from './test-helpers'

const cairo = (dateKey: string, clock: string) => zonedInstant(dateKey, clock, 'Africa/Cairo')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(cairo('2026-10-12', '14:00'))
  resetStores({ location: CAIRO })
})

afterEach(() => {
  vi.useRealTimers()
  restoreDeviceZone()
})

describe('usePrayerDay', () => {
  it('is null until a location is saved', () => {
    resetStores()
    expect(renderHook(() => usePrayerDay()).result.current).toBeNull()
    expect(renderHook(() => usePrayerDay('2026-10-12')).result.current).toBeNull()
  })

  it('defaults to today in the location’s zone, not the device’s', () => {
    // 22:30 UTC on the 12th is already the 13th in Cairo and still the 12th in Los Angeles.
    setDeviceZone('America/Los_Angeles')
    vi.setSystemTime(new Date('2026-10-12T22:30:00Z'))
    const { result } = renderHook(() => usePrayerDay())
    expect(result.current?.dateKey).toBe('2026-10-13')
    expect(result.current?.timeZone).toBe('Africa/Cairo')
  })

  it('returns the requested day, with every time on it', () => {
    const { result } = renderHook(() => usePrayerDay('2026-01-05'))
    expect(result.current?.dateKey).toBe('2026-01-05')
    expect(result.current?.times.dhuhr.toISOString().slice(0, 10)).toBe('2026-01-05')
  })

  it('is null for a malformed date key rather than throwing', () => {
    expect(renderHook(() => usePrayerDay('2026-02-30')).result.current).toBeNull()
    expect(renderHook(() => usePrayerDay('yesterday')).result.current).toBeNull()
  })

  it('follows the settings', () => {
    const { result } = renderHook(() => usePrayerDay('2026-10-12'))
    const before = result.current
    act(() => usePrayerTimesStore.getState().setMadhab('hanafi'))
    expect(result.current?.times.asr.getTime()).toBeGreaterThan(before?.times.asr.getTime() ?? Infinity)
    expect(result.current?.times.dhuhr.getTime()).toBe(before?.times.dhuhr.getTime())
  })

  it('hands the same object to every caller', () => {
    const first = renderHook(() => usePrayerDay('2026-10-12')).result.current
    const second = renderHook(() => usePrayerDay('2026-10-12')).result.current
    expect(second).toBe(first)
  })

  it('rolls over to the new day after local midnight', () => {
    vi.setSystemTime(cairo('2026-10-12', '23:59:30'))
    const { result } = renderHook(() => usePrayerDay())
    expect(result.current?.dateKey).toBe('2026-10-12')
    act(() => void vi.advanceTimersByTime(60_000))
    expect(result.current?.dateKey).toBe('2026-10-13')
  })

  it('ignores a saved location that cannot be used', () => {
    const broken: unknown[] = [
      { ...CAIRO, latitude: 999 },
      { ...CAIRO, longitude: 'east' },
      { ...CAIRO, latitude: Number.NaN },
      'Cairo',
      42,
      {},
    ]
    for (const location of broken) {
      useLocationStore.setState({ location: location as SavedLocation })
      expect(renderHook(() => usePrayerDay()).result.current).toBeNull()
      expect(renderHook(() => useNextPrayer()).result.current).toBeNull()
    }
  })

  it('falls back to the device zone when the saved zone is not a real one', () => {
    setDeviceZone('Asia/Tokyo')
    useLocationStore.setState({ location: { ...CAIRO, timeZone: 'Not/AZone' } })
    const { result } = renderHook(() => usePrayerDay())
    expect(result.current?.timeZone).toBe('Asia/Tokyo')
  })
})

describe('useNextPrayer', () => {
  it('is null until a location is saved', () => {
    resetStores()
    expect(renderHook(() => useNextPrayer()).result.current).toBeNull()
  })

  it('steps through the afternoon as time passes', () => {
    const { result } = renderHook(() => useNextPrayer())
    expect(result.current).toMatchObject({ prayer: 'asr', dateKey: '2026-10-12' })
    const asr = result.current?.at.getTime() ?? 0

    act(() => void vi.advanceTimersByTime(asr - Date.now() - 1_000))
    expect(result.current?.prayer).toBe('asr')
    act(() => void vi.advanceTimersByTime(2_000))
    expect(result.current).toMatchObject({ prayer: 'maghrib', dateKey: '2026-10-12' })
  })

  it('gives today’s Fajr before dawn', () => {
    vi.setSystemTime(cairo('2026-10-12', '02:15'))
    const { result } = renderHook(() => useNextPrayer())
    expect(result.current).toMatchObject({ prayer: 'fajr', dateKey: '2026-10-12' })
  })

  it('skips sunrise', () => {
    // Fajr 05:28, sunrise 06:55 in Cairo on this day.
    vi.setSystemTime(cairo('2026-10-12', '06:00'))
    const { result } = renderHook(() => useNextPrayer())
    expect(result.current).toMatchObject({ prayer: 'dhuhr', dateKey: '2026-10-12' })
    act(() => void vi.advanceTimersByTime(90 * 60_000))
    expect(result.current).toMatchObject({ prayer: 'dhuhr', dateKey: '2026-10-12' })
  })

  it('rolls over to tomorrow’s Fajr after Isha and keeps it through midnight until dawn', () => {
    vi.setSystemTime(cairo('2026-10-12', '19:00'))
    const { result } = renderHook(() => useNextPrayer())
    expect(result.current).toMatchObject({ prayer: 'isha', dateKey: '2026-10-12' })

    act(() => void vi.advanceTimersByTime(60 * 60_000))
    expect(result.current).toMatchObject({ prayer: 'fajr', dateKey: '2026-10-13' })
    const fajr = result.current?.at.getTime() ?? 0
    expect(fajr).toBeGreaterThan(cairo('2026-10-13', '05:00').getTime())
    expect(fajr).toBeLessThan(cairo('2026-10-13', '06:00').getTime())

    // Past midnight the day changes under it, but it is the same Fajr at the same instant.
    act(() => void vi.advanceTimersByTime(5 * 60 * 60_000))
    expect(Date.now()).toBeGreaterThan(cairo('2026-10-13', '00:30').getTime())
    expect(result.current).toMatchObject({ prayer: 'fajr', dateKey: '2026-10-13' })
    expect(result.current?.at.getTime()).toBe(fajr)

    act(() => void vi.advanceTimersByTime(fajr - Date.now() + 1_000))
    expect(result.current).toMatchObject({ prayer: 'dhuhr', dateKey: '2026-10-13' })
  })

  it('keeps returning the same object between ticks', () => {
    const { result } = renderHook(() => useNextPrayer())
    const first = result.current
    act(() => void vi.advanceTimersByTime(5_000))
    expect(result.current).toBe(first)
  })
})

describe('memoisation', () => {
  it('computes three days once, not on every tick', () => {
    // A location object of its own, so nothing is already cached for it.
    useLocationStore.setState({ location: { ...CAIRO } })
    const compute = vi.spyOn(engine, 'computePrayerDay')
    const { result } = renderHook(() => ({ schedule: usePrayerSchedule(), next: useNextPrayer() }))
    expect(result.current.schedule?.days.map((day) => day.dateKey)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13'])
    expect(compute).toHaveBeenCalledTimes(3)

    act(() => void vi.advanceTimersByTime(30_000))
    expect(compute).toHaveBeenCalledTimes(3)

    // A changed setting is a new timetable.
    act(() => usePrayerTimesStore.getState().setAdjustment('asr', 2))
    expect(compute).toHaveBeenCalledTimes(6)
  })
})
