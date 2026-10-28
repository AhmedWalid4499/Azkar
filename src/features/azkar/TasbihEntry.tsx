import { ChevronLeft, ChevronRight, CircleDot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import { TASBIH_PATH } from './collections'
import { cx } from './cx'
import styles from './PickerPage.module.css'
import { tasbihDayCount } from './tasbihData'
import { useTasbihDateKey, useTasbihDay } from './useTasbih'

/** The picker's way into the tasbih counter, with what was counted today. */
export function TasbihEntry() {
  const { t, dir } = useI18n()
  const today = tasbihDayCount(useTasbihDay(useTasbihDateKey()))
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight

  return (
    <div className={styles.tasbih}>
      <span className={styles.tasbihIcon} aria-hidden>
        <CircleDot size={22} />
      </span>
      <div className={styles.tasbihText}>
        <h2 className={styles.tasbihTitle}>
          <Link to={TASBIH_PATH} className={styles.link}>
            {t('azkar.tasbih.title')}
          </Link>
        </h2>
        <p className={styles.sectionDescription}>{t('azkar.tasbih.subtitle')}</p>
        {today > 0 && <p className={cx(styles.tasbihToday, 'tabular')}>{t('azkar.tasbih.today', { count: today })}</p>}
      </div>
      <Chevron aria-hidden size={18} className={styles.prayerChevron} />
    </div>
  )
}
