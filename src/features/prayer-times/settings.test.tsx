import { render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.queryByText(/^Automatic uses .* here$/)).toBeNull()
    expect(screen.getByText('Fajr 18.5° · Isha 90 minutes after Maghrib, 120 in Ramadan')).toBeInTheDocument()

    await user.selectOptions(methodSelect(), 'Qatar')
    expect(screen.getByText('Fajr 18° · Isha 90 minutes after Maghrib')).toBeInTheDocument()
  })

  it('switches the Asr school', async () => {
    const user = userEvent.setup()
    render(<CalculationSettingsSection />)
    const group = screen.getByRole('radiogroup', { name: 'Asr time' })
    expect(within(group).getByRole('radio', { name: 'Standard' })).toBeChecked()
    await user.click(within(group).getByRole('radio', { name: 'Hanafi' }))
    expect(settings().madhab).toBe('hanafi')
  })

  it('explains the automatic high-latitude rule and stores an explicit one', async () => {
    const user = userEvent.setup()
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses “Middle of the night” at your latitude.')).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: 'High-latitude rule' })
    await user.selectOptions(select, 'Twilight angle')
    expect(settings().highLatitudeRule).toBe('twilightangle')
    expect(screen.queryByText(/at your latitude/)).toBeNull()
  })

  it('offers the polar option only where the sun can fail to rise or set', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CalculationSettingsSection />)
    expect(screen.queryByRole('switch', { name: 'Polar day and night' })).toBeNull()
    unmount()

    resetStores({ location: TROMSO })
    render(<CalculationSettingsSection />)
    expect(screen.getByText('Automatic uses “One-seventh of the night” at your latitude.')).toBeInTheDocument()
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

    expect(within(within(dialog).getByRole('group', { name: 'Fajr, minutes' })).getByRole('button', { name: 'Increase' })).toBeDisabled()
    expect(within(within(dialog).getByRole('group', { name: 'Asr, minutes' })).getByRole('button', { name: 'Decrease' })).toBeDisabled()

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
