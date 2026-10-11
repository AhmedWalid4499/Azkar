import { isValidTimeZone } from '../../../shared/date'
import type { Lang } from '../../../shared/types'
import { isValidCoordinate } from './geolocation'

/**
 * Both services are keyless, CORS-enabled and free for a non-commercial app.
 * They are only ever called from a button press or the search box.
 *
 * Search: Open-Meteo geocoding (GeoNames data, CC BY 4.0, attribution shown under the results).
 * Place name for a GPS fix: BigDataCloud's client-side reverse geocoder, whose fair-use
 * policy allows exactly this: the device's own current position, sent from the browser.
 */
const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

export const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 8
const REQUEST_TIMEOUT_MS = 10_000
const MAX_TEXT_LENGTH = 80

export type LookupErrorCode = 'offline' | 'failed'

export class LookupError extends Error {
  readonly code: LookupErrorCode

  constructor(code: LookupErrorCode) {
    super(`Place lookup failed: ${code}`)
    this.name = 'LookupError'
    this.code = code
  }
}

export interface CityResult {
  id: string
  name: string
  /** State, province or governorate; empty when unknown. */
  region: string
  country: string
  /** ISO 3166-1 alpha-2, upper-case. */
  countryCode: string | null
  latitude: number
  longitude: number
  timeZone: string
}

export interface PlaceName {
  /** City or district; empty when the service knew only the country. */
  name: string
  country: string
  countryCode: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : ''
}

function countryCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null
}

/** Narrows an Open-Meteo search response to the entries that are safe to use. */
export function parseSearchResponse(json: unknown): CityResult[] {
  if (!isRecord(json) || !Array.isArray(json.results)) return []
  const cities: CityResult[] = []
  for (const entry of json.results as unknown[]) {
    if (!isRecord(entry)) continue
    const name = text(entry.name)
    const { latitude, longitude, timezone } = entry
    if (name === '' || !isValidCoordinate(latitude, longitude)) continue
    // Without a usable zone the times could not be shown in local time.
    if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) continue
    const id = typeof entry.id === 'number' || typeof entry.id === 'string' ? String(entry.id) : `${latitude},${longitude}`
    if (cities.some((city) => city.id === id)) continue
    cities.push({
      id,
      name,
      region: text(entry.admin1),
      country: text(entry.country),
      countryCode: countryCode(entry.country_code),
      latitude: latitude as number,
      longitude: longitude as number,
      timeZone: timezone,
    })
    if (cities.length === MAX_RESULTS) break
  }
  return cities
}

/** Narrows a BigDataCloud reverse-geocode response. `null` when it names nothing at all. */
export function parseReverseResponse(json: unknown): PlaceName | null {
  if (!isRecord(json)) return null
  const name = text(json.city) || text(json.locality) || text(json.principalSubdivision)
  const country = text(json.countryName)
  const code = countryCode(json.countryCode)
  if (name === '' && country === '' && code === null) return null
  return { name, country, countryCode: code }
}

/** Two decimals is about a kilometre: enough to name the town, not the street. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new LookupError('offline')

  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS)
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new LookupError('failed')
    return (await response.json()) as unknown
  } catch (error) {
    // The caller cancelled (a newer keystroke): let it see the abort and stay quiet.
    if (signal?.aborted) throw error
    if (error instanceof LookupError) throw error
    throw new LookupError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function searchCities(query: string, lang: Lang, signal?: AbortSignal): Promise<CityResult[]> {
  const name = query.trim()
  if (name.length < MIN_QUERY_LENGTH) return []
  const params = new URLSearchParams({ name, count: String(MAX_RESULTS), language: lang, format: 'json' })
  return parseSearchResponse(await getJson(`${SEARCH_URL}?${params}`, signal))
}

/**
 * Names the place at a GPS fix. Only the rounded coordinates leave the device.
 * Resolves to `null` when the service has no name for the spot.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  lang: Lang,
  signal?: AbortSignal,
): Promise<PlaceName | null> {
  const params = new URLSearchParams({
    latitude: roundCoordinate(latitude).toFixed(2),
    longitude: roundCoordinate(longitude).toFixed(2),
    localityLanguage: lang,
  })
  return parseReverseResponse(await getJson(`${REVERSE_URL}?${params}`, signal))
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
