// Shared by this feature's tests only; nothing in the app imports it.
// A pretend device for the compass: what the browser offers, and the orientation events it sends.
import { act } from '@testing-library/react'
import { vi } from 'vitest'

const original = Object.getOwnPropertyDescriptor(window, 'DeviceOrientationEvent')

export interface FakeCompassOptions {
  /**
   * Safari's permission prompt: how it is answered, or an error it throws.
   * Leave out for a browser that sends events without asking (Chrome, Firefox).
   */
  ask?: 'granted' | 'denied' | Error
  /** `navigator.maxTouchPoints`; 0 is a desktop. */
  touchPoints?: number
}

/** Installs a browser with orientation events. Undo with `removeFakeCompass` after each test. */
export function installFakeCompass({ ask, touchPoints = 5 }: FakeCompassOptions = {}) {
  const requestPermission =
    ask === undefined
      ? undefined
      : vi.fn(async () => {
          if (ask instanceof Error) throw ask
          return ask
        })
  class FakeDeviceOrientationEvent extends Event {}
  if (requestPermission) Object.assign(FakeDeviceOrientationEvent, { requestPermission })
  Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, writable: true, value: FakeDeviceOrientationEvent })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touchPoints })
  return { requestPermission }
}

/** A browser without orientation events at all. */
export function installNoCompass() {
  Reflect.deleteProperty(window, 'DeviceOrientationEvent')
}

/** Turns the screen, as `screen.orientation.angle` reports it. */
export function setScreenAngle(angle: number) {
  Object.defineProperty(window.screen, 'orientation', { configurable: true, value: { angle } })
}

export function removeFakeCompass() {
  if (original) Object.defineProperty(window, 'DeviceOrientationEvent', original)
  else Reflect.deleteProperty(window, 'DeviceOrientationEvent')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  Reflect.deleteProperty(window.screen, 'orientation')
}

export interface FakeOrientation {
  type?: 'deviceorientation' | 'deviceorientationabsolute'
  alpha?: number | null
  absolute?: boolean
  webkitCompassHeading?: number | null
  webkitCompassAccuracy?: number | null
}

/** Sends one orientation event, as the browser would. */
export function emitOrientation({ type = 'deviceorientation', ...fields }: FakeOrientation) {
  const event = new Event(type)
  for (const [name, value] of Object.entries(fields)) Object.defineProperty(event, name, { value })
  act(() => {
    window.dispatchEvent(event)
  })
}

/** What Safari sends: the heading of the top of the phone from magnetic north, and how sure it is. */
export function emitSafariHeading(heading: number, accuracy = 10) {
  emitOrientation({ type: 'deviceorientation', alpha: 12, absolute: false, webkitCompassHeading: heading, webkitCompassAccuracy: accuracy })
}

/** What Chrome on Android sends: an absolute alpha, counter-clockwise from north. */
export function emitChromeHeading(heading: number) {
  emitOrientation({ type: 'deviceorientationabsolute', alpha: (360 - heading) % 360, absolute: true })
}
