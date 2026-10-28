import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { isNativeApp } from '../../../native'
import { useI18n } from '../../../shared/i18n'
import { useLocationStore } from '../../../shared/location'
import { Button, Card } from '../../../shared/ui'
import { usePrayerTimesStore } from '../config'
import { requestReminderPermission, useReminderPermission } from './permission'
import styles from './ReminderPrompt.module.css'

/**
 * Only the answer to this card. Kept outside the app's own keys on purpose: it is
 * not part of the user's record, so it is neither backed up nor mirrored.
 */
export const PROMPT_DISMISSED_KEY = 'azkar-ui:reminder-prompt-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// Stable across renders, as useReminderPermission requires; this card needs no notice of each reading.
const noop = () => {}

/**
 * In the installed app, offers prayer-time reminders in one tap, once a place
 * is set and while the system has not been asked yet. Gone once answered, or
 * for good after "Not now"; Settings keeps the switch either way.
 */
export function ReminderPrompt() {
  const { t } = useI18n()
  const hasLocation = useLocationStore((state) => state.location !== null)
  const enabled = usePrayerTimesStore((state) => state.notifications)
  const setEnabled = usePrayerTimesStore((state) => state.setNotifications)
  const { permission, setPermission } = useReminderPermission(noop)
  const [dismissed, setDismissed] = useState(readDismissed)
  const [asking, setAsking] = useState(false)

  if (!isNativeApp() || !hasLocation || enabled || dismissed || permission !== 'default') return null

  const turnOn = async () => {
    setAsking(true)
    const result = await requestReminderPermission()
    setAsking(false)
    setPermission(result)
    if (result === 'granted') setEnabled(true)
  }

  const notNow = () => {
    setDismissed(true)
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, '1')
    } catch {
      // Shown again next time; harmless.
    }
  }

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <BellRing aria-hidden size={22} className={styles.icon} />
        <h2 className={styles.title}>{t('times.remindPrompt.title')}</h2>
      </div>
      <p className={styles.body}>{t('times.remindPrompt.body')}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => void turnOn()} disabled={asking}>
          {t('times.remindPrompt.turnOn')}
        </Button>
        <Button variant="ghost" onClick={notNow}>
          {t('times.remindPrompt.notNow')}
        </Button>
      </div>
    </Card>
  )
}
