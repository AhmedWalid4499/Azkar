import { Check } from 'lucide-react'
import { useI18n } from '../../../shared/i18n'
import { Sheet } from '../../../shared/ui'
import { cx } from '../cx'
import type { Dhikr } from '../data'
import type { ReaderPrefs } from '../settingsStore'
import type { TasbihSlot } from '../tasbihCounts'
import styles from './TasbihPage.module.css'

interface PresetSheetProps {
  open: boolean
  onClose: () => void
  presets: readonly Dhikr[]
  /** What is counted now. */
  chosen: TasbihSlot
  onChoose: (slot: TasbihSlot) => void
  prefs: ReaderPrefs
}

/** Every preset with its Arabic, transliteration and meaning (as the reading aids are set), and the free count. */
export function PresetSheet({ open, onClose, presets, chosen, onChoose, prefs }: PresetSheetProps) {
  const { t } = useI18n()

  return (
    <Sheet open={open} onClose={onClose} title={t('azkar.tasbih.choose')}>
      <ul className={styles.options}>
        {presets.map((preset) => {
          const current = preset.id === chosen
          const transliteration = prefs.showTransliteration ? preset.transliteration?.trim() : undefined
          const translation = prefs.showTranslation ? preset.translation.trim() : undefined
          return (
            <li key={preset.id}>
              <button
                type="button"
                className={styles.option}
                aria-current={current ? 'true' : undefined}
                onClick={() => onChoose(preset.id)}
              >
                <span className={styles.optionText}>
                  <span className={cx('recitation', styles.optionArabic)} lang="ar" dir="rtl">
                    {preset.arabic}
                  </span>
                  {transliteration && (
                    <span className={styles.optionTransliteration} lang="en" dir="ltr">
                      {transliteration}
                    </span>
                  )}
                  {translation && (
                    <span className={styles.optionMeaning} lang="en" dir="ltr">
                      {translation}
                    </span>
                  )}
                </span>
                {current && <Check aria-hidden size={20} strokeWidth={2.5} className={styles.optionCheck} />}
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className={styles.option}
            aria-current={chosen === null ? 'true' : undefined}
            onClick={() => onChoose(null)}
          >
            <span className={styles.optionText}>
              <span className={styles.optionName}>{t('azkar.tasbih.free')}</span>
              <span className={styles.optionMeaning}>{t('azkar.tasbih.free.description')}</span>
            </span>
            {chosen === null && <Check aria-hidden size={20} strokeWidth={2.5} className={styles.optionCheck} />}
          </button>
        </li>
      </ul>
    </Sheet>
  )
}
