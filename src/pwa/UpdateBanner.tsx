import { X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { isNativeApp } from '../native'
import { useI18n } from '../shared/i18n'
import { Button, IconButton } from '../shared/ui'
import { applyUpdate, dismissUpdate, useUpdateStore } from './serviceWorker'
import styles from './UpdateBanner.module.css'

/** The adhkar reader (`/azkar/morning` and the like) keeps its counter where the banner would sit. */
const READER_PATH = /^\/azkar\/[^/]+/

/**
 * Offers a waiting app update, floating just above the tab bar. Mounted once in
 * the app shell. It holds back while the adhkar reader is open and appears when
 * the user leaves it; nothing here reloads the page without a press on Reload.
 * Never in the iOS and Android apps, which are updated through their stores.
 */
export function UpdateBanner() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const status = useUpdateStore((state) => state.status)
  const dismissed = useUpdateStore((state) => state.dismissed)

  if (status === 'idle' || dismissed || READER_PATH.test(pathname) || isNativeApp()) return null

  const applying = status === 'applying'
  return (
    <aside className={styles.banner} aria-label={t('pwa.update.label')}>
      <div className={styles.card}>
        <p className={styles.message} role="status">
          {t('pwa.update.message')}
        </p>
        <Button size="s" variant="primary" disabled={applying} onClick={applyUpdate}>
          {t('pwa.update.reload')}
        </Button>
        <IconButton label={t('pwa.update.later')} disabled={applying} onClick={dismissUpdate}>
          <X aria-hidden size={18} />
        </IconButton>
      </div>
    </aside>
  )
}
