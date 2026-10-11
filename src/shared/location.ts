import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKey } from './storage'

export interface SavedLocation {
  latitude: number
  longitude: number
  /** IANA zone the prayer times are shown in. */
  timeZone: string
  /** Human label such as "Cairo, Egypt". Empty when it could not be resolved. */
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

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),
      clearLocation: () => set({ location: null }),
    }),
    { name: storageKey('location'), version: 1 },
  ),
)
