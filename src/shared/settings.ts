import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKey } from './storage'

export interface AppSettings {
  language: 'system' | 'en' | 'ar'
  theme: 'system' | 'light' | 'dark'
  timeFormat: '12h' | '24h'
  /** Show Arabic-Indic digits (٠١٢٣) when the interface is in Arabic. */
  arabicDigits: boolean
  /** Days to shift the Hijri date to match local moon sighting. */
  hijriOffset: number
}

interface SettingsState extends AppSettings {
  update: (patch: Partial<AppSettings>) => void
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
  theme: 'system',
  timeFormat: '12h',
  arabicDigits: true,
  hijriOffset: 0,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
    }),
    { name: storageKey('settings'), version: 1 },
  ),
)
