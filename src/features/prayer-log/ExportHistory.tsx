import { FileDown } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { saveTextFile } from '../../native'
import { dateKeyInZone } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { useActiveTimeZone } from '../../shared/time'
import { Button, Card } from '../../shared/ui'
import { useAzkarProgress } from '../azkar'
import styles from './ExportHistory.module.css'
import { historyCsv } from './historyCsv'
import { usableTimeZone } from './stamps'
import { usePrayerLog } from './store'

interface ExportHistoryProps {
  /** Whether anything has been recorded yet; until then there is nothing to export. */
  hasRecord: boolean
}

/**
 * Hands every recorded day to the user as a CSV file: a download in a browser, the
 * share sheet in the app. The JSON backup in Settings stays the file to restore from.
 */
export function ExportHistory({ hasRecord }: ExportHistoryProps) {
  const i18n = useI18n()
  const { t } = i18n
  const headingId = useId()
  const timeZone = usableTimeZone(useActiveTimeZone())
  const hijriOffset = useSettings((state) => state.hijriOffset)
  /** The share sheet is up: a second press would be turned down by the system. */
  const exporting = useRef(false)
  const [failed, setFailed] = useState(false)

  const handleExport = async () => {
    if (exporting.current) return
    exporting.current = true
    try {
      // Read at the moment of export, so the page does not re-render for every change to the stores.
      const { entries, loggedAt, sunnah } = usePrayerLog.getState()
      const { sessions } = useAzkarProgress.getState()
      const csv = historyCsv({ entries, loggedAt, sunnah, sessions }, { i18n, timeZone, hijriOffset })
      await saveTextFile(`azkar-history-${dateKeyInZone(new Date(), timeZone)}.csv`, csv, 'text/csv')
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      exporting.current = false
    }
  }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('log.export.title')}
      </h2>
      <Card className={styles.card}>
        {hasRecord ? (
          <>
            <p className={styles.body}>{t('log.export.description')}</p>
            {failed && (
              <p role="alert" className={styles.error}>
                {t('log.export.failed')}
              </p>
            )}
            <Button className={styles.button} onClick={handleExport}>
              <FileDown aria-hidden size={18} />
              {t('log.export.button')}
            </Button>
          </>
        ) : (
          <p className={styles.body}>{t('log.export.empty')}</p>
        )}
      </Card>
    </section>
  )
}
