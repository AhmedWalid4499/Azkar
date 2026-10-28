import { Sunrise } from 'lucide-react'
import { useId } from 'react'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Switch } from '../../shared/ui'
import styles from './FastingCard.module.css'
import { useWhen } from './format'
import { FastToggle } from './FastToggle'
import { useFastingDay, useOwedDays } from './hooks'
import type { FastingDay } from './hooks'
import { describeFast, reasonText } from './labels'
import { useFasting } from './store'

export interface FastingCardProps {
  /** Today's calendar day at the saved location; read from the clock when omitted. */
  today?: DateKey
}

/**
 * Outside Ramadan, on a day recommended for fasting (or one with a fast already
 * logged): why the day is recommended, and "I'm fasting today" in one tap. Never
 * shown in Ramadan, on the two Eids or on the days of Tashriq.
 */
export function FastingCard({ today: given }: FastingCardProps) {
  const clockToday = useTodayKey()
  const today = given ?? clockToday
  const day = useFastingDay(today)
  if (day.ramadanDay !== null || day.forbidden !== null) return null
  if (day.suggested.length === 0 && !day.record) return null
  return <FastingCardBody day={day} />
}

function FastingCardBody({ day }: { day: FastingDay }) {
  const i18n = useI18n()
  const { t } = i18n
  const headingId = useId()
  const switchId = useId()
  const when = useWhen()
  const owed = useOwedDays()
  const setFast = useFasting((state) => state.setFast)
  const { dateKey, record, suggested } = day

  const fasting = record?.status === 'fasted'
  const isQada = record?.kind === 'qada'
  const offerQada = fasting && (isQada || owed.remaining > 0)
  const toggle = () =>
    setFast(dateKey, fasting ? null : { kind: isQada ? 'qada' : 'voluntary', status: 'fasted' })

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <Sunrise aria-hidden size={20} className={styles.icon} />
        <h2 id={headingId} className={styles.title}>
          {t(suggested.length > 0 ? 'fasting.card.recommended' : 'fasting.card.logged')}
        </h2>
      </div>
      {suggested.length > 0 && (
        <ul className={styles.reasons} aria-label={t('fasting.card.reasons')}>
          {suggested.map((reason) => (
            <li key={reason}>{reasonText(reason, day, i18n)}</li>
          ))}
        </ul>
      )}
      <div className={styles.toggles}>
        <FastToggle pressed={fasting} onToggle={toggle}>
          {t('fasting.today.fasting')}
        </FastToggle>
      </div>
      {offerQada && (
        <div className={styles.qada}>
          <label htmlFor={switchId} className={styles.qadaLabel}>
            {t('fasting.today.qada')}
          </label>
          <Switch
            id={switchId}
            checked={isQada}
            onChange={(checked) => setFast(dateKey, { kind: checked ? 'qada' : 'voluntary', status: 'fasted' })}
          />
        </div>
      )}
      {record && !fasting && (
        <p className={styles.logged}>{t('fasting.today.status', { status: describeFast(record, i18n) })}</p>
      )}
      {record?.at !== undefined && (
        <p className={styles.logged}>{t('fasting.loggedAt', { when: when(record.at, dateKey) })}</p>
      )}
    </section>
  )
}
