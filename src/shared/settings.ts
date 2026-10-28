import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKey } from './storage'

export const SETTINGS_STORAGE_KEY = storageKey('settings')
export const SETTINGS_VERSION = 1

/** How far the Hijri date can be shifted, in days either way. */
export const HIJRI_OFFSET_MIN = -2
export const HIJRI_OFFSET_MAX = 2

/** Longest name kept, in characters. */
export const NAME_MAX_LENGTH = 40

export interface AppSettings {
  language: 'system' | 'en' | 'ar'
  theme: 'system' | 'light' | 'dark'
  timeFormat: '12h' | '24h'
  /** Show Arabic-Indic digits (٠١٢٣) when the interface is in Arabic. */
  arabicDigits: boolean
  /** Days to shift the Hijri date to match local moon sighting. */
  hijriOffset: number
  /** What the app calls the user in greetings and reminders. Empty when not given. */
  name: string
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
  name: '',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Control and invisible formatting characters: a name is shown inside sentences in both
// directions, and a stray direction mark from a paste would scramble the text around it.
const UNWANTED_IN_NAME = /[\p{Cc}\p{Cf}\u2028\u2029]/gu

/** A name as typed or stored, made safe to show: one line, trimmed, at most NAME_MAX_LENGTH characters. */
export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const clean = value.normalize('NFC').replace(UNWANTED_IN_NAME, '').replace(/\s+/g, ' ').trim()
  return Array.from(clean).slice(0, NAME_MAX_LENGTH).join('').trim()
}

/**
 * Reads settings out of whatever was stored. The data can come from an imported
 * or hand-edited backup, and a wrong value here breaks every screen (an unknown
 * language has no strings, a huge offset no date), so each field is checked and
 * falls back to its default on its own. Nothing is coerced: an offset of "1" is
 * not a number.
 */
export function sanitizeSettings(value: unknown): AppSettings {
  const stored = isRecord(value) ? value : {}
  const { language, theme, timeFormat, arabicDigits, hijriOffset, name } = stored
  return {
    language: language === 'system' || language === 'en' || language === 'ar' ? language : DEFAULT_SETTINGS.language,
    theme: theme === 'system' || theme === 'light' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
    timeFormat: timeFormat === '12h' || timeFormat === '24h' ? timeFormat : DEFAULT_SETTINGS.timeFormat,
    arabicDigits: typeof arabicDigits === 'boolean' ? arabicDigits : DEFAULT_SETTINGS.arabicDigits,
    hijriOffset:
      typeof hijriOffset === 'number' && Number.isInteger(hijriOffset)
        ? Math.min(HIJRI_OFFSET_MAX, Math.max(HIJRI_OFFSET_MIN, hijriOffset))
        : DEFAULT_SETTINGS.hijriOffset,
    name: sanitizeName(name),
  }
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set((state) => sanitizeSettings({ ...state, ...patch })),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: SETTINGS_VERSION,
      partialize: (state): AppSettings => sanitizeSettings(state),
      // Version 1 is the only shape so far; other versions are read field by field.
      migrate: (persisted) => sanitizeSettings(persisted),
      // Validated on every load, and only the known settings are taken, so stored
      // data can never replace `update`. With nothing stored this gives the defaults.
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
)
