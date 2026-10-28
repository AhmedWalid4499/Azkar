import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceTimeZone } from '../../../shared/date'
import { useLocationStore } from '../../../shared/location'
import { useSettings } from '../../../shared/settings'
import { device, Geolocation, resetDevice } from '../native-fakes'
import { resetStores } from '../test-helpers'
import { LocationPrompt } from './LocationPrompt'

vi.mock('@capacitor/core', async (original) => (await import('../native-fakes')).mockCore(await original()))
vi.mock('@capacitor/local-notifications', async () => (await import('../native-fakes')).localNotificationsModule)
vi.mock('@capacitor/app', async () => (await import('../native-fakes')).appModule)
vi.mock('@capacitor/geolocation', async () => (await import('../native-fakes')).geolocationModule)

const CAIRO_PLACE = { city: 'Cairo', locality: 'Bab ash Shariyah', countryName: 'Egypt', countryCode: 'EG' }
const savedLocation = () => useLocationStore.getState().location
const useMyLocation = () => screen.getByRole('button', { name: 'Use my location' })
const failure = (code: string) => ({ code, message: 'nope' })

let browserAsked: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetDevice('ios')
  resetStores()
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => CAIRO_PLACE }))
  vi.stubGlobal('fetch', fetchMock)
  // The web view's own geolocation must not be what answers in the app.
  browserAsked = vi.fn()
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: browserAsked } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as { geolocation?: unknown }).geolocation
})

describe('“Use my location” in the installed app', () => {
  it('asks the system for permission first, then saves the position it gives', async () => {
    const user = userEvent.setup()
    device.location = 'prompt'
    render(<LocationPrompt />)
    await user.click(useMyLocation())
    await waitFor(() => expect(savedLocation()?.label).toBe('Cairo, Egypt'))

    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] })
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.objectContaining({ timeout: 15_000 }))
    expect(savedLocation()).toMatchObject({ latitude: 30.044, longitude: 31.236, timeZone: deviceTimeZone(), countryCode: 'EG', source: 'gps' })
    expect(browserAsked).not.toHaveBeenCalled()
  })

  it('does not ask again once allowed', async () => {
    const user = userEvent.setup()
    render(<LocationPrompt />)
    await user.click(useMyLocation())
    await waitFor(() => expect(savedLocation()).not.toBeNull())
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled()
  })

  describe('with only an approximate position allowed (Android 12+)', () => {
    it.each([
      ['while the precise one may still be asked for', 'prompt-with-rationale'],
      ['after the precise one was refused for good', 'denied'],
    ] as const)('uses it without asking again, %s', async (_name, precise) => {
      const user = userEvent.setup()
      resetDevice('android')
      device.preciseRefused = precise
      render(<LocationPrompt />)
      await user.click(useMyLocation())
      await waitFor(() => expect(savedLocation()?.label).toBe('Cairo, Egypt'))
      expect(Geolocation.requestPermissions).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('takes “Approximate” as the answer to the prompt', async () => {
      const user = userEvent.setup()
      resetDevice('android')
      Object.assign(device, { location: 'prompt', locationAnswer: 'granted', preciseRefused: 'prompt-with-rationale' })
      render(<LocationPrompt />)
      await user.click(useMyLocation())
      await waitFor(() => expect(savedLocation()).toMatchObject({ latitude: 30.044, source: 'gps' }))
      expect(Geolocation.requestPermissions).toHaveBeenCalledTimes(1)
    })
  })

  it('does not put the prompt up a second time when it was just refused on Android', async () => {
    const user = userEvent.setup()
    resetDevice('android')
    // Refused once: Android may ask again later, which the plugin reports as "prompt with rationale".
    Object.assign(device, { location: 'prompt', locationAnswer: 'prompt-with-rationale' })
    render(<LocationPrompt />)
    await user.click(useMyLocation())
    expect(await screen.findByRole('alert')).toHaveTextContent(/Allow it in your phone’s Settings/)
    expect(Geolocation.requestPermissions).toHaveBeenCalledTimes(1)
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  describe('when it fails', () => {
    const IOS_DENIED = /Location access is off for Azkar\. Allow it in the Settings app under Privacy & Security › Location Services › Azkar/
    const ANDROID_DENIED = /Allow it in your phone’s Settings under Apps › Azkar › Permissions › Location/
    const SERVICES_OFF = /couldn’t work out where it is\. Check that location services are on/
    const cases: Array<[string, 'ios' | 'android', () => void, RegExp]> = [
      ['the permission prompt is refused on iOS', 'ios', () => Object.assign(device, { location: 'prompt', locationAnswer: 'denied' }), IOS_DENIED],
      ['the permission was refused before, on Android', 'android', () => (device.location = 'denied'), ANDROID_DENIED],
      ['the system reports the refusal as an error', 'ios', () => (device.position = failure('OS-PLUG-GLOC-0003')), IOS_DENIED],
      ['Screen Time restricts location on iOS', 'ios', () => (device.position = failure('OS-PLUG-GLOC-0008')), IOS_DENIED],
      ['location services are off for the whole device', 'ios', () => (device.locationCheckError = failure('OS-PLUG-GLOC-0007')), SERVICES_OFF],
      ['Android’s offer to turn location on is declined', 'android', () => (device.position = failure('OS-PLUG-GLOC-0009')), SERVICES_OFF],
      ['network and location are both off on Android', 'android', () => (device.position = failure('OS-PLUG-GLOC-0017')), SERVICES_OFF],
      ['it takes too long', 'ios', () => (device.position = failure('OS-PLUG-GLOC-0010')), /took too long/],
      ['the device reports nonsense', 'android', () => (device.position = { latitude: Number.NaN, longitude: 400 }), SERVICES_OFF],
      ['the plugin fails in a way nobody documented', 'ios', () => (device.position = failure('SOMETHING-ELSE')), SERVICES_OFF],
    ]

    it.each(cases)('explains what happened and what to do when %s', async (_name, platform, arrange, message) => {
      const user = userEvent.setup()
      resetDevice(platform)
      arrange()
      render(<LocationPrompt />)
      await user.click(useMyLocation())
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).toHaveTextContent(/search for your city/i)
      expect(alert).not.toHaveTextContent(/browser/)
      expect(useMyLocation()).toBeEnabled()
      expect(savedLocation()).toBeNull()
      expect(browserAsked).not.toHaveBeenCalled()
    })

    it('gives the iOS advice in Arabic when the interface is Arabic', async () => {
      const user = userEvent.setup()
      useSettings.setState({ language: 'ar' })
      device.location = 'denied'
      render(<LocationPrompt />)
      await user.click(screen.getByRole('button', { name: 'استخدام موقعي' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/«الخصوصية والأمن» ثم «خدمات الموقع» ثم «أذكار»/)
    })
  })
})
