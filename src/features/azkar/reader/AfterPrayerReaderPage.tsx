import { Navigate, useParams } from 'react-router-dom'
import { formatDateKey, isValidDateKey } from '../../../shared/date'
import { useI18n } from '../../../shared/i18n'
import type { DateKey, PrayerName } from '../../../shared/types'
import { afterPrayerDateKey, afterPrayerPath, availableAfterPrayers, isPrayerName } from '../afterPrayer'
import { useAzkarClock } from '../clock'
import { afterPrayerReading } from '../readings'
import { Reader } from './Reader'

function DatedAfterPrayerReader({ prayer, requested }: { prayer: PrayerName; requested: string | undefined }) {
  const { t, locale } = useI18n()
  const { today, phase } = useAzkarClock()
  const current = afterPrayerDateKey(today, phase)
  // A day of the past can be read; one still to come cannot.
  if (requested !== undefined && (!isValidDateKey(requested) || requested > current)) {
    return <Navigate to={afterPrayerPath(prayer)} replace />
  }
  const dateKey: DateKey = requested ?? current
  const name = t(`prayer.${prayer}`)
  return (
    <Reader
      // Without a day in the address, a new day is a new reading, as for the sessions.
      key={`after-${prayer}:${dateKey}`}
      reading={afterPrayerReading(prayer)}
      dateKey={dateKey}
      title={t('azkar.after.title', { prayer: name })}
      completeTitle={t('azkar.after.complete', { prayer: name })}
      dateLabel={dateKey === current ? undefined : formatDateKey(dateKey, locale)}
    />
  )
}

/**
 * `/azkar/after/:prayer`, and `/azkar/after/:prayer/:dateKey` for a given day. A prayer the
 * dataset has no after-prayer azkar for goes back to the picker.
 */
export function AfterPrayerReaderPage() {
  const { prayer, dateKey } = useParams()
  if (!isPrayerName(prayer) || !availableAfterPrayers().includes(prayer)) return <Navigate to="/azkar" replace />
  return <DatedAfterPrayerReader prayer={prayer} requested={dateKey} />
}
