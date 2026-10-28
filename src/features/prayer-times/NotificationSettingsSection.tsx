import { useCallback, useId, useState } from 'react'
import { appPlatform } from '../../native'
import { useI18n } from '../../shared/i18n'
import { Notice, Row, Section, Segmented, Switch } from '../../shared/ui'
import { usePrayerTimesStore } from './config'
import type { NotificationState } from './notifications'
import { requestReminderPermission, useReminderPermission } from './reminders/permission'
import styles from './settings.module.css'

/**
 * Settings: the prayer-time reminder switch and the morning and evening azkar
 * reminders. Renders nothing where notifications do not exist.
 */
export function NotificationSettingsSection() {
  const { t } = useI18n()
  const prayerId = useId()
  const morningId = useId()
  const eveningId = useId()
  const prayers = usePrayerTimesStore((state) => state.notifications)
  const azkar = usePrayerTimesStore((state) => state.azkarReminders)
  const setPrayers = usePrayerTimesStore((state) => state.setNotifications)
  const setAzkarReminder = usePrayerTimesStore((state) => state.setAzkarReminder)
  const setMorningReminderTime = usePrayerTimesStore((state) => state.setMorningReminderTime)
  const [dismissed, setDismissed] = useState(false)
  // How many times in this visit a switch was turned on and met the block.
  const [refusals, setRefusals] = useState(0)
  // Unblocked in the settings: should it be blocked again, that is no longer the answer to anything done here.
  const onRead = useCallback((current: NotificationState) => {
    if (current !== 'denied') setRefusals(0)
  }, [])
  const { permission, setPermission } = useReminderPermission(onRead)

  if (permission === 'unsupported') return null

  const platform = appPlatform()

  const toggle = async (apply: (enabled: boolean) => void, next: boolean) => {
    setDismissed(false)
    if (!next) {
      apply(false)
      return
    }
    const result = await requestReminderPermission()
    setPermission(result)
    apply(result === 'granted')
    setDismissed(result === 'default')
    if (result === 'denied') setRefusals((count) => count + 1)
  }

  // On only when it can actually work: the stored wish plus the permission.
  // While the app is still reading the permission, the wish is shown as it is.
  const shown = (wish: boolean) => wish && (permission === 'granted' || permission === null)

  return (
    <Section title={t('times.notify.title')} footer={t(platform === 'web' ? 'times.notify.footer' : 'times.notify.footer.app')}>
      <Row
        htmlFor={prayerId}
        label={t('times.notify.switch')}
        description={t('times.notify.description')}
        control={<Switch id={prayerId} checked={shown(prayers)} onChange={(next) => void toggle(setPrayers, next)} />}
      />
      <Row
        htmlFor={morningId}
        label={t('times.notify.morning')}
        description={t(`times.notify.morning.${azkar.morningAt}`)}
        control={
          <Switch
            id={morningId}
            checked={shown(azkar.morning)}
            onChange={(next) => void toggle((enabled) => setAzkarReminder('morning', enabled), next)}
          />
        }
      />
      {shown(azkar.morning) && (
        <Row
          stacked
          label={t('times.notify.morningAt')}
          control={
            <Segmented
              block
              label={t('times.notify.morningAt')}
              value={azkar.morningAt}
              onChange={setMorningReminderTime}
              options={[
                { value: 'fajr', label: t('times.notify.morningAt.fajr') },
                { value: 'sunrise', label: t('times.notify.morningAt.sunrise') },
              ]}
            />
          }
        />
      )}
      <Row
        htmlFor={eveningId}
        label={t('times.notify.evening')}
        description={t('times.notify.evening.description')}
        control={
          <Switch
            id={eveningId}
            checked={shown(azkar.evening)}
            onChange={(next) => void toggle((enabled) => setAzkarReminder('evening', enabled), next)}
          />
        }
      />
      {permission === 'denied' && (
        // Standing information on arrival; an alert only as the answer to the user's own attempt,
        // and put in afresh for each attempt so that it is announced every time.
        <div key={refusals} className={styles.block}>
          <Notice tone="warn" alert={refusals > 0}>
            {t(platform === 'web' ? 'times.notify.denied' : `times.notify.denied.${platform}`)}
          </Notice>
        </div>
      )}
      {dismissed && permission === 'default' && (
        <div className={styles.block}>
          <Notice alert>{t('times.notify.dismissed')}</Notice>
        </div>
      )}
    </Section>
  )
}
