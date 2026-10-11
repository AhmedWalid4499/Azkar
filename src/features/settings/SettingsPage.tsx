import { useId } from 'react'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { PageHeader, Row, Section, Segmented, Stepper, Switch } from '../../shared/ui'
import { AzkarSettingsSection, AzkarSourcesSection } from '../azkar'
import { CalculationSettingsSection, LocationSettingsSection, NotificationSettingsSection } from '../prayer-times'
import { DataSection } from './DataSection'

export function SettingsPage() {
  const { t, lang, n } = useI18n()
  const settings = useSettings()
  const digitsId = useId()

  const formatOffset = (value: number) => (value > 0 ? `+${n(value)}` : n(value))

  return (
    <div className="page">
      <PageHeader title={t('settings.title')} />

      <LocationSettingsSection />
      <CalculationSettingsSection />
      <NotificationSettingsSection />
      <AzkarSettingsSection />

      <Section title={t('settings.general')}>
        <Row
          stacked
          label={t('settings.language')}
          control={
            <Segmented
              block
              label={t('settings.language')}
              value={settings.language}
              onChange={(language) => settings.update({ language })}
              options={[
                { value: 'system', label: t('settings.language.system') },
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية' },
              ]}
            />
          }
        />
        <Row
          stacked
          label={t('settings.theme')}
          control={
            <Segmented
              block
              label={t('settings.theme')}
              value={settings.theme}
              onChange={(theme) => settings.update({ theme })}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
              ]}
            />
          }
        />
        <Row
          stacked
          label={t('settings.timeFormat')}
          control={
            <Segmented
              block
              label={t('settings.timeFormat')}
              value={settings.timeFormat}
              onChange={(timeFormat) => settings.update({ timeFormat })}
              options={[
                { value: '12h', label: t('settings.timeFormat.12h') },
                { value: '24h', label: t('settings.timeFormat.24h') },
              ]}
            />
          }
        />
        {lang === 'ar' && (
          <Row
            htmlFor={digitsId}
            label={t('settings.arabicDigits')}
            description={t('settings.arabicDigits.description')}
            control={
              <Switch
                id={digitsId}
                checked={settings.arabicDigits}
                onChange={(arabicDigits) => settings.update({ arabicDigits })}
              />
            }
          />
        )}
        <Row
          label={t('settings.hijriOffset')}
          description={t('settings.hijriOffset.description')}
          control={
            <Stepper
              label={t('settings.hijriOffset')}
              value={settings.hijriOffset}
              min={-2}
              max={2}
              format={formatOffset}
              onChange={(hijriOffset) => settings.update({ hijriOffset })}
            />
          }
        />
      </Section>

      <DataSection />

      <AzkarSourcesSection />

      <Section title={t('settings.about')} footer={t('settings.privacy.body')}>
        <Row label={t('settings.version')} control={<span className="tabular">{__APP_VERSION__}</span>} />
      </Section>
    </div>
  )
}
