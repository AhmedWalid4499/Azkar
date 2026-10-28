import { useId, useState } from 'react'
import { useI18n } from '../../shared/i18n'
import { NAME_MAX_LENGTH, useSettings } from '../../shared/settings'
import { Row, Section } from '../../shared/ui'
import styles from './NameField.module.css'

/** Settings: the name the app greets the user by and uses in reminders. */
export function NameField() {
  const { t } = useI18n()
  const id = useId()
  const descriptionId = useId()
  const name = useSettings((state) => state.name)
  const update = useSettings((state) => state.update)
  // The field keeps what is typed, spaces and all; the store keeps the tidied name.
  const [draft, setDraft] = useState(name)

  return (
    <Section title={t('settings.you')}>
      <Row
        stacked
        htmlFor={id}
        label={t('settings.name')}
        description={<span id={descriptionId}>{t('settings.name.description')}</span>}
        control={
          <input
            id={id}
            className={styles.input}
            type="text"
            dir="auto"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={NAME_MAX_LENGTH * 2}
            placeholder={t('settings.name.placeholder')}
            aria-describedby={descriptionId}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              update({ name: event.target.value })
            }}
            onBlur={() => setDraft(useSettings.getState().name)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        }
      />
    </Section>
  )
}
