// Scaffold placeholder. Replace with the real feature and delete this file.
import type { DateKey, PrayerName } from '../../shared/types'
import { Card } from '../../shared/ui'

/** Routed under `/log/*`: history, calendar and statistics. */
export function LogRoutes() {
  return (
    <div className="page">
      <Card>Prayer log</Card>
    </div>
  )
}

export interface PrayerLogToggleProps {
  prayer: PrayerName
  dateKey: DateKey
}

/** Compact control that shows and changes one prayer's logged status. Sits at the end of a timetable row. */
export function PrayerLogToggle(_props: PrayerLogToggleProps) {
  return null
}
