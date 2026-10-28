import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Matcher } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic, isNativeApp } from '../../native'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import { KAABA } from './bearing'
import {
  emitChromeHeading,
  emitSafariHeading,
  installFakeCompass,
  installNoCompass,
  removeFakeCompass,
} from './orientation-fakes'
import { QiblaPage } from './QiblaPage'
import { ANNOUNCE_EVERY_MS } from './useRestrainedText'

vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  haptic: vi.fn(),
  isNativeApp: vi.fn(() => false),
}))

// The place's name comes from the prayer-times feature, whose own tests cover it; this page only shows it.
// Standing in for it keeps these tests apart from everything else that feature's entry point loads.
vi.mock('../prayer-times', async () => {
  const { useLocationStore: store } = await import('../../shared/location')
  return { useLocationLabel: () => store((state) => state.location?.label || null) }
})

const CAIRO: SavedLocation = {
  latitude: 30.0444,
  longitude: 31.2357,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: 0,
}
/** Cairo's Qibla, from bearing.test.ts. */
const BEARING = 136.137

// Text from the page carries isolates around degrees; these strip them for comparison.
const plain = (text: string | null | undefined) => (text ?? '').replace(/[⁦-⁩]/g, '')

function renderPage({ location = CAIRO, settings = {} }: { location?: SavedLocation | null; settings?: Partial<AppSettings> } = {}) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', ...settings })
  useLocationStore.setState({ location })
  return render(
    <MemoryRouter>
      <QiblaPage />
    </MemoryRouter>,
  )
}

const dial = () => screen.getByRole('img', { name: /dial|قرص/i })
const cardTurn = () => dial().querySelector('[data-part="card"]')?.getAttribute('transform')
const qiblaMark = () => dial().querySelector('[data-part="qibla"]')?.getAttribute('transform')
const announcement = () => plain(screen.getByRole('status').textContent)

// The page's text as it is shown; the live region repeats some of it for screen readers.
const shown = (text: Matcher) => screen.getByText(text, { ignore: '.visually-hidden' })
const queryShown = (text: Matcher) => screen.queryByText(text, { ignore: '.visually-hidden' })

/** Readings far enough apart in time that smoothing takes each one whole. */
function spaceReadings() {
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 10_000))
}

beforeEach(() => {
  vi.mocked(haptic).mockClear()
  vi.mocked(isNativeApp).mockReturnValue(false)
})

afterEach(() => {
  removeFakeCompass()
  vi.useRealTimers()
  useSettings.setState(DEFAULT_SETTINGS)
  useLocationStore.setState({ location: null })
})

