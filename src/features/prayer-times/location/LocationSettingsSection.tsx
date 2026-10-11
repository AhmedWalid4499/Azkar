import { deviceTimeZone } from '../../../shared/date'
import { useI18n } from '../../../shared/i18n'
import { useLocationStore } from '../../../shared/location'
import { useSettings } from '../../../shared/settings'
import { Notice, Row, Section } from '../../../shared/ui'
import { usePlace } from '../hooks'
import { LocationActions } from './LocationActions'
import styles from './location.module.css'
import { coordinatesLabel } from './place'

/** Settings: the saved place, when it was set, and the two ways to change it. */
export function LocationSettingsSection() {
  const i18n = useI18n()
  const { t, locale } = i18n
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  const location = useLocationStore((state) => state.location)
  const place = usePlace()

  const updatedAt = location && Number.isFinite(location.updatedAt) ? new Date(location.updatedAt) : null
  const updated = updatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', hourCycle: hour12 ? 'h12' : 'h23' }).format(
        updatedAt,
      )
    : null
  const fromDevice = location?.source === 'gps'

  return (
    <Section title={t('times.location.title')} footer={t('times.location.footer')}>
      {place && location ? (
        <Row
          label={
            <span dir="auto">
              {(typeof location.label === 'string' && location.label) ||
                coordinatesLabel(place.latitude, place.longitude, i18n)}
            </span>
          }
          description={
            <>
              <span className={styles.detail}>
                {[
                  t(fromDevice ? 'times.location.source.gps' : 'times.location.source.manual'),
                  updated && t('times.location.updated', { date: updated }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className={styles.detail}>{t('times.location.timeZone', { zone: place.timeZone })}</span>
            </>
          }
        />
      ) : (
        <Row label={t('times.location.notSet')} description={t('times.location.notSet.description')} />
      )}

      {location && !place && (
        <div className={styles.block}>
          <Notice tone="warn">{t('times.location.unusable')}</Notice>
        </div>
      )}
      {place && fromDevice && place.timeZone !== deviceTimeZone() && (
        <div className={styles.block}>
          <Notice>{t('times.location.zoneChanged')}</Notice>
        </div>
      )}

      <div className={styles.block}>
        <LocationActions gpsLabel={t(fromDevice ? 'times.location.update' : 'times.location.useMine')} />
      </div>
    </Section>
  )
}
