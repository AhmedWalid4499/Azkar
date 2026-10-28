import { useId, useState } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Button, Segmented, Sheet } from '../../../shared/ui'
import { isTasbihTarget, MAX_TASBIH_TARGET, TASBIH_TARGETS } from '../settingsStore'
import { westernDigits } from './choice'
import styles from './TasbihPage.module.css'

type Choice = 'custom' | 'none' | `${(typeof TASBIH_TARGETS)[number]}`

function choiceOf(target: number | null): Choice {
  if (target === null) return 'none'
  const preset = TASBIH_TARGETS.find((value) => value === target)
  return preset === undefined ? 'custom' : `${preset}`
}

interface TargetChoiceProps {
  target: number | null
  onChange: (target: number | null) => void
  onDone: () => void
}

/** Mounted each time the sheet opens, so it starts from the target as it is. */
function TargetChoice({ target, onChange, onDone }: TargetChoiceProps) {
  const { t, n } = useI18n()
  const inputId = useId()
  const errorId = useId()
  const [choice, setChoice] = useState<Choice>(() => choiceOf(target))
  const [custom, setCustom] = useState(() => (choiceOf(target) === 'custom' && target !== null ? n(target) : ''))
  const typed = Number(westernDigits(custom.trim()))
  const invalid = choice === 'custom' && custom.trim() !== '' && !isTasbihTarget(typed)

  const choose = (next: Choice) => {
    setChoice(next)
    if (next === 'none') onChange(null)
    else if (next !== 'custom') onChange(Number(next))
    else if (isTasbihTarget(typed)) onChange(typed)
  }

  return (
    <div className={styles.targetBody}>
      <p className={styles.targetDescription}>{t('azkar.tasbih.target.description')}</p>
      <Segmented<Choice>
        block
        label={t('azkar.tasbih.target')}
        value={choice}
        onChange={choose}
        options={[
          ...TASBIH_TARGETS.map((value) => ({ value: `${value}` as Choice, label: n(value) })),
          { value: 'custom', label: t('azkar.tasbih.target.option.custom') },
          { value: 'none', label: t('azkar.tasbih.target.option.none') },
        ]}
      />
      {choice === 'custom' && (
        <div className={styles.customField}>
          <label htmlFor={inputId} className={styles.customLabel}>
            {t('azkar.tasbih.target.custom')}
          </label>
          <input
            id={inputId}
            className={styles.customInput}
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={12}
            value={custom}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => {
              setCustom(event.target.value)
              const value = Number(westernDigits(event.target.value.trim()))
              if (isTasbihTarget(value)) onChange(value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onDone()
            }}
          />
          {invalid && (
            <p id={errorId} className={styles.customError}>
              {t('azkar.tasbih.target.invalid', { max: MAX_TASBIH_TARGET })}
            </p>
          )}
        </div>
      )}
      <Button block variant="primary" onClick={onDone}>
        {t('action.done')}
      </Button>
    </div>
  )
}

interface TargetSheetProps {
  open: boolean
  onClose: () => void
  target: number | null
  onChange: (target: number | null) => void
}

/** 33, 99, 100, a custom count, or no target. Each choice applies at once. */
export function TargetSheet({ open, onClose, target, onChange }: TargetSheetProps) {
  const { t } = useI18n()
  return (
    <Sheet open={open} onClose={onClose} title={t('azkar.tasbih.target')}>
      <TargetChoice target={target} onChange={onChange} onDone={onClose} />
    </Sheet>
  )
}
