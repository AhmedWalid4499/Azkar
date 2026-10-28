import { useI18n } from '../../shared/i18n'
import { Card } from '../../shared/ui'
import { cardinalOf } from './bearing'
import type { QiblaDirection } from './bearing'
import { formatDegrees, formatKilometres } from './format'
import styles from './QiblaPage.module.css'

/** The bearing in figures and words, and how far away the Kaaba is. */
export function QiblaFacts({ qibla }: { qibla: QiblaDirection }) {
  const i18n = useI18n()
  const { t, locale } = i18n
  return (
    <Card className={styles.facts}>
      <h2 className={styles.factsTitle}>{t('qibla.bearing')}</h2>
      <p className={`${styles.degrees} tabular`}>{formatDegrees(qibla.bearing, i18n)}</p>
      <p className={styles.detail}>
        {t('qibla.bearing.detail', { direction: t(`qibla.direction.${cardinalOf(qibla.bearing)}`) })}
      </p>
      <p className={styles.detail}>{t('qibla.distance', { distance: formatKilometres(qibla.distanceKm, locale) })}</p>
    </Card>
  )
}
