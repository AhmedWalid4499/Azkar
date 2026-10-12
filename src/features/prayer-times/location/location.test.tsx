import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceTimeZone } from '../../../shared/date'
import { useLocationStore } from '../../../shared/location'
import { useSettings } from '../../../shared/settings'
import { autoMethod } from '../engine/methods'
import { CAIRO, resetStores } from '../test-helpers'
import { LocationPrompt } from './LocationPrompt'
import { LocationSettingsSection } from './LocationSettingsSection'
import { useLocationLabel } from './useLocationLabel'

const SEARCH_HOST = 'geocoding-api.open-meteo.com'
const REVERSE_HOST = 'api.bigdatacloud.net'

const CAIRO_RESULTS = {
  results: [
    { id: 360630, name: 'Cairo', latitude: 30.06263, longitude: 31.24967, country_code: 'EG', timezone: 'Africa/Cairo', country: 'Egypt', admin1: 'Cairo Governorate' },
    { id: 4234985, name: 'Cairo', latitude: 37.00533, longitude: -89.17646, country_code: 'US', timezone: 'America/Chicago', country: 'United States', admin1: 'Illinois' },
  ],
}
const CAIRO_PLACE = { city: 'Cairo', locality: 'Bab ash Shariyah', countryName: 'Egypt', countryCode: 'EG' }

type Handler = (url: URL, init?: RequestInit) => unknown | Promise<unknown>

/** Routes fetch by host. A handler returns the JSON body, or throws to simulate a network failure. */
function stubServices(handlers: { search?: Handler; reverse?: Handler }) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    const handler = url.hostname === SEARCH_HOST ? handlers.search : url.hostname === REVERSE_HOST ? handlers.reverse : undefined
    if (!handler) throw new Error(`Unexpected request to ${url.hostname}`)
    const body = await handler(url, init)
    return { ok: true, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  const calls = (host: string) => fetchMock.mock.calls.map(([input]) => new URL(input)).filter((url) => url.hostname === host)
  return { fetchMock, searches: () => calls(SEARCH_HOST), lookups: () => calls(REVERSE_HOST) }
}

type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number; message: string }) => void

function stubGeolocation(run: (success: Success, failure: Failure) => void) {
  const getCurrentPosition = vi.fn((success: Success, failure: Failure, _options?: PositionOptions) => run(success, failure))
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
  return getCurrentPosition
}

const at = (latitude: number, longitude: number) => (success: Success) => success({ coords: { latitude, longitude } })
const failing = (code: number) => (_success: Success, failure: Failure) => failure({ code, message: 'nope' })

const savedLocation = () => useLocationStore.getState().location
const useMyLocation = () => screen.getByRole('button', { name: 'Use my location' })
const searchButton = () => screen.getByRole('button', { name: 'Search for a city' })

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as { geolocation?: unknown }).geolocation
})

