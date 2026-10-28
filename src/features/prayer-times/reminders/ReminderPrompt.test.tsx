import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../../shared/location'
import { usePrayerTimesStore } from '../config'
import { device, LocalNotifications, resetDevice } from '../native-fakes'
import { CAIRO, resetStores } from '../test-helpers'
import { PROMPT_DISMISSED_KEY, ReminderPrompt } from './ReminderPrompt'

vi.mock('@capacitor/core', async (original) => (await import('../native-fakes')).mockCore(await original()))
vi.mock('@capacitor/local-notifications', async () => (await import('../native-fakes')).localNotificationsModule)
vi.mock('@capacitor/app', async () => (await import('../native-fakes')).appModule)

const card = () => screen.queryByRole('heading', { name: 'Get notified at prayer times' })

beforeEach(() => {
  resetDevice('ios')
  resetStores({ location: CAIRO })
  device.notifications = 'prompt'
  vi.stubGlobal('Notification', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.removeItem(PROMPT_DISMISSED_KEY)
})

describe('ReminderPrompt', () => {
  it('offers prayer reminders in the app once a place is set and the system has not been asked', async () => {
    render(<ReminderPrompt />)
    expect(await screen.findByRole('heading', { name: 'Get notified at prayer times' })).toBeInTheDocument()
  })

  it('turns reminders on in one tap once the system allows them, then goes away', async () => {
    const user = userEvent.setup()
    render(<ReminderPrompt />)
    await user.click(await screen.findByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(usePrayerTimesStore.getState().notifications).toBe(true))
    expect(LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1)
    expect(card()).toBeNull()
  })

  it('leaves reminders off when the system refuses, and goes away (Settings explains what to do)', async () => {
    const user = userEvent.setup()
    device.notificationAnswer = 'denied'
    render(<ReminderPrompt />)
    await user.click(await screen.findByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(card()).toBeNull())
    expect(usePrayerTimesStore.getState().notifications).toBe(false)
  })

  it('stays away for good after "Not now"', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ReminderPrompt />)
    await user.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(card()).toBeNull()
    unmount()
    render(<ReminderPrompt />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(card()).toBeNull()
  })

  it('is not shown without a place, once already answered, when reminders are on, or in a browser', async () => {
    useLocationStore.setState({ location: null })
    const { unmount } = render(<ReminderPrompt />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(card()).toBeNull()
    unmount()

    useLocationStore.setState({ location: CAIRO })
    device.notifications = 'granted'
    const second = render(<ReminderPrompt />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(card()).toBeNull()
    second.unmount()

    device.notifications = 'prompt'
    usePrayerTimesStore.setState({ notifications: true })
    const third = render(<ReminderPrompt />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(card()).toBeNull()
    third.unmount()

    usePrayerTimesStore.setState({ notifications: false })
    resetDevice('web')
    render(<ReminderPrompt />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(card()).toBeNull()
  })
})
