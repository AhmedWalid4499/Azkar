import { useId } from 'react'
import { canHaptic } from '../../native'
import { useI18n } from '../../shared/i18n'
import { Row, Section, Stepper, Switch } from '../../shared/ui'
import styles from './AzkarSettingsSection.module.css'
import { cx } from './cx'
import { ARABIC_SCALES, arabicFontSize, resolveAid, useAzkarSettings } from './settingsStore'
import type { ArabicScale } from './settingsStore'
import { keepAwakeSupported } from './useWakeLock'

const PREVIEW_TEXT = 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ'

const MIN_SCALE = ARABIC_SCALES[0]
const MAX_SCALE = ARABIC_SCALES[ARABIC_SCALES.length - 1] ?? MIN_SCALE

/** A `<Section>` of reader preferences for the Settings page. */
export function AzkarSettingsSection() {
  const { t, lang } = useI18n()
  const settings = useAzkarSettings()
  const ids = useId()

  return (
    <Section title={t('azkar.settings.title')}>
      <Row
        stacked
        label={t('azkar.settings.textSize')}
        control={
          <div className={styles.size}>
            <div className={styles.preview}>
              <span className="visually-hidden">{t('azkar.settings.textSize.preview')}</span>
              <p
                className={cx('recitation', styles.previewText)}
                lang="ar"
                dir="rtl"
                style={{ fontSize: arabicFontSize(settings.arabicScale) }}
              >
                {PREVIEW_TEXT}
              </p>
            </div>
            <div className={styles.sizeControl}>
              <Stepper
                label={t('azkar.settings.textSize')}
                value={settings.arabicScale}
                min={MIN_SCALE}
                max={MAX_SCALE}
                onChange={(value) => settings.update({ arabicScale: value as ArabicScale })}
              />
            </div>
          </div>
        }
      />
      <Row
        htmlFor={`${ids}-transliteration`}
        label={t('azkar.settings.transliteration')}
        description={t('azkar.settings.transliteration.description')}
        control={
          <Switch
            id={`${ids}-transliteration`}
            checked={resolveAid(settings.showTransliteration, lang)}
            onChange={(showTransliteration) => settings.update({ showTransliteration })}
          />
        }
      />
      <Row
        htmlFor={`${ids}-translation`}
        label={t('azkar.settings.translation')}
        description={t('azkar.settings.translation.description')}
        control={
          <Switch
            id={`${ids}-translation`}
            checked={resolveAid(settings.showTranslation, lang)}
            onChange={(showTranslation) => settings.update({ showTranslation })}
          />
        }
      />
      <Row
        htmlFor={`${ids}-auto-advance`}
        label={t('azkar.settings.autoAdvance')}
        description={t('azkar.settings.autoAdvance.description')}
        control={
          <Switch
            id={`${ids}-auto-advance`}
            checked={settings.autoAdvance}
            onChange={(autoAdvance) => settings.update({ autoAdvance })}
          />
        }
      />
      {canHaptic() && (
        <Row
          htmlFor={`${ids}-haptics`}
          label={t('azkar.settings.haptics')}
          description={t('azkar.settings.haptics.description')}
          control={
            <Switch
              id={`${ids}-haptics`}
              checked={settings.haptics}
              onChange={(haptics) => settings.update({ haptics })}
            />
          }
        />
      )}
      {keepAwakeSupported() && (
        <Row
          htmlFor={`${ids}-keep-awake`}
          label={t('azkar.settings.keepAwake')}
          description={t('azkar.settings.keepAwake.description')}
          control={
            <Switch
              id={`${ids}-keep-awake`}
              checked={settings.keepAwake}
              onChange={(keepAwake) => settings.update({ keepAwake })}
            />
          }
        />
      )}
    </Section>
  )
}
