import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { dateKeyInZone } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { backupDate, clearAllData, exportBackup, importBackup, isBackupFile } from '../../shared/storage'
import type { BackupFile } from '../../shared/storage'
import { Button, Row, Section, Sheet } from '../../shared/ui'
import styles from './DataSection.module.css'

/**
 * A real backup is tens of kilobytes. The limit only keeps a file that cannot
 * be one from being read into memory.
 */
const MAX_BACKUP_BYTES = 5 * 1024 * 1024

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function DataSection() {
  const { t, locale } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const [importError, setImportError] = useState<'invalid' | 'failed' | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const handleExport = () => {
    const now = new Date()
    downloadJson(`azkar-backup-${dateKeyInZone(now)}.json`, exportBackup(now))
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Let the same file be chosen again after a failed or cancelled attempt.
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('too large')
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupFile(parsed)) throw new Error('not a backup')
      setImportError(null)
      setPendingImport(parsed)
    } catch {
      setImportError('invalid')
    }
  }

  const confirmImport = () => {
    if (!pendingImport) return
    try {
      importBackup(pendingImport)
    } catch {
      // Nothing was changed: importBackup puts the previous data back when it cannot write the new.
      setPendingImport(null)
      setImportError('failed')
      return
    }
    window.location.reload()
  }

  const confirmReset = () => {
    clearAllData()
    window.location.reload()
  }

  // The date is only there to help recognise the file; a backup without a usable one is still a backup.
  const exportedAt = pendingImport ? backupDate(pendingImport) : null
  const confirmBody = exportedAt
    ? t('settings.import.confirmBody', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(exportedAt) })
    : t('settings.import.confirmBodyNoDate')

  return (
    <Section title={t('settings.data')} footer={t('settings.data.footer')}>
      <Row
        label={t('settings.export')}
        description={t('settings.export.description')}
        control={
          <Button size="s" onClick={handleExport}>
            {t('settings.export')}
          </Button>
        }
      />
      <Row
        label={t('settings.import')}
        description={
          importError ? (
            <span role="alert" className={styles.error}>
              {t(`settings.import.${importError}`)}
            </span>
          ) : (
            t('settings.import.description')
          )
        }
        control={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleFile}
              aria-label={t('settings.import')}
            />
            <Button size="s" onClick={() => fileInput.current?.click()}>
              {t('settings.import')}
            </Button>
          </>
        }
      />
      <Row
        label={t('settings.reset')}
        description={t('settings.reset.description')}
        control={
          <Button size="s" variant="danger" onClick={() => setConfirmingReset(true)}>
            {t('settings.reset')}
          </Button>
        }
      />

      <Sheet
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title={t('settings.import.confirmTitle')}
      >
        <p className={styles.body}>{confirmBody}</p>
        <div className={styles.actions}>
          <Button block variant="primary" onClick={confirmImport}>
            {t('settings.import.confirm')}
          </Button>
          <Button block variant="ghost" onClick={() => setPendingImport(null)}>
            {t('action.cancel')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmingReset} onClose={() => setConfirmingReset(false)} title={t('settings.reset.confirmTitle')}>
        <p className={styles.body}>{t('settings.reset.confirmBody')}</p>
        <div className={styles.actions}>
          <Button block variant="danger" onClick={confirmReset}>
            {t('settings.reset.confirm')}
          </Button>
          <Button block variant="ghost" onClick={() => setConfirmingReset(false)}>
            {t('action.cancel')}
          </Button>
        </div>
      </Sheet>
    </Section>
  )
}
