import { MapPin } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { isolate, useI18n } from '../../shared/i18n'
import { useLocationStore } from '../../shared/location'
import { Card, PageHeader } from '../../shared/ui'
import { useLocationLabel } from '../prayer-times'
import { qiblaDirection } from './bearing'
import { QiblaCompass } from './QiblaCompass'
import styles from './QiblaPage.module.css'

function NoLocation() {
  const { t } = useI18n()
  const headingId = useId()
  return (
    <Card className={styles.prompt}>
      <section aria-labelledby={headingId} className={styles.promptBody}>
        <span className={styles.promptIcon} aria-hidden>
          <MapPin size={24} strokeWidth={1.9} />
        </span>
        <h2 id={headingId} className={styles.promptTitle}>
          {t('qibla.noLocation.title')}
        </h2>
        <p className={styles.reason}>{t('qibla.noLocation.body')}</p>
        <Link to="/settings" className="ui-button ui-button--primary">
          {t('qibla.noLocation.action')}
        </Link>
      </section>
    </Card>
  )
}

/**
 * `fromDevice`: the saved location is the phone's own position. A place picked by
 * name is its centre, and Makkah's lies within a kilometre of the Kaaba, so
 * someone elsewhere in the city is pointed to their exact location instead.
 */
function NearKaaba({ fromDevice }: { fromDevice: boolean }) {
  const { t } = useI18n()
  const headingId = useId()
  return (
    <Card className={styles.prompt}>
      <section aria-labelledby={headingId} className={styles.promptBody}>
        <h2 id={headingId} className={styles.promptTitle}>
          {t('qibla.near.title')}
        </h2>
        <p className={styles.reason}>{t(fromDevice ? 'qibla.near' : 'qibla.near.saved')}</p>
        {!fromDevice && (
          <Link to="/settings" className="ui-button ui-button--secondary">
            {t('qibla.near.action')}
          </Link>
        )}
      </section>
    </Card>
  )
}

interface QiblaPageProps {
  /** Route for a back button, when the page is reached from another page rather than from the tab bar. */
  backTo?: string
}

/** The Qibla from the saved location: a compass where the device has one, the bearing and the distance. */
export function QiblaPage({ backTo }: QiblaPageProps = {}) {
  const { t } = useI18n()
  const location = useLocationStore((state) => state.location)
  const place = useLocationLabel()
  const latitude = location?.latitude
  const longitude = location?.longitude
  const qibla = useMemo(
    () => (latitude === undefined || longitude === undefined ? null : qiblaDirection(latitude, longitude)),
    [latitude, longitude],
  )

  return (
    <div className="page">
      <PageHeader
        title={t('qibla.title')}
        subtitle={place ? t('qibla.from', { place: isolate(place) }) : undefined}
        backTo={backTo}
      />
      {qibla === null ? (
        <NoLocation />
      ) : qibla.near ? (
        <NearKaaba fromDevice={location?.source === 'gps'} />
      ) : (
        <QiblaCompass qibla={qibla} />
      )}
    </div>
  )
}
