import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../../shared/settings'
import { usePrayerTimesStore } from '../config'
import { bringToForeground, device, LocalNotifications, resetDevice } from '../native-fakes'
import { NotificationSettingsSection } from '../NotificationSettingsSection'
import { CAIRO, resetStores } from '../test-helpers'

vi.mock('@capacitor/core', async (original) => (await import('../native-fakes')).mockCore(await original()))
vi.mock('@capacitor/local-notifications', async () => (await import('../native-fakes')).localNotificationsModule)
vi.mock('@capacitor/app', async () => (await import('../native-fakes')).appModule)

const settings = () => usePrayerTimesStore.getState()
const prayerSwitch = () => screen.getByRole('switch', { name: 'Notify me at prayer times' })
const morningSwitch = () => screen.getByRole('switch', { name: 'Remind me of the morning azkar' })
const eveningSwitch = () => screen.getByRole('switch', { name: 'Remind me of the evening azkar' })
const IOS_DENIED = /Notifications are turned off for Azkar\. To allow them, open the Settings app, find Azkar, tap Notifications and turn on Allow Notifications/
const ANDROID_DENIED = /open your phone’s Settings, go to Apps, choose Azkar, tap Notifications and turn them on/

beforeEach(() => {
  resetDevice('ios')
  resetStores({ location: CAIRO })
  // The app's web view has no web notifications at all; the section must not depend on them.
  vi.stubGlobal('Notification', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NotificationSettingsSection in the installed app', () => {
  it('is there although the web view has no web notifications, and says reminders come with the app closed', async () => {
    device.notifications = 'prompt'
    render(<NotificationSettingsSection />)
    expect(await screen.findByText(/arrive even when Azkar is closed/)).toBeInTheDocument()
    expect(screen.getByText(/renewed each time you open the app/)).toBeInTheDocument()
    expect(screen.queryByText(/only while Azkar is open/)).toBeNull()
    expect(screen.queryByText(/can’t alert you once it is closed/)).toBeNull()
    expect(prayerSwitch()).not.toBeChecked()
    expect(morningSwitch()).not.toBeChecked()
    expect(eveningSwitch()).not.toBeChecked()
  })

  it('asks the system when switched on, and turns on once allowed', async () => {
    const user = userEvent.setup()
    device.notifications = 'prompt'
    render(<NotificationSettingsSection />)
    await user.click(prayerSwitch())
    await waitFor(() => expect(prayerSwitch()).toBeChecked())
    expect(LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1)
    expect(settings().notifications).toBe(true)
  })

  it('explains how to allow notifications in the iOS Settings app when refused', async () => {
    const user = userEvent.setup()
    device.notifications = 'prompt'
    device.notificationAnswer = 'denied'
    render(<NotificationSettingsSection />)
    await user.click(eveningSwitch())
    expect(await screen.findByRole('alert')).toHaveTextContent(IOS_DENIED)
    expect(settings().azkarReminders.evening).toBe(false)
    expect(eveningSwitch()).not.toBeChecked()
    // The browser's advice would be wrong here.
    expect(screen.queryByText(/browser’s site settings/)).toBeNull()
  })

  it('uses Android’s own words on Android', async () => {
    resetDevice('android')
    device.notifications = 'denied'
    render(<NotificationSettingsSection />)
    expect(await screen.findByText(ANDROID_DENIED)).toBeInTheDocument()
    // Standing information, not announced on arrival.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says so when the prompt was dismissed without an answer', async () => {
    const user = userEvent.setup()
    resetDevice('android')
    device.notifications = 'prompt'
    device.notificationAnswer = 'prompt'
    render(<NotificationSettingsSection />)
    await user.click(morningSwitch())
    expect(await screen.findByText('Permission wasn’t given, so reminders stay off.')).toBeInTheDocument()
    expect(settings().azkarReminders.morning).toBe(false)
  })

  it('shows the stored choices while it asks the system, then what the system allows', async () => {
    usePrayerTimesStore.setState({ notifications: true })
    device.notifications = 'denied'
    render(<NotificationSettingsSection />)
    expect(prayerSwitch()).toBeChecked()
    await waitFor(() => expect(prayerSwitch()).not.toBeChecked())
    expect(screen.getByText(IOS_DENIED)).toBeInTheDocument()
    // The wish itself is kept for when notifications are allowed again.
    expect(settings().notifications).toBe(true)
  })

  it('notices notifications allowed in the Settings app on coming back', async () => {
    usePrayerTimesStore.setState({ notifications: true })
    device.notifications = 'denied'
    render(<NotificationSettingsSection />)
    await screen.findByText(IOS_DENIED)

    device.notifications = 'granted'
    act(() => bringToForeground())
    await waitFor(() => expect(prayerSwitch()).toBeChecked())
    expect(screen.queryByText(IOS_DENIED)).toBeNull()
  })

  it('offers the morning reminder at Fajr or after sunrise once it is on', async () => {
    const user = userEvent.setup()
    render(<NotificationSettingsSection />)
    await waitFor(() => expect(LocalNotifications.checkPermissions).toHaveBeenCalled())
    expect(screen.getByText('When Fajr begins')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Morning reminder' })).toBeNull()

    await user.click(morningSwitch())
    await waitFor(() => expect(morningSwitch()).toBeChecked())
    const choice = screen.getByRole('radiogroup', { name: 'Morning reminder' })
    expect(within(choice).getByRole('radio', { name: 'At Fajr' })).toBeChecked()

    await user.click(within(choice).getByRole('radio', { name: 'After sunrise' }))
    expect(settings().azkarReminders).toEqual({ morning: true, evening: false, morningAt: 'sunrise' })
    expect(screen.getByText('After sunrise', { selector: '.ui-row__description' })).toBeInTheDocument()
  })

  it('is fully translated into Arabic', async () => {
    useSettings.setState({ language: 'ar' })
    resetDevice('android')
    device.notifications = 'denied'
    render(<NotificationSettingsSection />)
    expect(await screen.findByText(/الإشعارات متوقفة لتطبيق أذكار/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'التذكير بأذكار الصباح' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'التذكير بأذكار المساء' })).toBeInTheDocument()
    expect(screen.getByText(/فتصلك حتى إن كان تطبيق أذكار مغلقًا/)).toBeInTheDocument()
  })
})