describe('QiblaPage', () => {
  it('asks for a location first, with a way to Settings', () => {
    installFakeCompass()
    renderPage({ location: null })
    expect(screen.getByRole('heading', { name: 'Set your location' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('has a back button only when it is given somewhere to go back to', () => {
    installNoCompass()
    const { unmount } = renderPage()
    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
    unmount()

    render(
      <MemoryRouter>
        <QiblaPage backTo="/" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('names the place the direction is worked out from', () => {
    installNoCompass()
    renderPage()
    expect(shown(/^From .*Cairo, Egypt/)).toBeInTheDocument()
  })

  it('gives the bearing in degrees and words, and the distance', () => {
    installNoCompass()
    renderPage()
    expect(screen.getByRole('heading', { name: 'Qibla direction' })).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'P' && plain(element.textContent) === '136°')).toBeInTheDocument()
    expect(shown('Clockwise from true north, toward the southeast')).toBeInTheDocument()
    expect(shown('1,287 km to the Kaaba')).toBeInTheDocument()
  })

  describe('without a compass', () => {
    it('draws a still dial with north at the top and the arrow at the bearing, and explains it', () => {
      installNoCompass()
      renderPage()
      expect(plain(dial().getAttribute('aria-label'))).toBe('Compass dial, with the Qibla arrow at 136° from north')
      expect(cardTurn()).toBe('rotate(0 120 136)')
      expect(qiblaMark()).toBe('rotate(136.14 120 136)')
      expect(shown(/doesn’t share a compass heading/)).toBeInTheDocument()
      expect(shown(/Point the top of your phone north/)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      // The magnetic-north note is about a live compass, which there is not.
      expect(queryShown(/magnetic north/)).not.toBeInTheDocument()
    })

    it('does the same on a desktop', () => {
      installFakeCompass({ ask: 'granted', touchPoints: 0 })
      renderPage()
      expect(cardTurn()).toBe('rotate(0 120 136)')
      expect(shown(/Point the top of your phone north/)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('falls back when no heading arrives, as in the iOS simulator', () => {
      vi.useFakeTimers()
      installFakeCompass()
      renderPage()
      expect(shown('Waiting for the compass…')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(5000))
      expect(shown(/No compass heading has arrived/)).toBeInTheDocument()
      expect(shown(/Point the top of your phone north/)).toBeInTheDocument()
    })
  })

  describe('in Safari and the iOS app', () => {
    it('turns the compass on from a button press, and moves the focus to what replaces the button', async () => {
      const { requestPermission } = installFakeCompass({ ask: 'granted' })
      renderPage()
      expect(shown(/You’ll be asked to allow access to motion and orientation/)).toBeInTheDocument()
      expect(shown(/magnetic north/)).toBeInTheDocument()
      expect(requestPermission).not.toHaveBeenCalled()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Turn on compass' }))
      })
      expect(requestPermission).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button', { name: 'Turn on compass' })).not.toBeInTheDocument()
      expect(shown('Waiting for the compass…')).toBeInTheDocument()
      expect(document.activeElement).toHaveTextContent('Waiting for the compass…')

      emitSafariHeading(BEARING - 30)
      expect(plain(shown(/^Turn right/).textContent)).toBe('Turn right 30°')
    })

    it('explains a refusal and keeps the still dial, with the way back in a browser', async () => {
      installFakeCompass({ ask: 'denied' })
      renderPage()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Turn on compass' }))
      })
      // Safari remembers a refusal for as long as it runs, so a reload alone would only be refused again.
      expect(shown(/close your browser completely, open this page again and turn on the compass/)).toBeInTheDocument()
      expect(queryShown(/reload/)).not.toBeInTheDocument()
      expect(shown(/Point the top of your phone north/)).toBeInTheDocument()
      expect(cardTurn()).toBe('rotate(0 120 136)')
    })

    it('promises no prompt in the app, whose web view gives access without one', () => {
      vi.mocked(isNativeApp).mockReturnValue(true)
      installFakeCompass({ ask: 'granted' })
      renderPage()
      expect(shown('Turn on the compass and the dial will turn with your phone.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Turn on compass' })).toBeInTheDocument()
    })

    it('explains a refusal with the way back in the app', async () => {
      vi.mocked(isNativeApp).mockReturnValue(true)
      installFakeCompass({ ask: 'denied' })
      renderPage()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Turn on compass' }))
      })
      expect(shown(/close the app completely, open it again/)).toBeInTheDocument()
    })

    it('asks for calibration when the compass is unsure, and only then', () => {
      spaceReadings()
      installFakeCompass({ ask: 'granted' })
      renderPage()
      emitSafariHeading(10, 10)
      expect(queryShown(/figure-eight/)).not.toBeInTheDocument()
      emitSafariHeading(10, 45)
      expect(shown(/figure-eight/)).toBeInTheDocument()
      emitSafariHeading(10, -1)
      expect(shown(/figure-eight/)).toBeInTheDocument()
      emitSafariHeading(10, 15)
      expect(queryShown(/figure-eight/)).not.toBeInTheDocument()
    })
  })

  describe('with a live compass', () => {
    it('turns the card against the heading and says which way to turn', () => {
      spaceReadings()
      installFakeCompass()
      renderPage()
      emitChromeHeading(100)
      expect(cardTurn()).toBe('rotate(-100 120 136)')
      expect(qiblaMark()).toBe('rotate(136.14 120 136)')
      expect(plain(shown(/^Turn/).textContent)).toBe('Turn right 36°')

      emitChromeHeading(200)
      expect(plain(shown(/^Turn/).textContent)).toBe('Turn left 64°')

      // Across north: from 350° the Qibla is 146° to the right, not 214° to the left.
      emitChromeHeading(350)
      expect(plain(shown(/^Turn/).textContent)).toBe('Turn right 146°')
    })

    it('shows when the phone faces the Qibla, with a single haptic each time it comes into line', () => {
      spaceReadings()
      installFakeCompass()
      renderPage()
      emitChromeHeading(BEARING - 40)
      expect(dial()).toHaveAttribute('data-aligned', 'false')
      expect(haptic).not.toHaveBeenCalled()

      emitChromeHeading(BEARING + 2)
      expect(shown('You’re facing the Qibla')).toBeInTheDocument()
      expect(dial()).toHaveAttribute('data-aligned', 'true')
      expect(haptic).toHaveBeenCalledTimes(1)
      expect(haptic).toHaveBeenCalledWith('done')

      // Wavering inside the margin keeps the state and gives no more haptics.
      emitChromeHeading(BEARING - 4)
      emitChromeHeading(BEARING + 1)
      emitChromeHeading(BEARING + 4.5)
      expect(shown('You’re facing the Qibla')).toBeInTheDocument()
      expect(haptic).toHaveBeenCalledTimes(1)

      emitChromeHeading(BEARING + 20)
      expect(queryShown('You’re facing the Qibla')).not.toBeInTheDocument()
      expect(plain(shown(/^Turn/).textContent)).toBe('Turn left 20°')

      emitChromeHeading(BEARING)
      expect(shown('You’re facing the Qibla')).toBeInTheDocument()
      expect(haptic).toHaveBeenCalledTimes(2)
    })

    it('tells a screen reader how far to turn at a restrained rate, and at once when it comes into line', () => {
      vi.useFakeTimers()
      spaceReadings()
      installFakeCompass()
      renderPage()
      emitChromeHeading(BEARING - 30)
      act(() => vi.advanceTimersByTime(0))
      expect(announcement()).toBe('Turn right 30°')

      emitChromeHeading(BEARING - 25)
      emitChromeHeading(BEARING - 20)
      act(() => vi.advanceTimersByTime(ANNOUNCE_EVERY_MS - 100))
      expect(announcement()).toBe('Turn right 30°')
      act(() => vi.advanceTimersByTime(100))
      // Only the latest of the readings in between is read out.
      expect(announcement()).toBe('Turn right 20°')

      emitChromeHeading(BEARING - 1)
      act(() => vi.advanceTimersByTime(0))
      expect(announcement()).toBe('You’re facing the Qibla')
    })
  })

  describe('in Arabic', () => {
    it('keeps the dial unmirrored, east on the right, and words the page in Arabic', () => {
      spaceReadings()
      installFakeCompass()
      renderPage({ settings: { language: 'ar', arabicDigits: true } })
      const letter = (text: string) => Number(screen.getByText(text, { selector: 'text' }).getAttribute('x'))
      expect(letter('ق')).toBeGreaterThan(120)
      expect(letter('غ')).toBeLessThan(120)
      expect(Number(screen.getByText('ش', { selector: 'text' }).getAttribute('y'))).toBeLessThan(136)

      expect(screen.getByRole('heading', { name: 'اتجاه القبلة' })).toBeInTheDocument()
      expect(shown('مقيسًا من الشمال الجغرافي مع اتجاه عقارب الساعة، نحو الجنوب الشرقي')).toBeInTheDocument()
      expect(shown('تبعد عنك الكعبة ١٬٢٨٧ كم')).toBeInTheDocument()

      emitChromeHeading(BEARING - 30)
      const instruction = shown(/^استدر/)
      expect(plain(instruction.textContent)).toBe('استدر يمينًا ٣٠°')
      // The degrees are isolated, so the sign stays after the digits in a right-to-left line.
      expect(instruction.textContent).toContain('⁦٣٠°⁩')
    })
  })

  it('does not offer a bearing within a kilometre of the Kaaba', () => {
    installFakeCompass()
    renderPage({ location: { ...CAIRO, latitude: KAABA.latitude, longitude: KAABA.longitude, label: 'Makkah' } })
    expect(screen.getByRole('heading', { name: 'You’re close to the Kaaba' })).toBeInTheDocument()
    expect(shown(/face the Kaaba itself/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('near the Kaaba', () => {
    // Open-Meteo's "Mecca": what a city search saves, 0.46 km from the Kaaba, for anyone anywhere in the city.
    const MAKKAH: SavedLocation = { ...CAIRO, latitude: 21.42664, longitude: 39.82563, label: 'Mecca, Saudi Arabia', countryCode: 'SA' }

    it('says so plainly when the location is the phone’s own', () => {
      installFakeCompass()
      renderPage({ location: { ...MAKKAH, source: 'gps' } })
      expect(shown(/^You’re less than a kilometre from the Kaaba/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Open settings' })).not.toBeInTheDocument()
    })

    it('does not claim the user is beside the Kaaba when the place was picked by name, and offers their exact location', () => {
      installFakeCompass()
      renderPage({ location: { ...MAKKAH, source: 'manual' } })
      expect(queryShown(/^You’re less than a kilometre/)).not.toBeInTheDocument()
      expect(shown(/^Your saved location is less than a kilometre from the Kaaba.*face the Kaaba itself.*Use my location/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings')
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('words both cases in Arabic', () => {
      installFakeCompass()
      renderPage({ location: { ...MAKKAH, source: 'manual' }, settings: { language: 'ar' } })
      expect(shown(/^موقعك المحفوظ على بُعد أقل من كيلومتر من الكعبة/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'فتح الإعدادات' })).toHaveAttribute('href', '/settings')
    })
  })
})
