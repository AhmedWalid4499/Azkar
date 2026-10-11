import { describe, expect, it } from 'vitest'
import { dateKeyInZone, zonedParts } from '../../../shared/date'
import { TIME_SLOTS } from '../../../shared/types'
import { computePrayerDay, DEFAULT_CALCULATION, isValidTime } from './compute'
import { ALADHAN_CASES, AUTHORITY_CASES } from './reference.fixtures'
import type { ReferenceCase } from './reference.fixtures'

/**
 * Agreement required with an independent timetable. Where a reference disagrees by more, the
 * cause is recorded next to the fixture and a third source decides; this number does not move.
 */
const TOLERANCE_MINUTES = 2

function minutesOfDay(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function check({ dateKey, place, config, expected }: ReferenceCase) {
  const day = computePrayerDay(dateKey, { ...place, countryCode: null }, { ...DEFAULT_CALCULATION, ...config })
  for (const slot of TIME_SLOTS) {
    const at = day.times[slot]
    expect(isValidTime(at), `${slot} is a real time`).toBe(true)
    const { hour, minute } = zonedParts(at, place.timeZone)
    const difference = hour * 60 + minute - minutesOfDay(expected[slot])
    expect(Math.abs(difference), `${slot}: computed ${hour}:${String(minute).padStart(2, '0')}, reference ${expected[slot]}`).toBeLessThanOrEqual(
      TOLERANCE_MINUTES,
    )
    // The right clock time on the wrong day would still be a wrong answer.
    expect(dateKeyInZone(at, place.timeZone), `${slot} falls on the requested day`).toBe(dateKey)
  }
}

describe('engine against the Aladhan API', () => {
  it.each(ALADHAN_CASES)('$name ($dateKey)', (reference) => check(reference))
})

describe('engine against the authorities’ own timetables', () => {
  it.each(AUTHORITY_CASES)('$name ($dateKey)', (reference) => check(reference))
})
