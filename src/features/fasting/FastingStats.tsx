import { CalendarCheck, Flame, MoonStar, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Card, Notice } from '../../shared/ui'
import styles from './FastingStats.module.css'
import { formatHijriMonth, formatHijriYear } from './hijri'
import { useHijriOffset } from './hooks'
import { OWED_BEFORE_MAX } from './sanitize'
import { fastingStats } from './stats'
import type { RamadanSummary } from './stats'
import { useFasting } from './store'

export interface FastingStatsProps {
  /** Today's calendar day at the saved location; read from the clock when omitted. */
  today?: DateKey
}

/**
 * The tracker's fasting figures: this year's Ramadan, the days still to make
 * up (with the days owed from before the log began, which the user enters),
 * voluntary fasts this Hijri month and year, and the streaks of Mondays and
 * Thursdays and of the white days.
 */
export function FastingStats({ today: given }: FastingStatsProps) {
  const clockToday = useTodayKey()
  const today = given ?? clockToday
  const { t, tp, locale } = useI18n()
  const headingId = useId()
  const offsetDays = useHijriOffset()
  const days = useFasting((state) => state.days)
  const owedBefore = useFasting((state) => state.owedBefore)
  const stats = useMemo(() => fastingStats(days, { today, offsetDays, owedBefore }), [days, today, offsetDays, owedBefore])
  const { owed, ramadan, voluntary } = stats
  const streak = (value: { current: number; best: number }, unit: 'fasting.fasts' | 'fasting.months') =>
    t('fasting.stats.streaks.value', { current: tp(unit, value.current), best: tp(unit, value.best) })

  return (
    <section aria-labelledby={headingId} className={styles.stats}>
      <h2 id={headingId} className={styles.title}>
        {t('fasting.title')}
      </h2>

      {ramadan ? <RamadanFigures ramadan={ramadan} offsetDays={offsetDays} /> : <Notice>{t('fasting.stats.noHijri')}</Notice>}

      <Group icon={CalendarCheck} title={t('fasting.stats.owed.title')}>
        <Figures>
          <Figure label={t('fasting.stats.owed.remaining')} value={tp('fasting.days', owed.remaining)} strong />
          <Figure label={t('fasting.stats.owed.madeUp')} value={tp('fasting.days', owed.madeUp)} />
          <Figure label={t('fasting.stats.owed.fromRamadan')} value={tp('fasting.days', owed.fromRamadan)} />
        </Figures>
        <OwedBeforeField value={owedBefore} />
        <p className={styles.note}>{t('fasting.stats.owed.note')}</p>
      </Group>

      {voluntary && (
        <Group icon={Sparkles} title={t('fasting.stats.voluntary.title')}>
          <Figures>
            <Figure label={formatHijriMonth(today, locale, offsetDays)} value={tp('fasting.fasts', voluntary.month)} />
            <Figure label={formatHijriYear(today, locale, offsetDays)} value={tp('fasting.fasts', voluntary.year)} />
          </Figures>
        </Group>
      )}

      <Group icon={Flame} title={t('fasting.stats.streaks.title')}>
        <Figures>
          <Figure label={t('fasting.stats.streaks.monThu')} value={streak(stats.mondayThursday, 'fasting.fasts')} />
          {ramadan && <Figure label={t('fasting.stats.streaks.whiteDays')} value={streak(stats.whiteDays, 'fasting.months')} />}
        </Figures>
      </Group>
    </section>
  )
}

function RamadanFigures({ ramadan, offsetDays }: { ramadan: RamadanSummary; offsetDays: number }) {
  const { t, tp, n, locale } = useI18n()
  const first = ramadan.days[0]
  const title = first ? formatHijriMonth(first, locale, offsetDays) : `${t('fasting.ramadan.title')} ${n(ramadan.year)}`
  return (
    <Group icon={MoonStar} title={title}>
      <Figures>
        <Figure
          label={t('fasting.stats.ramadan.fasted')}
          value={t('fasting.stats.ramadan.fastedValue', { fasted: ramadan.fasted, total: ramadan.elapsed })}
          strong
        />
        <Figure label={t('fasting.stats.ramadan.notFasted')} value={tp('fasting.days', ramadan.notFasted)} />
        <Figure label={t('fasting.stats.ramadan.unlogged')} value={tp('fasting.days', ramadan.unlogged)} />
      </Figures>
    </Group>
  )
}

function Group({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <Card className={styles.group}>
      <section aria-labelledby={headingId} className={styles.groupBody}>
        <h3 id={headingId} className={styles.groupTitle}>
          <Icon aria-hidden size={16} className={styles.groupIcon} />
          <span>{title}</span>
        </h3>
        {children}
      </section>
    </Card>
  )
}

function Figures({ children }: { children: ReactNode }) {
  return <dl className={styles.figures}>{children}</dl>
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.figure}>
      <dt className={styles.label}>{label}</dt>
      <dd className={`${strong ? styles.strong : styles.value} tabular`}>{value}</dd>
    </div>
  )
}

/** A whole number from 0, typed rather than stepped: a debt of several Ramadans would take many taps. */
function OwedBeforeField({ value }: { value: number }) {
  const { t } = useI18n()
  const id = useId()
  const setOwedBefore = useFasting((state) => state.setOwedBefore)
  // The field keeps what is typed, an empty field included; the store keeps the number.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className={styles.before}>
      <label htmlFor={id} className={styles.beforeLabel}>
        {t('fasting.stats.owed.before')}
      </label>
      <input
        id={id}
        className={`${styles.input} tabular`}
        type="number"
        inputMode="numeric"
        min={0}
        max={OWED_BEFORE_MAX}
        step={1}
        enterKeyHint="done"
        value={draft ?? String(value)}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          const parsed = Number(text)
          if (text.trim() !== '' && Number.isInteger(parsed)) setOwedBefore(parsed)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}
