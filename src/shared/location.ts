import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deviceTimeZone, isValidTimeZone } from './date'
import { storageKey } from './storage'

export interface SavedLocation {
  latitude: number
  longitude: number
  /** IANA zone the prayer times are shown in. */
  timeZone: string
  /** Human label such as "Cairo, Egypt", or formatted coordinates when no name could be resolved. */
  label: string
  /** ISO 3166-1 alpha-2, upper-case. Drives the default calculation method. */
  countryCode: string | null
  source: 'gps' | 'manual'
  updatedAt: number
}

interface LocationState {
  location: SavedLocation | null
  setLocation: (location: SavedLocation) => void
  clearLocation: () => void
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/**
 * Stored locations can come from an imported backup file, and the time zone is
 * handed straight to Intl all over the app, where a bad one throws. Anything
 * without usable coordinates is dropped; lesser damage is repaired.
 */
export function sanitizeLocation(value: unknown): SavedLocation | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (!isFiniteInRange(raw.latitude, -90, 90) || !isFiniteInRange(raw.longitude, -180, 180)) return null
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timeZone: typeof raw.timeZone === 'string' && isValidTimeZone(raw.timeZone) ? raw.timeZone : deviceTimeZone(),
    label: typeof raw.label === 'string' ? raw.label : '',
    countryCode:
      typeof raw.countryCode === 'string' && /^[A-Za-z]{2}$/.test(raw.countryCode)
        ? raw.countryCode.toUpperCase()
        : null,
    source: raw.source === 'gps' ? 'gps' : 'manual',
    updatedAt: isFiniteInRange(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER) ? raw.updatedAt : 0,
  }
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),
      clearLocation: () => set({ location: null }),
    }),
    {
      name: storageKey('location'),
      version: 1,
      merge: (persisted, current) => ({
        ...current,
        location: sanitizeLocation((persisted as Partial<LocationState> | undefined)?.location),
      }),
    },
  ),
)
