import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalculationSettingsSection } from './CalculationSettingsSection'
import { DEFAULT_UNLOGGED_REMINDERS, usePrayerTimesStore } from './config'
import { NotificationSettingsSection } from './NotificationSettingsSection'
import { CAIRO, resetStores, TROMSO, UNLOGGED_OFF } from './test-helpers'

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

  describe('azkar reminders', () => {
    const morning = () => screen.getByRole('switch', { name: 'Remind me of the morning azkar' })
    const evening = () => screen.getByRole('switch', { name: 'Remind me of the evening azkar' })

    it('switches each on and off on its own, asking for permission like the prayer reminders', async () => {
      const user = userEvent.setup()
      const api = stubNotification('default', 'granted')
      render(<NotificationSettingsSection />)
      expect(screen.getByText('When Asr begins')).toBeInTheDocument()

      await user.click(evening())
      await waitFor(() => expect(evening()).toBeChecked())
      expect(api.requestPermission).toHaveBeenCalledTimes(1)
      expect(settings().azkarReminders).toEqual({ morning: false, evening: true, morningAt: 'fajr' })
      expect(morning()).not.toBeChecked()
      expect(toggle()).not.toBeChecked()

      await user.click(morning())
      await waitFor(() => expect(morning()).toBeChecked())
      await user.click(evening())
      expect(settings().azkarReminders).toEqual({ morning: true, evening: false, morningAt: 'fajr' })
    })

    it('stays off and shows the browser advice when notifications are blocked', async () => {
      const user = userEvent.setup()
      stubNotification('denied')
      render(<NotificationSettingsSection />)
      await user.click(morning())
      expect(await screen.findByRole('alert')).toHaveTextContent(/Allow them in your browser’s site settings/)
      expect(settings().azkarReminders.morning).toBe(false)
    })

    it('lets the morning reminder come at Fajr or after sunrise', async () => {
      const user = userEvent.setup()
      stubNotification('granted')
      render(<NotificationSettingsSection />)
      expect(screen.queryByRole('radiogroup', { name: 'Morning reminder' })).toBeNull()
      await user.click(morning())
      const choice = await screen.findByRole('radiogroup', { name: 'Morning reminder' })
      await user.click(within(choice).getByRole('radio', { name: 'After sunrise' }))
      expect(settings().azkarReminders.morningAt).toBe('sunrise')
      expect(within(choice).getByRole('radio', { name: 'After sunrise' })).toBeChecked()
    })

    it('shows them off when the stored wish has no permission behind it', () => {
      stubNotification('default')
      resetStores({ location: CAIRO, prayerTimes: { azkarReminders: { morning: true, evening: true, morningAt: 'sunrise' } } })
      render(<NotificationSettingsSection />)
      expect(morning()).not.toBeChecked()
      expect(evening()).not.toBeChecked()
      expect(screen.queryByRole('radiogroup', { name: 'Morning reminder' })).toBeNull()
    })
  })

  describe('reminders of prayers not logged yet', () => {
    const unloggedSwitch = () => screen.getByRole('switch', { name: 'Remind me of prayers I haven’t logged' })
    const leadSelect = () => screen.queryByRole('combobox', { name: 'How long before the time ends' })
    const ishaChoice = () => screen.queryByRole('radiogroup', { name: 'End of Isha’s time' })
    const withDefaults = () => resetStores({ location: CAIRO, prayerTimes: { unloggedReminders: DEFAULT_UNLOGGED_REMINDERS } })

    it('are on by default once reminders are allowed, fifteen minutes before the end, with Isha at the middle of the night', () => {
      stubNotification('granted')
      withDefaults()
      render(<NotificationSettingsSection />)
      expect(unloggedSwitch()).toBeChecked()
      expect(screen.getByText('15 minutes before a prayer’s time ends, if it isn’t logged yet')).toBeInTheDocument()
      expect(leadSelect()).toHaveValue('15')
      expect(within(leadSelect()!).getAllByRole('option').map((option) => option.textContent)).toEqual([
        '10 minutes',
        '15 minutes',
        '30 minutes',
        '45 minutes',
        '1 hour',
      ])
      expect(within(ishaChoice()!).getByRole('radio', { name: 'Middle of the night' })).toBeChecked()
      expect(screen.getByText(/halfway from Maghrib to Fajr.*according to a hadith in Sahih Muslim/)).toBeInTheDocument()
    })

    it('show off, without their choices, until reminders are allowed', () => {
      stubNotification('default')
      withDefaults()
      render(<NotificationSettingsSection />)
      expect(unloggedSwitch()).not.toBeChecked()
      expect(leadSelect()).toBeNull()
      expect(ishaChoice()).toBeNull()
      // The wish is kept for when they are.
      expect(settings().unloggedReminders.enabled).toBe(true)
    })

    it('ask for permission when switched on, like the other reminders', async () => {
      const user = userEvent.setup()
      const api = stubNotification('default', 'granted')
      render(<NotificationSettingsSection />)
      expect(settings().unloggedReminders).toEqual(UNLOGGED_OFF)
      await user.click(unloggedSwitch())
      await waitFor(() => expect(unloggedSwitch()).toBeChecked())
      expect(api.requestPermission).toHaveBeenCalledTimes(1)
      expect(settings().unloggedReminders.enabled).toBe(true)
      // The prayer-time reminders stay as they were.
      expect(toggle()).not.toBeChecked()
    })

    it('stay off and say why when notifications are blocked', async () => {
      const user = userEvent.setup()
      stubNotification('default', 'denied')
      render(<NotificationSettingsSection />)
      await user.click(unloggedSwitch())
      expect(await screen.findByRole('alert')).toHaveTextContent(/Notifications are blocked for this app/)
      expect(settings().unloggedReminders.enabled).toBe(false)
      expect(unloggedSwitch()).not.toBeChecked()
    })

    it('can be switched off, which hides their choices', async () => {
      const user = userEvent.setup()
      stubNotification('granted')
      withDefaults()
      render(<NotificationSettingsSection />)
      await user.click(unloggedSwitch())
      expect(settings().unloggedReminders).toEqual({ ...DEFAULT_UNLOGGED_REMINDERS, enabled: false })
      expect(leadSelect()).toBeNull()
      expect(ishaChoice()).toBeNull()
    })

    it('store how long before the end they come, and say it', async () => {
      const user = userEvent.setup()
      stubNotification('granted')
      withDefaults()
      render(<NotificationSettingsSection />)
      await user.selectOptions(leadSelect()!, '45 minutes')
      expect(settings().unloggedReminders.leadMinutes).toBe(45)
      expect(leadSelect()).toHaveValue('45')
      expect(screen.getByText('45 minutes before a prayer’s time ends, if it isn’t logged yet')).toBeInTheDocument()
      await user.selectOptions(leadSelect()!, '1 hour')
      expect(settings().unloggedReminders.leadMinutes).toBe(60)
      expect(screen.getByText('1 hour before a prayer’s time ends, if it isn’t logged yet')).toBeInTheDocument()
    })

    it('let Isha’s reminder count to Fajr instead', async () => {
      const user = userEvent.setup()
      stubNotification('granted')
      withDefaults()
      render(<NotificationSettingsSection />)
      await user.click(within(ishaChoice()!).getByRole('radio', { name: 'Fajr' }))
      expect(settings().unloggedReminders.ishaEnds).toBe('fajr')
      expect(within(ishaChoice()!).getByRole('radio', { name: 'Fajr' })).toBeChecked()
      await user.click(within(ishaChoice()!).getByRole('radio', { name: 'Middle of the night' }))
      expect(settings().unloggedReminders.ishaEnds).toBe('middle')
    })

    it('are fully translated into Arabic, with Arabic plurals and digits', () => {
      stubNotification('granted')
      resetStores({ location: CAIRO, settings: { language: 'ar' }, prayerTimes: { unloggedReminders: DEFAULT_UNLOGGED_REMINDERS } })
      render(<NotificationSettingsSection />)
      expect(screen.getByRole('switch', { name: 'التذكير بالصلوات غير المسجَّلة' })).toBeChecked()
      expect(screen.getByText('قبل خروج وقت الصلاة بـ١٥ دقيقة إن لم تُسجَّل بعد')).toBeInTheDocument()
      const lead = screen.getByRole('combobox', { name: 'مدة التذكير قبل خروج الوقت' })
      expect(within(lead).getAllByRole('option').map((option) => option.textContent)).toEqual([
        '١٠ دقائق',
        '١٥ دقيقة',
        '٣٠ دقيقة',
        '٤٥ دقيقة',
        'ساعة واحدة',
      ])
      const isha = screen.getByRole('radiogroup', { name: 'نهاية وقت العشاء' })
      expect(within(isha).getByRole('radio', { name: 'منتصف الليل' })).toBeChecked()
      expect(within(isha).getByRole('radio', { name: 'الفجر' })).not.toBeChecked()
      expect(screen.getByText(/آخر الوقت المختار لصلاة العشاء بحسب حديث في صحيح مسلم/)).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'التنبيهات' })).not.toHaveTextContent(/times\.|[A-Za-z]{4,}/)
    })
  })
})
