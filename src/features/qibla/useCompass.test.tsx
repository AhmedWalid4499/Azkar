import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitChromeHeading,
  emitOrientation,
  emitSafariHeading,
  installFakeCompass,
  installNoCompass,
  removeFakeCompass,
  setScreenAngle,
} from './orientation-fakes'
import { NO_SIGNAL_MS, useCompass } from './useCompass'

afterEach(() => {
  removeFakeCompass()
  vi.useRealTimers()
})

async function press(start: () => void) {
  await act(async () => {
    start()
  })
}

describe('useCompass', () => {
  describe('without a compass', () => {
    it('says so in a browser without orientation events', () => {
      installNoCompass()
      const { result } = renderHook(() => useCompass())
      expect(result.current).toMatchObject({ status: 'unsupported', heading: null })
    })

    it('says so at once on a desktop, which never reports a compass', () => {
      const { requestPermission } = installFakeCompass({ ask: 'granted', touchPoints: 0 })
      const { result } = renderHook(() => useCompass())
      expect(result.current.status).toBe('unsupported')
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('gives up waiting after a while, and still turns on if a heading comes later', () => {
      vi.useFakeTimers()
      installFakeCompass()
      const { result } = renderHook(() => useCompass())
      expect(result.current.status).toBe('starting')

      // Chrome's relative events, and an empty one, carry no heading.
      emitOrientation({ type: 'deviceorientation', alpha: 40, absolute: false })
      emitOrientation({ type: 'deviceorientationabsolute', alpha: null, absolute: true })
      act(() => vi.advanceTimersByTime(NO_SIGNAL_MS - 1))
      expect(result.current.status).toBe('starting')
      act(() => vi.advanceTimersByTime(1))
      expect(result.current).toMatchObject({ status: 'unavailable', heading: null })

      emitChromeHeading(200)
      expect(result.current).toMatchObject({ status: 'live', heading: 200 })
    })
  })

  describe('where events come without asking (Chrome, Firefox, the Android app)', () => {
    it('follows the absolute heading', () => {
      installFakeCompass()
      const { result } = renderHook(() => useCompass())
      emitChromeHeading(90)
      expect(result.current).toMatchObject({ status: 'live', heading: 90, accuracy: null })
    })

    it('reads Firefox’s absolute events under the plain name', () => {
      installFakeCompass()
      const { result } = renderHook(() => useCompass())
      emitOrientation({ type: 'deviceorientation', alpha: 300, absolute: true })
      expect(result.current).toMatchObject({ status: 'live', heading: 60 })
    })

    it('stops listening when the page goes away', () => {
      installFakeCompass()
      const removed = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useCompass())
      unmount()
      const types = removed.mock.calls.map(([type]) => type)
      expect(types).toEqual(expect.arrayContaining(['deviceorientation', 'deviceorientationabsolute']))
    })
  })

  describe('where access is asked for (Safari, the iOS app)', () => {
    it('waits for a press before asking', () => {
      const { requestPermission } = installFakeCompass({ ask: 'granted' })
      const { result } = renderHook(() => useCompass())
      expect(result.current.status).toBe('idle')
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('asks on the press, then follows Safari’s compass heading', async () => {
      const { requestPermission } = installFakeCompass({ ask: 'granted' })
      const { result } = renderHook(() => useCompass())
      await press(result.current.start)
      expect(requestPermission).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('starting')

      emitSafariHeading(45, 12)
      expect(result.current).toMatchObject({ status: 'live', heading: 45, accuracy: 12 })
    })

    it('falls back when access is refused, and stops listening', async () => {
      installFakeCompass({ ask: 'denied' })
      const { result } = renderHook(() => useCompass())
      await press(result.current.start)
      expect(result.current.status).toBe('denied')

      emitSafariHeading(45)
      expect(result.current).toMatchObject({ status: 'denied', heading: null })
    })

    it('counts a prompt that throws as refused', async () => {
      installFakeCompass({ ask: new DOMException('Requires a user gesture', 'NotAllowedError') })
      const { result } = renderHook(() => useCompass())
      await press(result.current.start)
      expect(result.current.status).toBe('denied')
    })

    it('needs no press when access was given earlier in the session', () => {
      const { requestPermission } = installFakeCompass({ ask: 'granted' })
      const { result } = renderHook(() => useCompass())
      emitSafariHeading(300)
      expect(result.current).toMatchObject({ status: 'live', heading: 300 })
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('waits for the user rather than timing out before the press', () => {
      vi.useFakeTimers()
      installFakeCompass({ ask: 'granted' })
      const { result } = renderHook(() => useCompass())
      act(() => vi.advanceTimersByTime(NO_SIGNAL_MS * 3))
      expect(result.current.status).toBe('idle')
    })

    it('falls back when access is given but no heading follows, as in the simulator', async () => {
      vi.useFakeTimers()
      installFakeCompass({ ask: 'granted' })
      const { result } = renderHook(() => useCompass())
      await press(result.current.start)
      expect(result.current.status).toBe('starting')
      // The simulator sends orientation without a compass heading.
      emitOrientation({ type: 'deviceorientation', alpha: 0, absolute: false, webkitCompassHeading: null })
      act(() => vi.advanceTimersByTime(NO_SIGNAL_MS))
      expect(result.current.status).toBe('unavailable')
    })
  })

  it('gives the heading of the top of the screen when the screen is turned', () => {
    installFakeCompass({ ask: 'granted' })
    setScreenAngle(90)
    const { result } = renderHook(() => useCompass())
    // The phone's top points west; the top of the landscape screen points north.
    emitSafariHeading(270)
    expect(result.current.heading).toBe(0)
  })

  it('smooths small changes between readings', () => {
    installFakeCompass()
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const { result } = renderHook(() => useCompass())
    emitChromeHeading(100)
    now.mockReturnValue(1016)
    emitChromeHeading(102)
    const heading = result.current.heading ?? Number.NaN
    expect(heading).toBeGreaterThan(100)
    expect(heading).toBeLessThan(101)
  })
})
