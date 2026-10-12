import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalculationSettingsSection } from './CalculationSettingsSection'
import { usePrayerTimesStore } from './config'
import { NotificationSettingsSection } from './NotificationSettingsSection'
import { CAIRO, resetStores, TROMSO } from './test-helpers'

const settings = () => usePrayerTimesStore.getState()

beforeEach(() => {
  resetStores({ location: CAIRO })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CalculationSettingsSection', () => {
  const methodSelect = () => screen.getByRole('combobox', { name: 'Calculation method' })

  it('shows which method "Automatic" stands for at the saved location', () => {
    render(<CalculationSettingsSection />)
    expect(methodSelect()).toHaveValue('auto')
    expect(screen.getByText('Automatic uses Egyptian General Authority of Survey here')).toBeInTheDocument()
    expect(screen.getByText('Fajr 19.5° · Isha 17.5°')).toBeInTheDocument()
  })

  it('follows the country of the saved location', () => {
    resetStores({ location: { ...CAIRO, countryCode: 'MY', timeZone: 'Asia/Kuala_Lumpur' } })
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses University of Islamic Sciences, Karachi here')).toBeInTheDocument()
    expect(screen.getByText('Fajr 18° · Isha 18°')).toBeInTheDocument()
  })

  it('says what it uses before a location is set', () => {
    resetStores()
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses Muslim World League until a location is set')).toBeInTheDocument()
  })

  it('lists every method and stores the chosen one', async () => {
    const user = userEvent.setup()
    render(<CalculationSettingsSection />)
    const options = within(methodSelect()).getAllByRole('option')
    expect(options).toHaveLength(13)
    expect(options[0]).toHaveTextContent('Automatic')

    await user.selectOptions(methodSelect(), 'Umm al-Qura, Makkah')
    expect(settings().method).toBe('UmmAlQura')
    // (The Asr row has an "Automatic uses … here" line of its own.)
    expect(screen.queryByText(/^Automatic uses .*(Survey|Makkah).* here$/)).toBeNull()
    expect(screen.getByText('Fajr 18.5° · Isha 90 minutes after Maghrib, 120 in Ramadan')).toBeInTheDocument()

    await user.selectOptions(methodSelect(), 'Qatar')
    expect(screen.getByText('Fajr 18° · Isha 90 minutes after Maghrib')).toBeInTheDocument()
  })

  describe('Asr school', () => {
    const group = () => screen.getByRole('radiogroup', { name: 'Asr time' })
    const option = (name: string) => within(group()).getByRole('radio', { name })

    it('offers Automatic, Standard and Hanafi, with Automatic chosen on a new install', () => {
      render(<CalculationSettingsSection />)
      expect(within(group()).getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual([
        'Automatic',
        'Standard',
        'Hanafi',
      ])
      expect(option('Automatic')).toBeChecked()
      expect(settings().madhab).toBe('auto')
    })

    it('says what Automatic stands for at the saved location, like the method row', () => {
      render(<CalculationSettingsSection />)
      expect(screen.getByText('Automatic uses Standard here')).toBeInTheDocument()
    })

    it('follows the country of the saved location to the Hanafi Asr', () => {
      resetStores({ location: { ...CAIRO, latitude: 24.8607, longitude: 67.0011, countryCode: 'PK', timeZone: 'Asia/Karachi' } })
      render(<CalculationSettingsSection />)
      expect(screen.getByText('Automatic uses Hanafi here')).toBeInTheDocument()
      // Known only by its time zone, as after a fix taken offline.
      act(() => resetStores({ location: { ...CAIRO, countryCode: null, timeZone: 'Asia/Dhaka' } }))
      expect(screen.getByText('Automatic uses Hanafi here')).toBeInTheDocument()
      // Turkey's own timetable uses the standard Asr.
      act(() => resetStores({ location: { ...CAIRO, countryCode: 'TR', timeZone: 'Europe/Istanbul' } }))
      expect(screen.getByText('Automatic uses Standard here')).toBeInTheDocument()
    })

    it('says what Automatic uses before a location is set', () => {
      resetStores()
      render(<CalculationSettingsSection />)
      expect(screen.getByText('Automatic uses Standard until a location is set')).toBeInTheDocument()
    })

    it('stores an explicit school and stops describing Automatic', async () => {
      const user = userEvent.setup()
      render(<CalculationSettingsSection />)
      await user.click(option('Hanafi'))
      expect(settings().madhab).toBe('hanafi')
      expect(option('Hanafi')).toBeChecked()
      expect(screen.queryByText(/^Automatic uses (Standard|Hanafi)/)).toBeNull()

      await user.click(option('Standard'))
      expect(settings().madhab).toBe('shafi')
      await user.click(option('Automatic'))
      expect(settings().madhab).toBe('auto')
      expect(screen.getByText('Automatic uses Standard here')).toBeInTheDocument()
    })

    it('shows a stored Standard as chosen even where Automatic would be Hanafi', () => {
      resetStores({
        location: { ...CAIRO, countryCode: 'PK', timeZone: 'Asia/Karachi' },
        prayerTimes: { madhab: 'shafi' },
      })
      render(<CalculationSettingsSection />)
      expect(option('Standard')).toBeChecked()
      expect(screen.queryByText(/^Automatic uses (Standard|Hanafi)/)).toBeNull()
      expect(screen.getByText('Automatic uses University of Islamic Sciences, Karachi here')).toBeInTheDocument()
    })
  })

  it('explains the automatic high-latitude rule and stores an explicit one', async () => {
    const user = userEvent.setup()
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses “Twilight angle”.')).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: 'High-latitude rule' })
    await user.selectOptions(select, 'One-seventh of the night')
    expect(settings().highLatitudeRule).toBe('seventhofthenight')
    expect(screen.queryByText(/Automatic uses “/)).toBeNull()
  })

  it('offers the polar option only where the sun can fail to rise or set', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CalculationSettingsSection />)
    expect(screen.queryByRole('switch', { name: 'Polar day and night' })).toBeNull()
    unmount()

    resetStores({ location: TROMSO })
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses “Twilight angle”.')).toBeInTheDocument()
    const polar = screen.getByRole('switch', { name: 'Polar day and night' })
    expect(polar).not.toBeChecked()
    await user.click(polar)
    expect(settings().polar).toBe('nearestLatitude')
  })

  it('keeps the polar option visible while it is on, so it can be turned off after moving', () => {
    resetStores({ location: CAIRO, prayerTimes: { polar: 'nearestLatitude' } })
    render(<CalculationSettingsSection />)
    expect(screen.getByRole('switch', { name: 'Polar day and night' })).toBeChecked()
  })

  it('adjusts individual times in a sheet and summarises them', async () => {
    const user = userEvent.setup()
    render(<CalculationSettingsSection />)
    expect(screen.getByText('No adjustments')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    const dialog = screen.getByRole('dialog', { name: 'Fine-tune times' })
    const fajr = within(dialog).getByRole('group', { name: 'Fajr, minutes' })
    await user.click(within(fajr).getByRole('button', { name: 'Increase' }))
    await user.click(within(fajr).getByRole('button', { name: 'Increase' }))
    const isha = within(dialog).getByRole('group', { name: 'Isha, minutes' })
    await user.click(within(isha).getByRole('button', { name: 'Decrease' }))

    expect(settings().adjustments).toMatchObject({ fajr: 2, isha: -1, dhuhr: 0 })
    expect(within(fajr).getByRole('status')).toHaveTextContent('+2')
    expect(within(isha).getByRole('status')).toHaveTextContent('-1')
    expect(within(dialog).getAllByRole('group')).toHaveLength(6)

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Fajr +2, Isha -1 (minutes)')).toBeInTheDocument()
  })

  it('stops at thirty minutes either way and resets everything at once', async () => {
    const user = userEvent.setup()
    resetStores({ location: CAIRO, prayerTimes: { adjustments: { fajr: 30, sunrise: 0, dhuhr: 0, asr: -30, maghrib: 0, isha: 4 } } })
    render(<CalculationSettingsSection />)
    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    const dialog = screen.getByRole('dialog')

    // The shared stepper marks a button at its limit aria-disabled (it keeps keyboard focus) and ignores presses on it.
    const fajrUp = within(within(dialog).getByRole('group', { name: 'Fajr, minutes' })).getByRole('button', { name: 'Increase' })
    const asrDown = within(within(dialog).getByRole('group', { name: 'Asr, minutes' })).getByRole('button', { name: 'Decrease' })
    expect(fajrUp).toHaveAttribute('aria-disabled', 'true')
    expect(asrDown).toHaveAttribute('aria-disabled', 'true')
    await user.click(fajrUp)
    await user.click(asrDown)
    expect(settings().adjustments).toMatchObject({ fajr: 30, asr: -30 })

    await user.click(within(dialog).getByRole('button', { name: 'Reset all to zero' }))
    expect(Object.values(settings().adjustments)).toEqual([0, 0, 0, 0, 0, 0])
    expect(within(dialog).getByRole('button', { name: 'Reset all to zero' })).toBeDisabled()
  })

  it('tells users to match their local mosque', () => {
    render(<CalculationSettingsSection />)
    expect(screen.getByText(/methods differ from region to region.*your local mosque/)).toBeInTheDocument()
  })

  it('is fully translated', () => {
    resetStores({ location: CAIRO, settings: { language: 'ar' } })
    render(<CalculationSettingsSection />)
    expect(screen.getByRole('region', { name: 'حساب مواقيت الصلاة' })).toBeInTheDocument()
    expect(screen.getByText('المعتمَد تلقائيًا هنا: الهيئة المصرية العامة للمساحة')).toBeInTheDocument()
    expect(screen.getByText('المعتمَد تلقائيًا هنا: الجمهور')).toBeInTheDocument()
    expect(within(screen.getByRole('radiogroup', { name: 'وقت العصر' })).getByRole('radio', { name: 'تلقائي' })).toBeChecked()
    expect(screen.getByText('الفجر ١٩٫٥° · العشاء ١٧٫٥°')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/times\.|[A-Za-z]{4,}/)
  })
})

