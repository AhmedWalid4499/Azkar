import { useEffect, useId, useState } from 'react'
import { useI18n } from '../../shared/i18n'
import { Notice, Row, Section, Switch } from '../../shared/ui'
import { usePrayerTimesStore } from './config'
import { notificationState, requestNotificationPermission } from './notifications'
import styles from './settings.module.css'

/** Settings: the prayer-time reminder switch. Renders nothing where notifications do not exist. */
export function NotificationSettingsSection() {
  const { t } = useI18n()
  const switchId = useId()
  const enabled = usePrayerTimesStore((state) => state.notifications)
  const setEnabled = usePrayerTimesStore((state) => state.setNotifications)
  const [permission, setPermission] = useState(notificationState)
  const [dismissed, setDismissed] = useState(false)
  // How many times in this visit the switch was turned on and met the browser's block.
  const [refusals, setRefusals] = useState(0)

  // The permission can change in the browser's own settings while this page is in the background.
  useEffect(() => {
    const refresh = () => {
      const current = notificationState()
      setPermission(current)
      // Unblocked there: should it be blocked again, that is no longer the answer to anything done here.
      if (current !== 'denied') setRefusals(0)
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  if (permission === 'unsupported') return null

  const toggle = async (next: boolean) => {
    setDismissed(false)
    if (!next) {
      setEnabled(false)
      return
    }
    const result = await requestNotificationPermission()
    setPermission(result)
    setEnabled(result === 'granted')
    setDismissed(result === 'default')
    if (result === 'denied') setRefusals((count) => count + 1)
  }

  return (
    <Section title={t('times.notify.title')} footer={t('times.notify.footer')}>
      <Row
        htmlFor={switchId}
        label={t('times.notify.switch')}
        description={t('times.notify.description')}
        control={
          // On only when it can actually work: the stored wish plus the browser's permission.
          <Switch id={switchId} checked={enabled && permission === 'granted'} onChange={(next) => void toggle(next)} />
        }
      />
      {permission === 'denied' && (
        // Standing information on arrival; an alert only as the answer to the user's own attempt,
        // and put in afresh for each attempt so that it is announced every time.
        <div key={refusals} className={styles.block}>
          <Notice tone="warn" alert={refusals > 0}>
            {t('times.notify.denied')}
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
