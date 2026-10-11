import { useId, useState } from 'react'
import { useI18n } from '../../shared/i18n'
import type { I18n } from '../../shared/i18n'
import { TIME_SLOTS } from '../../shared/types'
import { Button, Row, Section, Segmented, Select, Sheet, Stepper, Switch } from '../../shared/ui'
import { usePrayerTimesStore } from './config'
import { ADJUSTMENT_LIMIT, HIGH_LATITUDE_RULES, isPolarLatitude, resolveHighLatitudeRule } from './engine/compute'
import type { HighLatitudeSetting } from './engine/compute'
import { autoMethod, isMethodId, METHOD_IDS, methodAngles } from './engine/methods'
import type { MethodId } from './engine/methods'
import { formatSigned } from './format'
import { usePlace } from './hooks'
import styles from './settings.module.css'

/** The twilight parameters of a method in a line, e.g. "Fajr 19.5° · Isha 17.5°". */
function describeAngles(method: MethodId, t: I18n['t']): string {
  const { fajrAngle, ishaAngle, ishaInterval } = methodAngles(method)
  if (ishaInterval <= 0) return t('times.calc.angles', { fajr: fajrAngle, isha: ishaAngle })
  return method === 'UmmAlQura'
    ? t('times.calc.anglesUmmAlQura', { fajr: fajrAngle, minutes: ishaInterval, ramadan: ishaInterval + 30 })
    : t('times.calc.anglesInterval', { fajr: fajrAngle, minutes: ishaInterval })
}

function isHighLatitudeSetting(value: string): value is HighLatitudeSetting {
  return value === 'auto' || (HIGH_LATITUDE_RULES as readonly string[]).includes(value)
}

/** Settings: calculation method, Asr school, high-latitude handling and per-time corrections. */
export function CalculationSettingsSection() {
  const { t, locale } = useI18n()
  const place = usePlace()
  const settings = usePrayerTimesStore()
  const [adjusting, setAdjusting] = useState(false)
  const methodId = useId()
  const highLatitudeId = useId()
  const polarId = useId()

  const automatic = autoMethod(place)
  const method = settings.method === 'auto' ? automatic : settings.method
  const adjusted = TIME_SLOTS.filter((slot) => settings.adjustments[slot] !== 0)
  const showPolar = settings.polar !== 'unresolved' || (place !== null && isPolarLatitude(place.latitude))

  return (
    <Section title={t('times.calc.title')} footer={t('times.calc.footer')}>
      <Row
        stacked
        htmlFor={methodId}
        label={t('times.calc.method')}
        description={
          <>
            {settings.method === 'auto' && (
              <span className={styles.line}>
                {t(place ? 'times.calc.method.autoResolved' : 'times.calc.method.autoNoLocation', {
                  method: t(`times.method.${automatic}`),
                })}
              </span>
            )}
            <span className={styles.line}>{describeAngles(method, t)}</span>
          </>
        }
        control={
          <Select
            id={methodId}
            className={styles.select}
            value={settings.method}
            onChange={(event) => {
              const { value } = event.target
              if (value === 'auto' || isMethodId(value)) settings.setMethod(value)
            }}
          >
            <option value="auto">{t('times.calc.auto')}</option>
            {METHOD_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`times.method.${id}`)}
              </option>
            ))}
          </Select>
        }
      />

      <Row
        stacked
        label={t('times.calc.asr')}
        description={t('times.calc.asr.description')}
        control={
          <Segmented
            block
            label={t('times.calc.asr')}
            value={settings.madhab}
            onChange={settings.setMadhab}
            options={[
              { value: 'shafi', label: t('times.calc.asr.shafi') },
              { value: 'hanafi', label: t('times.calc.asr.hanafi') },
            ]}
          />
        }
      />

      <Row
        stacked
        htmlFor={highLatitudeId}
        label={t('times.calc.highLat')}
        description={
          <>
            <span className={styles.line}>{t('times.calc.highLat.description')}</span>
            {settings.highLatitudeRule === 'auto' && place && (
              <span className={styles.line}>
                {t('times.calc.highLat.autoResolved', {
                  rule: t(`times.calc.highLat.${resolveHighLatitudeRule('auto', place.latitude)}`),
                })}
              </span>
            )}
          </>
        }
        control={
          <Select
            id={highLatitudeId}
            className={styles.select}
            value={settings.highLatitudeRule}
            onChange={(event) => {
              const { value } = event.target
              if (isHighLatitudeSetting(value)) settings.setHighLatitudeRule(value)
            }}
          >
            <option value="auto">{t('times.calc.auto')}</option>
            {HIGH_LATITUDE_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {t(`times.calc.highLat.${rule}`)}
              </option>
            ))}
          </Select>
        }
      />

      {showPolar && (
        <Row
          htmlFor={polarId}
          label={t('times.calc.polar')}
          description={t('times.calc.polar.description')}
          control={
            <Switch
              id={polarId}
              checked={settings.polar === 'nearestLatitude'}
              onChange={(checked) => settings.setPolar(checked ? 'nearestLatitude' : 'unresolved')}
            />
          }
        />
      )}

      <Row
        label={t('times.calc.adjust')}
        description={
          adjusted.length === 0
            ? t('times.calc.adjust.none')
            : t('times.calc.adjust.summary', {
                list: adjusted
                  .map((slot) =>
                    t('times.calc.adjust.item', {
                      prayer: t(`prayer.${slot}`),
                      value: formatSigned(settings.adjustments[slot], locale),
                    }),
                  )
                  .join(t('times.listSeparator')),
              })
        }
        control={
          <Button onClick={() => setAdjusting(true)}>
            {t('times.calc.adjust.edit')}
          </Button>
        }
      />

      <Sheet open={adjusting} onClose={() => setAdjusting(false)} title={t('times.calc.adjust.title')}>
        <p className={styles.sheetText}>{t('times.calc.adjust.body', { limit: ADJUSTMENT_LIMIT })}</p>
        <div className={styles.sheetRows}>
          {TIME_SLOTS.map((slot) => (
            <Row
              key={slot}
              label={t(`prayer.${slot}`)}
              control={
                <Stepper
                  label={t('times.calc.adjust.stepper', { prayer: t(`prayer.${slot}`) })}
                  value={settings.adjustments[slot]}
                  min={-ADJUSTMENT_LIMIT}
                  max={ADJUSTMENT_LIMIT}
                  format={(value) => formatSigned(value, locale)}
                  onChange={(minutes) => settings.setAdjustment(slot, minutes)}
                />
              }
            />
          ))}
        </div>
        <div className={styles.sheetActions}>
          <Button block variant="primary" onClick={() => setAdjusting(false)}>
            {t('action.done')}
          </Button>
          <Button block variant="ghost" disabled={adjusted.length === 0} onClick={settings.resetAdjustments}>
            {t('times.calc.adjust.reset')}
          </Button>
        </div>
      </Sheet>
    </Section>
  )
}
