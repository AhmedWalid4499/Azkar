// The app loads the azkar feature first (App.tsx), and reaches this one through it:
// azkar → its prayer clock → this feature's index → the reminders. Nothing on that way
// may lead back into a feature still half-evaluated, or the app would fail to start.
import { describe, expect, it } from 'vitest'
import { AzkarRoutes } from '../../azkar'
import { PrayerNotifier, unloggedReminderId } from '..'

describe('loading the reminders after the azkar feature, as the app does', () => {
  it('leaves nothing half-evaluated', () => {
    expect(AzkarRoutes).toBeTypeOf('function')
    expect(PrayerNotifier).toBeTypeOf('function')
    expect(unloggedReminderId('2026-10-12', 'asr')).toBe(1_202_610_122)
  })
})
