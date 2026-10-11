import { MapPin } from 'lucide-react'
import { useId } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Card } from '../../../shared/ui'
import { LocationActions } from './LocationActions'
import styles from './location.module.css'

/** Shown on the Today page while no location is saved: asks for GPS or a city. */
export function LocationPrompt() {
  const { t } = useI18n()
  const headingId = useId()
  return (
    <Card className={styles.prompt}>
      <section aria-labelledby={headingId} className={styles.promptBody}>
        <span className={styles.promptIcon} aria-hidden>
          <MapPin size={24} strokeWidth={1.9} />
        </span>
        <h2 id={headingId} className={styles.promptTitle}>
          {t('times.prompt.title')}
        </h2>
        <p className={styles.promptText}>{t('times.prompt.body')}</p>
      </section>
      <LocationActions gpsLabel={t('times.location.useMine')} />
    </Card>
  )
}
