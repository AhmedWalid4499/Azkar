import { useMemo } from 'react'
import { formatDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import styles from './DayPanel.module.css'
import { useWhen } from './stamps'
import { useDayLog, useSunnahDay } from './store'
import { sunnahLabelKey } from './sunnahLabels'
import { summarizeSunnahDay } from './sunnahStats'
import { SunnahToggle } from './SunnahToggle'
import { RAWATIB_RAKAHS, SUNNAH_PRAYERS } from './types'

const RAWATIB_TOTAL = Object.values(RAWATIB_RAKAHS).reduce((sum, rakahs) => sum + rakahs, 0)

/**
 * The day's sunnah prayers, one chip each, with the rak'ahs of the rawatib prayed
 * and when each was ticked off. A night prayer is filed under the day whose Isha
 * it followed, so the chips of a day hold that day's night.
 */
export function DaySunnah({ dateKey }: { dateKey: DateKey }) {
  const { t, locale } = useI18n()
  const day = useSunnahDay(dateKey)
  const log = useDayLog(dateKey)
  const when = useWhen()
  const summary = useMemo(() => summarizeSunnahDay(day, log), [day, log])
  const ticked = SUNNAH_PRAYERS.flatMap((sunnah) => {
    const at = day?.[sunnah]
    return typeof at === 'number' ? [{ sunnah, at }] : []
  })

  return (
    <Card className={styles.group}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>{t('log.sunnah.title')}</h3>
        <span className={`${styles.count} tabular`}>
          {t('log.sunnah.count', { done: summary.done, total: SUNNAH_PRAYERS.length })}
        </span>
      </div>
      <div
        role="group"
        aria-label={t('log.sunnah.group', { date: formatDateKey(dateKey, locale) })}
        className={styles.chips}
      >
        {SUNNAH_PRAYERS.map((sunnah) => (
          <SunnahToggle key={sunnah} sunnah={sunnah} dateKey={dateKey} />
        ))}
      </div>
      <p className={styles.note}>{t('log.sunnah.rawatib', { done: summary.rawatibRakahs, total: RAWATIB_TOTAL })}</p>
      {ticked.length > 0 && (
        <div className={styles.times}>
          <h4 className={styles.timesTitle}>{t('log.sunnah.times')}</h4>
          <ul className={`${styles.timesList} tabular`}>
            {ticked.map(({ sunnah, at }) => (
              <li key={sunnah}>{t('log.sunnah.time', { sunnah: t(sunnahLabelKey(sunnah)), when: when(at, dateKey) })}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
