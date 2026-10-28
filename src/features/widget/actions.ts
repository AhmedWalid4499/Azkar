import type { WidgetAction } from '../../native'
import { isValidDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { PrayerName } from '../../shared/types'
import { PRAYER_STATUSES, usePrayerLog } from '../prayer-log'
import type { PrayerStatus } from '../prayer-log'

const isPrayer = (value: string): value is PrayerName => (PRAYERS as readonly string[]).includes(value)
const isStatus = (value: string): value is PrayerStatus => (PRAYER_STATUSES as readonly string[]).includes(value)

/**
 * Records in the prayer log the prayers marked on a widget, oldest first, each
 * stamped with when it was tapped rather than when the app got round to it.
 * A prayer whose status was set in the app after the tap keeps that status;
 * one that already has the same status keeps its earlier time. Anything the
 * log cannot hold is skipped. Returns how many were recorded.
 */
export function applyWidgetActions(actions: readonly WidgetAction[], now: number = Date.now()): number {
  let recorded = 0
  for (const action of [...actions].sort((a, b) => a.at - b.at)) {
    const { date, prayer, status } = action
    if (!isValidDateKey(date) || !isPrayer(prayer) || !isStatus(status) || !(action.at > 0)) continue
    // A clock set wrong on either side must not stamp a prayer in the future.
    const at = Math.min(action.at, now)

    const before = usePrayerLog.getState()
    const current = before.entries[date]?.[prayer]
    if (current === status) continue
    const changedAt = before.loggedAt[date]?.[prayer]
    if (current !== undefined && changedAt !== undefined && changedAt > at) continue

    before.setStatus(date, prayer, status)
    const after = usePrayerLog.getState()
    // Refused: a day that has not begun where the user is.
    if (after.entries[date]?.[prayer] !== status) continue
    // setStatus stamps the moment it runs; the log keeps the moment of the tap.
    usePrayerLog.setState({ loggedAt: { ...after.loggedAt, [date]: { ...after.loggedAt[date], [prayer]: at } } })
    recorded++
  }
  return recorded
}
