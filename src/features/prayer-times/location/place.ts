import { deviceTimeZone, isValidTimeZone } from '../../../shared/date'
import type { I18n } from '../../../shared/i18n'
import type { SavedLocation } from '../../../shared/location'
import type { Place } from '../engine/compute'
import type { CityResult } from './geocoding'
import { isValidCoordinate } from './geolocation'

/**
 * The saved location as the engine needs it, or `null` when it cannot be used.
 * The store is restored from local storage (possibly an imported backup), so
 * nothing about its shape is taken on trust.
 */
export function toPlace(location: SavedLocation | null | undefined): Place | null {
  if (typeof location !== 'object' || location === null) return null
  const { latitude, longitude, timeZone, countryCode } = location
  if (!isValidCoordinate(latitude, longitude)) return null
  return {
    latitude,
    longitude,
    timeZone: typeof timeZone === 'string' && isValidTimeZone(timeZone) ? timeZone : deviceTimeZone(),
    countryCode: typeof countryCode === 'string' ? countryCode : null,
  }
}

export function placeLabel(name: string, country: string, t: I18n['t']): string {
  return [name, country].filter((part) => part !== '').join(t('times.listSeparator'))
}

/** Stand-in label when no place name is available, e.g. "30.04° N, 31.24° E". */
export function coordinatesLabel(latitude: number, longitude: number, { t, locale }: I18n): string {
  const degrees = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return t('times.location.coordinates', {
    latitude: t(latitude < 0 ? 'times.location.south' : 'times.location.north', { value: degrees.format(Math.abs(latitude)) }),
    longitude: t(longitude < 0 ? 'times.location.west' : 'times.location.east', { value: degrees.format(Math.abs(longitude)) }),
  })
}

export function cityToLocation(city: CityResult, t: I18n['t'], now: number = Date.now()): SavedLocation {
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    timeZone: city.timeZone,
    label: placeLabel(city.name, city.country, t),
    countryCode: city.countryCode,
    source: 'manual',
    updatedAt: now,
  }
}
