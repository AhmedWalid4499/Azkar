import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { dateKeyInZone } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { clearAllData, exportBackup, importBackup, isBackupFile } from '../../shared/storage'
import type { BackupFile } from '../../shared/storage'
import { Button, Row, Section, Sheet } from '../../shared/ui'
import styles from './DataSection.module.css'

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
  const [importError, setImportError] = useState(false)
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
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupFile(parsed)) throw new Error('not a backup')
      setImportError(false)
      setPendingImport(parsed)
    } catch {
      setImportError(true)
    }
  }

  const confirmImport = () => {
    if (!pendingImport) return
    importBackup(pendingImport)
    window.location.reload()
  }

  const confirmReset = () => {
    clearAllData()
    window.location.reload()
  }

  const exportedAt = pendingImport
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(pendingImport.exportedAt))
    : ''

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
              {t('settings.import.invalid')}
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
        <p className={styles.body}>{t('settings.import.confirmBody', { date: exportedAt })}</p>
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
