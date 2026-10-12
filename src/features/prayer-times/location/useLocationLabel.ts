import { useI18n } from '../../../shared/i18n'
import { useLocationStore } from '../../../shared/location'
import { coordinatesLabel } from './place'

/**
 * The saved place as it should be shown, in the interface language: its
 * stored name, or its coordinates when no name was resolved. `null` when no
 * location is saved.
 */
export function useLocationLabel(): string | null {
  const i18n = useI18n()
  const location = useLocationStore((state) => state.location)
  if (!location) return null
  return (typeof location.label === 'string' && location.label) || coordinatesLabel(location.latitude, location.longitude, i18n)
}
