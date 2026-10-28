import { describe, expect, it } from 'vitest'
import {
  ALIGN_ENTER_DEGREES,
  ALIGN_LEAVE_DEGREES,
  isPoorAccuracy,
  nextAligned,
  normalizeDegrees,
  readHeading,
  signedDelta,
  smoothHeading,
} from './heading'

describe('normalizeDegrees', () => {
  it.each([
    [0, 0],
    [360, 0],
    [720, 0],
    [-0, 0],
    [-10, 350],
    [370, 10],
    [-370, 350],
    [359.5, 359.5],
  ])('brings %f° to %f°', (angle, expected) => {
    expect(Object.is(normalizeDegrees(angle), expected)).toBe(true)
  })
})

describe('signedDelta', () => {
  it.each([
    [10, 30, 20],
    [30, 10, -20],
    // Across north, both ways: the short way round, never the long one.
    [350, 10, 20],
    [10, 350, -20],
    [359, 1, 2],
    [1, 359, -2],
    [0, 180, 180],
    [180, 0, 180],
    [90, 271, -179],
    [0, 0, 0],
  ])('turns from %f° to %f° by %f°', (from, to, turn) => {
    expect(signedDelta(from, to)).toBeCloseTo(turn, 10)
  })
})

describe('readHeading', () => {
  it('takes Safari’s compass heading as it is in portrait', () => {
    expect(
      readHeading({ type: 'deviceorientation', alpha: 200, absolute: false, webkitCompassHeading: 100, webkitCompassAccuracy: 15 }, 0),
    ).toEqual({ heading: 100, north: 'magnetic', accuracy: 15 })
  })

  it('turns an absolute alpha, which runs counter-clockwise, into a clockwise heading', () => {
    expect(readHeading({ type: 'deviceorientationabsolute', alpha: 30, absolute: true }, 0)).toEqual({
      heading: 330,
      north: 'magnetic',
      accuracy: null,
    })
    expect(readHeading({ type: 'deviceorientationabsolute', alpha: 0, absolute: true }, 0)?.heading).toBe(0)
    // Firefox marks its absolute events on the plain event name.
    expect(readHeading({ type: 'deviceorientation', alpha: 90, absolute: true }, 0)?.heading).toBe(270)
  })

  it('adds the screen’s rotation, so the heading is that of the top of what is shown', () => {
    // Phone turned a quarter counter-clockwise: its top points west, the top of the landscape screen north.
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: 270 }, 90)?.heading).toBe(0)
    expect(readHeading({ type: 'deviceorientationabsolute', alpha: 90, absolute: true }, 90)?.heading).toBe(0)
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: 10 }, 270)?.heading).toBe(280)
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: 350 }, 180)?.heading).toBe(170)
  })

  it('ignores events with no heading in them', () => {
    // Chrome's plain event is relative to wherever the phone faced when it started.
    expect(readHeading({ type: 'deviceorientation', alpha: 30, absolute: false }, 0)).toBeNull()
    // A desktop browser's one event with nothing in it, or a sensor still waking up.
    expect(readHeading({ type: 'deviceorientationabsolute', alpha: null, absolute: true }, 0)).toBeNull()
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: null }, 0)).toBeNull()
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: -1 }, 0)).toBeNull()
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: Number.NaN }, 0)).toBeNull()
    expect(readHeading({ type: 'deviceorientation' }, 0)).toBeNull()
  })

  it('reports an uncalibrated compass', () => {
    expect(readHeading({ type: 'deviceorientation', webkitCompassHeading: 5, webkitCompassAccuracy: -1 }, 0)?.accuracy).toBe(-1)
    expect(isPoorAccuracy(-1)).toBe(true)
    expect(isPoorAccuracy(50)).toBe(true)
    expect(isPoorAccuracy(25)).toBe(false)
    expect(isPoorAccuracy(10)).toBe(false)
    expect(isPoorAccuracy(null)).toBe(false)
  })
})

describe('smoothHeading', () => {
  const FRAME = 16

  it('takes the first reading as it is', () => {
    expect(smoothHeading(null, 123.4, 0)).toBe(123.4)
    expect(smoothHeading(null, 370, 0)).toBe(10)
  })

  it('stills small tremors', () => {
    let heading = 100
    const tremor = [101, 99, 101.5, 98.5, 100.8, 99.2]
    for (const reading of tremor) {
      heading = smoothHeading(heading, reading, FRAME)
      expect(Math.abs(heading - 100)).toBeLessThan(0.3)
    }
  })

  it('stays by north when the readings flicker across it, rather than swinging through south', () => {
    let heading = 0
    for (const reading of [359, 1, 358.5, 1.5, 359.5, 0.5]) {
      heading = smoothHeading(heading, reading, FRAME)
      expect(Math.abs(signedDelta(heading, 0))).toBeLessThan(0.3)
    }
  })

  it('moves the short way round across north', () => {
    const next = smoothHeading(355, 5, FRAME)
    expect(signedDelta(355, next)).toBeGreaterThan(0)
    expect(signedDelta(next, 5)).toBeGreaterThan(0)
    const back = smoothHeading(5, 355, FRAME)
    expect(signedDelta(5, back)).toBeLessThan(0)
  })

  it('follows a real turn at once, without lagging behind it', () => {
    expect(smoothHeading(10, 60, FRAME)).toBe(60)
    expect(smoothHeading(350, 40, FRAME)).toBe(40)
  })

  it('settles on a new heading within a third of a second', () => {
    let heading = 90
    let elapsed = 0
    while (Math.abs(heading - 96) > 0.5) {
      heading = smoothHeading(heading, 96, FRAME)
      elapsed += FRAME
    }
    expect(elapsed).toBeLessThanOrEqual(340)
  })

  it('takes a whole change after a long pause between readings', () => {
    expect(smoothHeading(90, 93, 5000)).toBeCloseTo(93, 5)
  })
})

describe('nextAligned', () => {
  it('comes into line within a few degrees either way', () => {
    expect(nextAligned(false, 0)).toBe(true)
    expect(nextAligned(false, ALIGN_ENTER_DEGREES)).toBe(true)
    expect(nextAligned(false, -ALIGN_ENTER_DEGREES)).toBe(true)
    expect(nextAligned(false, ALIGN_ENTER_DEGREES + 0.1)).toBe(false)
    expect(nextAligned(false, -4)).toBe(false)
  })

  it('stays in line through a small waver, and leaves it on a real turn', () => {
    expect(nextAligned(true, 4)).toBe(true)
    expect(nextAligned(true, -ALIGN_LEAVE_DEGREES)).toBe(true)
    expect(nextAligned(true, ALIGN_LEAVE_DEGREES + 0.1)).toBe(false)
    expect(nextAligned(true, -180)).toBe(false)
  })
})
