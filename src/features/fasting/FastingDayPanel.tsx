import { Check } from 'lucide-react'
import { useId } from 'react'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Button, Card } from '../../shared/ui'
import styles from './FastingDayPanel.module.css'
import { cx, useWhen } from './format'
import { useFastingDay } from './hooks'
import { forbiddenKey, kindHintKey, kindLabelKey, reasonText, statusHintKey, statusLabelKey } from './labels'
import { useFasting } from './store'
import type { FastKind, FastStatus } from './types'

const RAMADAN_STATUSES: FastStatus[] = ['fasted', 'excused', 'broken', 'missed']
const OTHER_STATUSES: FastStatus[] = ['fasted', 'broken', 'excused']

export interface FastingDayPanelProps {
  dateKey: DateKey
}

/**
 * One day's fast in the tracker: what the calendar says about the day, what was
 * logged and when, and every choice to log or change it. A day of Ramadan is
 * always a Ramadan fast; another day is voluntary or a make-up fast. A day
 * fasting is not permitted on offers nothing to log, only a way to clear a fast
 * already there.
 */
export function FastingDayPanel({ dateKey }: FastingDayPanelProps) {
  const i18n = useI18n()
  const { t } = i18n
  const headingId = useId()
  const reasonsId = useId()
  const today = useTodayKey()
  const when = useWhen()
  const day = useFastingDay(dateKey)
  const setFast = useFasting((state) => state.setFast)
  const { record, ramadanDay, forbidden } = day

  const future = dateKey > today
  const kinds: FastKind[] = ramadanDay !== null ? ['ramadan'] : ['voluntary', 'qada']
  if (record && !kinds.includes(record.kind)) kinds.push(record.kind)
  const kind: FastKind = record?.kind ?? kinds[0]!
  const statuses = [...(kind === 'ramadan' ? RAMADAN_STATUSES : OTHER_STATUSES)]
  if (record && !statuses.includes(record.status)) statuses.push(record.status)
  const editable = !future && (forbidden === null || record !== undefined)

  return (
    <Card>
      <section aria-labelledby={headingId} className={styles.body}>
        <h3 id={headingId} className={styles.title}>
          {t('fasting.title')}
        </h3>
        {ramadanDay !== null && <p className={styles.context}>{t('fasting.ramadan.day', { day: ramadanDay })}</p>}
        {forbidden !== null && (
          <div className={styles.forbidden}>
            <p>{t(forbiddenKey(forbidden))}</p>
            <p className={styles.hint}>{t('fasting.forbidden.offset')}</p>
          </div>
        )}
        {day.reasons.length > 0 && (
          <div className={styles.context}>
            <p id={reasonsId}>{t('fasting.panel.recommended')}</p>
            <ul className={styles.reasons} aria-labelledby={reasonsId}>
              {day.reasons.map((reason) => (
                <li key={reason}>{reasonText(reason, day, i18n)}</li>
              ))}
            </ul>
          </div>
        )}

        {future ? (
          <p className={styles.state}>{t('fasting.panel.future')}</p>
        ) : !record ? (
          forbidden === null && <p className={styles.state}>{t('fasting.panel.none')}</p>
        ) : (
          record.at !== undefined && (
            <p className={styles.state}>{t('fasting.loggedAt', { when: when(record.at, dateKey) })}</p>
          )
        )}

        {editable && (
          <>
            {kinds.length > 1 && (
              <Choices
                legend={t('fasting.panel.kind')}
                options={kinds.map((value) => ({ value, label: t(kindLabelKey(value)), hint: t(kindHintKey(value)) }))}
                value={record?.kind ?? null}
                onChoose={(value) => setFast(dateKey, { kind: value, status: record?.status ?? 'fasted' })}
              />
            )}
            <Choices
              legend={t('fasting.panel.status')}
              options={statuses.map((value) => ({ value, label: t(statusLabelKey(value)), hint: t(statusHintKey(value)) }))}
              value={record?.status ?? null}
              onChoose={(value) => setFast(dateKey, { kind, status: value })}
            />
            {record && (
              <Button variant="ghost" className={styles.clear} onClick={() => setFast(dateKey, null)}>
                {t('fasting.panel.clear')}
              </Button>
            )}
          </>
        )}
      </section>
    </Card>
  )
}

interface ChoicesProps<T extends string> {
  legend: string
  options: Array<{ value: T; label: string; hint: string }>
  /** `null` until something is logged: no option is chosen then. */
  value: T | null
  onChoose: (value: T) => void
}

/** A group of radio buttons drawn as cards, each with a line of explanation. */
function Choices<T extends string>({ legend, options, value, onChoose }: ChoicesProps<T>) {
  const name = useId()
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((option) => {
        const id = `${name}-${option.value}`
        const checked = option.value === value
        return (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option.value}
              checked={checked}
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-hint`}
              onChange={() => onChoose(option.value)}
            />
            <span className={cx(styles.choice, checked && styles.checked)}>
              <span className={styles.mark}>{checked && <Check aria-hidden size={14} strokeWidth={3} />}</span>
              <span className={styles.text}>
                <span id={`${id}-label`} className={styles.label}>
                  {option.label}
                </span>
                <span id={`${id}-hint`} className={styles.hint}>
                  {option.hint}
                </span>
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
