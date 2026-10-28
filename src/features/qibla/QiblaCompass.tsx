import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { isNativeApp } from '../../native'
import { useI18n } from '../../shared/i18n'
import type { StringKey } from '../../shared/i18n'
import { Button, Card, Notice } from '../../shared/ui'
import type { QiblaDirection } from './bearing'
import { formatDegrees } from './format'
import { isPoorAccuracy, signedDelta } from './heading'
import { QiblaDial } from './QiblaDial'
import { QiblaFacts } from './QiblaFacts'
import { useAlignment } from './useAlignment'
import { useCompass } from './useCompass'
import type { CompassStatus } from './useCompass'
import { useRestrainedText } from './useRestrainedText'
import styles from './QiblaPage.module.css'

/** Why the dial stands still, for each state without a live heading. */
function stillReason(status: CompassStatus): StringKey | null {
  switch (status) {
    case 'idle':
      // The app's web view grants access by itself (Capacitor answers WebKit's prompt), so nothing is asked there.
      return isNativeApp() ? 'qibla.compass.ask.app' : 'qibla.compass.ask'
    case 'starting':
      return 'qibla.compass.starting'
    case 'denied':
      return isNativeApp() ? 'qibla.compass.denied.app' : 'qibla.compass.denied.web'
    case 'unavailable':
      return 'qibla.compass.unavailable'
    case 'unsupported':
      return 'qibla.compass.unsupported'
    case 'live':
      return null
  }
}

/**
 * The dial, live where the device has a compass and fixed with north at the top
 * where it has not, then the bearing in figures and the notes on using a compass.
 */
export function QiblaCompass({ qibla }: { qibla: QiblaDirection }) {
  const { bearing } = qibla
  const i18n = useI18n()
  const { t } = i18n
  const { status, heading, accuracy, start } = useCompass()
  const turn = status === 'live' && heading !== null ? signedDelta(heading, bearing) : null
  const aligned = useAlignment(turn)
  const statusText = useRef<HTMLDivElement>(null)
  const pressed = useRef(false)

  const reason = stillReason(status)
  const fixed = status === 'denied' || status === 'unavailable' || status === 'unsupported'
  const instruction =
    turn === null
      ? ''
      : aligned
        ? t('qibla.aligned')
        : t(turn > 0 ? 'qibla.turn.right' : 'qibla.turn.left', { degrees: formatDegrees(Math.abs(turn), i18n) })
  const announced = useRestrainedText(reason ? t(reason) : instruction, `${status}:${aligned}`)

  // The button goes away once pressed; the focus goes to what replaced it rather than to the page.
  useEffect(() => {
    if (!pressed.current || status === 'idle') return
    pressed.current = false
    statusText.current?.focus()
  }, [status])

  return (
    <>
      <Card className={styles.compass}>
        <QiblaDial
          bearing={bearing}
          heading={turn === null ? 0 : (heading ?? 0)}
          aligned={aligned}
          label={t('qibla.dial', { degrees: formatDegrees(bearing, i18n) })}
        />
        <div ref={statusText} tabIndex={-1} className={styles.status}>
          {turn !== null ? (
            <p className={aligned ? `${styles.instruction} ${styles.aligned}` : styles.instruction}>
              {aligned && <Check aria-hidden size={22} strokeWidth={2.4} />}
              <span className="tabular">{instruction}</span>
            </p>
          ) : (
            <>
              {reason && <p className={styles.reason}>{t(reason)}</p>}
              {fixed && <p className={styles.reason}>{t('qibla.fixed')}</p>}
            </>
          )}
          {status === 'idle' && (
            <Button
              variant="primary"
              onClick={() => {
                pressed.current = true
                start()
              }}
            >
              {t('qibla.compass.start')}
            </Button>
          )}
          {status === 'live' && isPoorAccuracy(accuracy) && <Notice tone="warn">{t('qibla.compass.calibrate')}</Notice>}
        </div>
        <p className="visually-hidden" role="status">
          {announced}
        </p>
      </Card>
      <QiblaFacts qibla={qibla} />
      {!fixed && (
        <div className={styles.notes}>
          <p>{t('qibla.compass.hold')}</p>
          <p>{t('qibla.magnetic')}</p>
        </div>
      )}
    </>
  )
}