describe('LocationPrompt', () => {
  it('explains why location is needed and offers both ways, without contacting anything', () => {
    const { fetchMock } = stubServices({})
    const geolocation = stubGeolocation(at(30, 31))
    render(<LocationPrompt />)

    expect(screen.getByRole('heading', { name: 'Set your location' })).toBeInTheDocument()
    expect(screen.getByText(/calculated on your device/)).toBeInTheDocument()
    expect(useMyLocation()).toBeEnabled()
    expect(searchButton()).toBeEnabled()
    expect(geolocation).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('using the device location', () => {
  it('saves the position in the device zone and names it from rounded coordinates', async () => {
    const user = userEvent.setup()
    const { lookups, searches } = stubServices({ reverse: () => CAIRO_PLACE })
    const geolocation = stubGeolocation(at(30.0444196, 31.2357116))
    const before = Date.now()
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await waitFor(() => expect(savedLocation()?.label).toBe('Cairo, Egypt'))

    expect(savedLocation()).toMatchObject({
      latitude: 30.044,
      longitude: 31.236,
      timeZone: deviceTimeZone(),
      countryCode: 'EG',
      source: 'gps',
    })
    expect(savedLocation()?.updatedAt).toBeGreaterThanOrEqual(before)

    expect(geolocation).toHaveBeenCalledTimes(1)
    expect(geolocation.mock.calls[0]?.[2]).toMatchObject({ timeout: expect.any(Number) })
    expect(searches()).toHaveLength(0)
    expect(lookups()).toHaveLength(1)
    const [lookup] = lookups()
    expect(Object.fromEntries(lookup?.searchParams ?? [])).toEqual({ latitude: '30.04', longitude: '31.24', localityLanguage: 'en' })
  })

  it('shows progress and blocks a second request while the device is looking', async () => {
    const user = userEvent.setup()
    stubServices({ reverse: () => CAIRO_PLACE })
    let succeed: Success = () => {}
    stubGeolocation((success) => {
      succeed = success
    })
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    expect(screen.getByRole('status')).toHaveTextContent('Finding your location…')
    expect(useMyLocation()).toBeDisabled()
    // The other way forward stays open.
    expect(searchButton()).toBeEnabled()

    succeed({ coords: { latitude: 30.0444, longitude: 31.2357 } })
    await waitFor(() => expect(useMyLocation()).toBeEnabled())
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('still saves the location when the name lookup fails, with no name rather than a made-up one', async () => {
    const user = userEvent.setup()
    stubServices({
      reverse: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    stubGeolocation(at(30.0444196, 31.2357116))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    expect(await screen.findByText(/Its name couldn’t be looked up, but the prayer times are accurate/)).toBeInTheDocument()
    // The coordinates are written out where the place is shown, in the language of the day; they are not stored as a name.
    expect(savedLocation()).toMatchObject({
      latitude: 30.044,
      longitude: 31.236,
      label: '',
      countryCode: null,
      source: 'gps',
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces how it ended, and not only that it started, to a screen reader', async () => {
    const user = userEvent.setup()
    let fail: (reason: unknown) => void = () => {}
    stubServices({ reverse: () => new Promise((_resolve, reject) => (fail = reject)) })
    stubGeolocation(at(30.0444196, 31.2357116))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Location saved. Looking up the place name…'))

    await act(async () => fail(new TypeError('Failed to fetch')))
    // The same live region, still in the page, now carries the outcome, and shows it.
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Location saved. Its name couldn’t be looked up, but the prayer times are accurate.')
    expect(status).not.toHaveClass('visually-hidden')
    expect(screen.getAllByText(/couldn’t be looked up/)).toHaveLength(1)
  })

  it('works offline without attempting the lookup', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServices({ reverse: () => CAIRO_PLACE })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    stubGeolocation(at(-33.8688, 151.2093))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    expect(await screen.findByText(/You’re offline, so its name couldn’t be looked up/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/You’re offline, so its name couldn’t be looked up/)
    expect(savedLocation()).toMatchObject({ latitude: -33.869, longitude: 151.209, label: '', source: 'gps' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves the name empty when the service has none for the spot', async () => {
    const user = userEvent.setup()
    stubServices({ reverse: () => ({ city: '', locality: '', countryName: '', countryCode: '' }) })
    stubGeolocation(at(0.001, -140.5))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await screen.findByText(/Its name couldn’t be looked up/)
    expect(savedLocation()).toMatchObject({ label: '', countryCode: null })
  })

  it('does not let a late name overwrite a city chosen in the meantime', async () => {
    const user = userEvent.setup()
    let answer: (body: unknown) => void = () => {}
    stubServices({ reverse: () => new Promise((resolve) => (answer = resolve)) })
    stubGeolocation(at(30.0444, 31.2357))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await waitFor(() => expect(savedLocation()?.source).toBe('gps'))
    const makkah = { ...CAIRO, label: 'Makkah, Saudi Arabia', countryCode: 'SA' }
    useLocationStore.getState().setLocation(makkah)

    answer(CAIRO_PLACE)
    await waitFor(() => expect(useMyLocation()).toBeEnabled())
    expect(savedLocation()).toBe(makkah)
  })

  it('drops a device fix that arrives after a city was searched for and chosen', async () => {
    const user = userEvent.setup()
    const { lookups } = stubServices({ search: () => CAIRO_RESULTS, reverse: () => CAIRO_PLACE })
    let succeed: Success = () => {}
    stubGeolocation((success) => {
      succeed = success
    })
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await user.click(searchButton())
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('searchbox'), 'Cairo')
    await user.click(await within(dialog).findByRole('button', { name: /Illinois/ }))
    expect(savedLocation()).toMatchObject({ source: 'manual', timeZone: 'America/Chicago' })
    expect(useMyLocation()).toBeEnabled()

    succeed({ coords: { latitude: 51.5, longitude: -0.12 } })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(savedLocation()).toMatchObject({ source: 'manual', timeZone: 'America/Chicago' })
    expect(lookups()).toHaveLength(0)
  })

  it('clears an earlier location error once a city is chosen', async () => {
    const user = userEvent.setup()
    stubServices({ search: () => CAIRO_RESULTS })
    stubGeolocation(failing(1))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await screen.findByRole('alert')
    await user.click(searchButton())
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('searchbox'), 'Cairo')
    await user.click(await within(dialog).findByRole('button', { name: /Egypt/ }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the known name and country when an update at the same place cannot be looked up', async () => {
    const user = userEvent.setup()
    useLocationStore.setState({ location: { ...CAIRO, source: 'gps' } })
    stubServices({
      reverse: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    stubGeolocation(at(30.05, 31.24))
    render(<LocationPrompt />)

    await user.click(useMyLocation())
    await waitFor(() => expect(savedLocation()?.latitude).toBe(30.05))
    await waitFor(() => expect(useMyLocation()).toBeEnabled())
    expect(savedLocation()).toMatchObject({ label: 'Cairo, Egypt', countryCode: 'EG', source: 'gps' })
    expect(screen.queryByText(/couldn’t be looked up/)).toBeNull()
  })

  describe('an update that cannot be looked up, away from the saved place', () => {
    // About 15 km from the saved spot: too far to keep its name.
    const INDIANAPOLIS = { ...CAIRO, latitude: 39.768, longitude: -86.158, label: 'Indianapolis, United States', countryCode: 'US', source: 'gps' as const }

    async function updateOffline() {
      const user = userEvent.setup()
      const { fetchMock } = stubServices({ reverse: () => CAIRO_PLACE })
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      stubGeolocation(at(39.91, -86.05))
      render(<LocationPrompt />)
      await user.click(screen.getByRole('button', { name: 'Use my location' }))
      await screen.findByText(/You’re offline, so its name couldn’t be looked up/)
      expect(fetchMock).not.toHaveBeenCalled()
    }

    it('keeps the country, and with it the method, while the device is still in the same time zone', async () => {
      useLocationStore.setState({ location: { ...INDIANAPOLIS, timeZone: deviceTimeZone() } })
      await updateOffline()
      expect(savedLocation()).toMatchObject({ latitude: 39.91, longitude: -86.05, label: '', countryCode: 'US', timeZone: deviceTimeZone() })
      expect(autoMethod(savedLocation())).toBe('NorthAmerica')
    })

    it('drops the country once the device has moved to another time zone', async () => {
      const elsewhere = deviceTimeZone() === 'America/Chicago' ? 'America/Denver' : 'America/Chicago'
      useLocationStore.setState({ location: { ...INDIANAPOLIS, timeZone: elsewhere } })
      await updateOffline()
      expect(savedLocation()).toMatchObject({ label: '', countryCode: null, timeZone: deviceTimeZone() })
    })
  })

  describe('when it fails', () => {
    const cases: Array<[string, () => void, RegExp]> = [
      ['permission is denied', () => stubGeolocation(failing(1)), /Location access is blocked for this app/],
      ['the position is unavailable', () => stubGeolocation(failing(2)), /couldn’t work out where it is/],
      ['it times out', () => stubGeolocation(failing(3)), /took too long/],
      ['the browser has no geolocation', () => {}, /This browser can’t share your location/],
      [
        'the page is not served securely',
        () => {
          vi.stubGlobal('isSecureContext', false)
        },
        /needs a secure \(https\) connection/,
      ],
      [
        'the device reports nonsense',
        () => stubGeolocation(at(Number.NaN, 400)),
        /couldn’t work out where it is/,
      ],
    ]

    it.each(cases)('explains what happened and what to do when %s', async (_name, arrange, message) => {
      const user = userEvent.setup()
      const { fetchMock } = stubServices({ reverse: () => CAIRO_PLACE })
      arrange()
      render(<LocationPrompt />)

      await user.click(useMyLocation())
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      // Every message names the way forward, and that way is still there.
      expect(alert).toHaveTextContent(/search for your city/i)
      expect(searchButton()).toBeEnabled()
      expect(useMyLocation()).toBeEnabled()
      expect(savedLocation()).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('clears the error on the next attempt', async () => {
      const user = userEvent.setup()
      stubServices({ reverse: () => CAIRO_PLACE })
      stubGeolocation(failing(3))
      render(<LocationPrompt />)
      await user.click(useMyLocation())
      await screen.findByRole('alert')

      stubGeolocation(at(30.0444, 31.2357))
      await user.click(useMyLocation())
      await waitFor(() => expect(savedLocation()?.label).toBe('Cairo, Egypt'))
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })
})

describe('searching for a city', () => {
  async function openSearch(user: ReturnType<typeof userEvent.setup>) {
    await user.click(searchButton())
    const dialog = screen.getByRole('dialog', { name: 'Search for a city' })
    return { dialog, input: within(dialog).getByRole('searchbox', { name: 'City name' }) }
  }

  it('waits for a pause, asks once, lists the matches and saves the chosen one', async () => {
    const user = userEvent.setup()
    const { searches, lookups } = stubServices({ search: () => CAIRO_RESULTS })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)

    expect(within(dialog).getByText('Type at least 2 letters.')).toBeInTheDocument()
    await user.type(input, 'Cairo')
    expect(searches()).toHaveLength(0)

    const egypt = await within(dialog).findByRole('button', { name: /Cairo.*Cairo Governorate, Egypt/ })
    expect(within(dialog).getByRole('button', { name: /Cairo.*Illinois, United States/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 places found')
    // One request for the finished word, not one per keystroke.
    expect(searches()).toHaveLength(1)
    expect(Object.fromEntries(searches()[0]?.searchParams ?? [])).toEqual({ name: 'Cairo', count: '8', language: 'en', format: 'json' })

    const before = Date.now()
    await user.click(egypt)
    expect(savedLocation()).toMatchObject({
      latitude: 30.06263,
      longitude: 31.24967,
      timeZone: 'Africa/Cairo',
      label: 'Cairo, Egypt',
      countryCode: 'EG',
      source: 'manual',
    })
    expect(savedLocation()?.updatedAt).toBeGreaterThanOrEqual(before)
    expect(screen.queryByRole('dialog')).toBeNull()
    // A chosen city already has its name: no reverse lookup.
    expect(lookups()).toHaveLength(0)
  })

  it('takes the zone and country of whichever match is picked', async () => {
    const user = userEvent.setup()
    stubServices({ search: () => CAIRO_RESULTS })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Cairo')
    await user.click(await within(dialog).findByRole('button', { name: /Illinois/ }))
    expect(savedLocation()).toMatchObject({ timeZone: 'America/Chicago', countryCode: 'US', label: 'Cairo, United States' })
  })

  it('does not search for a single character', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServices({ search: () => CAIRO_RESULTS })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'C')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Type at least 2 letters.')).toBeInTheDocument()
  })

  it('cancels the request for a term the user has typed past', async () => {
    const user = userEvent.setup()
    const signals = new Map<string, AbortSignal>()
    const { searches } = stubServices({
      search: (url, init) => {
        const name = url.searchParams.get('name') ?? ''
        signals.set(name, init?.signal as AbortSignal)
        if (name === 'Ca') return new Promise(() => {})
        return CAIRO_RESULTS
      },
    })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)

    await user.type(input, 'Ca')
    await waitFor(() => expect(searches()).toHaveLength(1))
    await user.type(input, 'iro')
    await within(dialog).findByRole('button', { name: /Egypt/ })

    expect(searches().map((url) => url.searchParams.get('name'))).toEqual(['Ca', 'Cairo'])
    expect(signals.get('Ca')?.aborted).toBe(true)
    expect(signals.get('Cairo')?.aborted).toBe(false)
  })

  it('says when nothing matches', async () => {
    const user = userEvent.setup()
    stubServices({ search: () => ({ generationtime_ms: 0.4 }) })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Qqqzz')
    expect(await within(dialog).findByText('No places found for “Qqqzz”.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('list')).toBeNull()
  })

  it('explains a failed search and retries on request', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { searches } = stubServices({
      search: () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        return CAIRO_RESULTS
      },
    })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Cairo')

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('The place search couldn’t be reached.')
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog).findByRole('button', { name: /Egypt/ })).toBeInTheDocument()
    expect(searches()).toHaveLength(2)
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })

  it('explains that search needs a connection when offline', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServices({ search: () => CAIRO_RESULTS })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Cairo')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/You’re offline.*“Use my location” works without one/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('can be driven from the keyboard', async () => {
    const user = userEvent.setup()
    stubServices({ search: () => CAIRO_RESULTS })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Cairo')
    const [first, second] = await within(dialog).findAllByRole('button', { name: /Cairo/ })

    input.focus()
    await user.keyboard('{ArrowDown}')
    expect(first).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(second).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(input).toHaveFocus()

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(savedLocation()).toMatchObject({ timeZone: 'America/Chicago', source: 'manual' })
  })

  it('ignores a response that is not what it expects', async () => {
    const user = userEvent.setup()
    stubServices({ search: () => ({ results: [{ name: 'Nowhere', latitude: 'x', longitude: null, timezone: 'Not/AZone' }, 7, null] }) })
    render(<LocationPrompt />)
    const { dialog, input } = await openSearch(user)
    await user.type(input, 'Nowhere')
    expect(await within(dialog).findByText('No places found for “Nowhere”.')).toBeInTheDocument()
    expect(savedLocation()).toBeNull()
  })

  it('searches and labels in Arabic when the interface is Arabic', async () => {
    resetStores({ settings: { language: 'ar' } })
    const user = userEvent.setup()
    const { searches } = stubServices({
      search: () => ({
        results: [{ id: 360630, name: 'القاهرة', latitude: 30.06263, longitude: 31.24967, country_code: 'EG', timezone: 'Africa/Cairo', country: 'مصر', admin1: 'القاهرة' }],
      }),
    })
    render(<LocationPrompt />)
    await user.click(screen.getByRole('button', { name: 'البحث عن مدينة' }))
    const dialog = screen.getByRole('dialog', { name: 'البحث عن مدينة' })
    await user.type(within(dialog).getByRole('searchbox', { name: 'اسم المدينة' }), 'القاهرة')
    await user.click(await within(dialog).findByRole('button', { name: /القاهرة/ }))

    expect(searches()[0]?.searchParams.get('language')).toBe('ar')
    expect(savedLocation()?.label).toBe('القاهرة، مصر')
  })
})

describe('LocationSettingsSection', () => {
  it('invites the user to set a location when there is none', () => {
    render(<LocationSettingsSection />)
    expect(screen.getByRole('region', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByText('Not set')).toBeInTheDocument()
    expect(useMyLocation()).toBeInTheDocument()
    expect(searchButton()).toBeInTheDocument()
  })

  it('shows the place, where it came from, when it was updated and its zone', () => {
    resetStores({ location: CAIRO, settings: { timeFormat: '24h' } })
    render(<LocationSettingsSection />)
    expect(screen.getByText('Cairo, Egypt')).toBeInTheDocument()
    // The moment is shown in the device's own zone, whichever that is on the machine running this.
    expect(screen.getByText(/^Chosen by search · Updated (Sep 30|Oct [12]), 2026, \d\d:\d\d$/)).toBeInTheDocument()
    expect(screen.getByText('Time zone: Africa/Cairo')).toBeInTheDocument()
    // A searched city is not "updated" from the device; the GPS button keeps its plain name.
    expect(useMyLocation()).toBeInTheDocument()
  })

  it('offers "Update location" for a device location and refreshes it on request only', async () => {
    const user = userEvent.setup()
    resetStores({ location: { ...CAIRO, source: 'gps', timeZone: deviceTimeZone() } })
    const { fetchMock } = stubServices({ reverse: () => ({ city: 'Giza', countryName: 'Egypt', countryCode: 'EG' }) })
    const geolocation = stubGeolocation(at(29.987, 31.2118))
    render(<LocationSettingsSection />)

    expect(screen.getByText(/^From this device · Updated /)).toBeInTheDocument()
    expect(geolocation).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Update location' }))
    expect(await screen.findByText('Giza, Egypt')).toBeInTheDocument()
    expect(savedLocation()).toMatchObject({ latitude: 29.987, longitude: 31.212, source: 'gps' })
    expect(savedLocation()?.updatedAt).toBeGreaterThan(CAIRO.updatedAt)
  })

  it('points out when the device has moved to another time zone since', () => {
    const elsewhere = deviceTimeZone() === 'Asia/Tokyo' ? 'Africa/Cairo' : 'Asia/Tokyo'
    resetStores({ location: { ...CAIRO, source: 'gps', timeZone: elsewhere } })
    render(<LocationSettingsSection />)
    expect(screen.getByText(/time zone has changed since this location was saved/)).toBeInTheDocument()
  })

  it('says nothing about zones for a city chosen by hand', () => {
    const elsewhere = deviceTimeZone() === 'Asia/Tokyo' ? 'Africa/Cairo' : 'Asia/Tokyo'
    resetStores({ location: { ...CAIRO, source: 'manual', timeZone: elsewhere } })
    render(<LocationSettingsSection />)
    expect(screen.queryByText(/time zone has changed/)).toBeNull()
  })

  it('falls back to coordinates for a location saved without a name', () => {
    resetStores({ location: { ...CAIRO, label: '' } })
    render(<LocationSettingsSection />)
    expect(screen.getByText('30.04° N, 31.24° E')).toBeInTheDocument()
  })

  it('writes those coordinates in the language in use now, not the one the location was saved in', async () => {
    resetStores({ settings: { language: 'ar' } })
    const user = userEvent.setup()
    stubServices({})
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    stubGeolocation(at(30.0444, 31.2357))
    render(<LocationSettingsSection />)

    await user.click(screen.getByRole('button', { name: 'استخدام موقعي' }))
    expect(await screen.findByText('٣٠٫٠٤° شمالًا، ٣١٫٢٤° شرقًا')).toBeInTheDocument()
    expect(savedLocation()?.label).toBe('')

    act(() => useSettings.setState({ language: 'en' }))
    expect(screen.getByText('30.04° N, 31.24° E')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/[٠-٩]|شمالًا/)
  })

  it('says in Arabic that it is the lookup service that receives the position', () => {
    resetStores({ settings: { language: 'ar' } })
    render(<LocationSettingsSection />)
    const footer = screen.getByText(/يبقى موقعك على هذا الجهاز/)
    // Without its subject the verb reads as "you receive your approximate position".
    expect(footer).toHaveTextContent('فتتلقّى الخدمة حينها موقعك التقريبي')
  })

  it('asks for the location again when the stored one is unusable', () => {
    useLocationStore.setState({ location: { ...CAIRO, latitude: 1234 } })
    render(<LocationSettingsSection />)
    expect(screen.getByText('The saved location can’t be read. Please set it again.')).toBeInTheDocument()
    expect(useMyLocation()).toBeInTheDocument()
  })
})

describe('useLocationLabel', () => {
  const label = () => renderHook(() => useLocationLabel()).result.current

  it('is null until a location is saved', () => {
    expect(label()).toBeNull()
  })

  it('is the stored name when there is one', () => {
    resetStores({ location: CAIRO })
    expect(label()).toBe('Cairo, Egypt')
  })

  it('is the coordinates, in the interface language and digits, when there is none', () => {
    const unnamed = { ...CAIRO, latitude: -33.869, longitude: 151.209, label: '' }
    resetStores({ location: unnamed })
    expect(label()).toBe('33.87° S, 151.21° E')
    resetStores({ location: unnamed, settings: { language: 'ar' } })
    expect(label()).toBe('٣٣٫٨٧° جنوبًا، ١٥١٫٢١° شرقًا')
    resetStores({ location: unnamed, settings: { language: 'ar', arabicDigits: false } })
    expect(label()).toBe('33.87° جنوبًا، 151.21° شرقًا')
  })
})
