import { LoaderCircle, LocateFixed, Search } from 'lucide-react'
import { useState } from 'react'
import { appPlatform } from '../../../native'
import { useI18n } from '../../../shared/i18n'
import type { StringKey } from '../../../shared/i18n'
import { useLocationStore } from '../../../shared/location'
import { Button, Notice, Sheet } from '../../../shared/ui'
import { CitySearch } from './CitySearch'
import styles from './location.module.css'
import type { GeoErrorCode } from './geolocation'
import { cityToLocation } from './place'
import { useLocate } from './useLocate'

/** In the app a refusal is undone in the system Settings app, not in a browser's site settings. */
function errorKey(error: GeoErrorCode): StringKey {
  const platform = appPlatform()
  return error === 'denied' && platform !== 'web' ? `times.location.error.denied.${platform}` : `times.location.error.${error}`
}

interface LocationActionsProps {
  /** Wording of the GPS button: "Use my location" or "Update location". */
  gpsLabel: string
}

/** The two ways to set a location, with their progress and errors. Shared by the first-run card and Settings. */
export function LocationActions({ gpsLabel }: LocationActionsProps) {
  const { t } = useI18n()
  const { status, error, unnamed, locate, dismiss } = useLocate()
  const [searching, setSearching] = useState(false)
  const busy = status !== 'idle'
  const progress = busy ? t(status === 'locating' ? 'times.location.locating' : 'times.location.naming') : ''
  // How it ended, when that needs saying: the position was saved but has no name.
  const outcome = unnamed && !busy ? t(`times.location.unnamed.${unnamed}`) : ''

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        <Button variant="primary" block disabled={busy} onClick={() => void locate()}>
          <LocateFixed aria-hidden size={18} />
          {gpsLabel}
        </Button>
        <Button block onClick={() => setSearching(true)}>
          <Search aria-hidden size={18} />
          {t('times.location.search')}
        </Button>
      </div>

      {busy && (
        <p className={styles.progress} aria-hidden>
          <LoaderCircle className={styles.spinner} size={16} />
          {progress}
        </p>
      )}
      {/* One region, always present, so progress and outcome are both announced as its content changes.
          Progress is spoken only (the spinner above shows it); the outcome is also the visible notice. */}
      <div className={outcome ? undefined : 'visually-hidden'} role="status">
        {outcome ? <Notice>{outcome}</Notice> : progress}
      </div>

      {error && (
        <Notice tone="danger" alert>
          {t(errorKey(error))}
        </Notice>
      )}

      <Sheet open={searching} onClose={() => setSearching(false)} title={t('times.location.search')}>
        <CitySearch
          onSelect={(city) => {
            // The choice replaces whatever "Use my location" was doing or had reported.
            dismiss()
            useLocationStore.getState().setLocation(cityToLocation(city, t))
            setSearching(false)
          }}
        />
      </Sheet>
    </div>
  )
}