describe('NotificationSettingsSection', () => {
  function stubNotification(initial: NotificationPermission, answer: NotificationPermission = initial) {
    const api = {
      permission: initial,
      requestPermission: vi.fn(async () => {
        api.permission = answer
        return answer
      }),
    }
    vi.stubGlobal('Notification', api)
    return api
  }

  const toggle = () => screen.getByRole('switch', { name: 'Notify me at prayer times' })

  it('is absent where the browser has no notifications', () => {
    vi.stubGlobal('Notification', undefined)
    const { container } = render(<NotificationSettingsSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is honest that reminders need the app to be open', () => {
    stubNotification('default')
    render(<NotificationSettingsSection />)
    expect(screen.getByText(/only while Azkar is open or in a background tab/)).toBeInTheDocument()
    expect(screen.getByText(/can’t alert you once it is closed/)).toBeInTheDocument()
    expect(toggle()).not.toBeChecked()
  })

  it('asks for permission when switched on and turns on once granted', async () => {
    const user = userEvent.setup()
    const api = stubNotification('default', 'granted')
    render(<NotificationSettingsSection />)

    expect(api.requestPermission).not.toHaveBeenCalled()
    await user.click(toggle())
    await waitFor(() => expect(toggle()).toBeChecked())
    expect(api.requestPermission).toHaveBeenCalledTimes(1)
    expect(settings().notifications).toBe(true)

    await user.click(toggle())
    expect(settings().notifications).toBe(false)
    expect(toggle()).not.toBeChecked()
  })

  it('stays off and explains how to unblock when permission is denied', async () => {
    const user = userEvent.setup()
    stubNotification('default', 'denied')
    render(<NotificationSettingsSection />)

    await user.click(toggle())
    expect(await screen.findByText(/Notifications are blocked for this app/)).toBeInTheDocument()
    expect(settings().notifications).toBe(false)
    expect(toggle()).not.toBeChecked()
  })

  it('shows the guidance straight away when already blocked, without asking again', async () => {
    const user = userEvent.setup()
    const api = stubNotification('denied')
    render(<NotificationSettingsSection />)
    expect(screen.getByText(/Allow them in your browser’s site settings/)).toBeInTheDocument()
    await user.click(toggle())
    expect(api.requestPermission).not.toHaveBeenCalled()
    expect(settings().notifications).toBe(false)
  })

  it('does not interrupt a screen reader on arrival when notifications are already blocked', () => {
    stubNotification('denied')
    render(<NotificationSettingsSection />)
    expect(screen.getByText(/Notifications are blocked for this app/)).toBeInTheDocument()
    // Nobody did anything yet: the notice is there to be read, not announced over the page heading.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces the block as the answer to switching reminders on, each time', async () => {
    const user = userEvent.setup()
    stubNotification('denied')
    render(<NotificationSettingsSection />)

    await user.click(toggle())
    const first = await screen.findByRole('alert')
    expect(first).toHaveTextContent(/Notifications are blocked for this app/)

    // A second try puts a new alert in, since one that is already there would not be read out again.
    await user.click(toggle())
    await waitFor(() => expect(first).not.toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/Notifications are blocked for this app/)
    expect(screen.getAllByText(/Notifications are blocked for this app/)).toHaveLength(1)
  })

  it('goes back to plain information once the block has been lifted and set again in the browser', async () => {
    const user = userEvent.setup()
    const api = stubNotification('denied')
    render(<NotificationSettingsSection />)
    await user.click(toggle())
    await screen.findByRole('alert')

    const returnWith = (permission: NotificationPermission) => {
      api.permission = permission
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
    }
    returnWith('default')
    expect(screen.queryByText(/Notifications are blocked for this app/)).toBeNull()
    returnWith('denied')
    expect(screen.getByText(/Notifications are blocked for this app/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces a refusal given in the browser’s own prompt', async () => {
    const user = userEvent.setup()
    stubNotification('default', 'denied')
    render(<NotificationSettingsSection />)
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(toggle())
    expect(await screen.findByRole('alert')).toHaveTextContent(/Notifications are blocked for this app/)
  })

  it('stays off when the prompt is dismissed', async () => {
    const user = userEvent.setup()
    stubNotification('default', 'default')
    render(<NotificationSettingsSection />)
    await user.click(toggle())
    expect(await screen.findByText('Permission wasn’t given, so reminders stay off.')).toBeInTheDocument()
    expect(settings().notifications).toBe(false)
  })

  it('shows off when the stored wish has no permission behind it, as after restoring a backup elsewhere', () => {
    stubNotification('default')
    resetStores({ location: CAIRO, prayerTimes: { notifications: true } })
    render(<NotificationSettingsSection />)
    expect(toggle()).not.toBeChecked()
  })

  it('turns on without a prompt when permission already exists', async () => {
    const user = userEvent.setup()
    const api = stubNotification('granted')
    render(<NotificationSettingsSection />)
    await user.click(toggle())
    await waitFor(() => expect(settings().notifications).toBe(true))
    expect(api.requestPermission).not.toHaveBeenCalled()
  })
})
