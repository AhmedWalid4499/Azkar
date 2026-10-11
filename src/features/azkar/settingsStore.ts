import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useI18n } from '../../shared/i18n'
import { storageKey } from '../../shared/storage'
import type { Lang } from '../../shared/types'

export const AZKAR_SETTINGS_STORAGE_KEY = storageKey('azkar-settings')
export const AZKAR_SETTINGS_VERSION = 1

/** Arabic text size steps, smallest to largest. */
export const ARABIC_SCALES = [1, 2, 3, 4, 5] as const
export type ArabicScale = (typeof ARABIC_SCALES)[number]

const ARABIC_SIZE_REM: Record<ArabicScale, number> = { 1: 1.375, 2: 1.5625, 3: 1.75, 4: 2, 5: 2.375 }

export interface AzkarSettings {
  arabicScale: ArabicScale
  /** `null` until the user chooses: shown in the English interface, hidden in the Arabic one. */
  showTransliteration: boolean | null
  /** `null` until the user chooses: shown in the English interface, hidden in the Arabic one. */
  showTranslation: boolean | null
  haptics: boolean
  keepAwake: boolean
  autoAdvance: boolean
}

interface AzkarSettingsState extends AzkarSettings {
  update: (patch: Partial<AzkarSettings>) => void
}

export const DEFAULT_AZKAR_SETTINGS: AzkarSettings = {
  arabicScale: 3,
  showTransliteration: null,
  showTranslation: null,
  haptics: true,
  keepAwake: true,
  autoAdvance: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArabicScale(value: unknown): value is ArabicScale {
  return (ARABIC_SCALES as readonly unknown[]).includes(value)
}

/** Keeps every field that is valid and falls back to the default for the rest. */
export function sanitizeAzkarSettings(value: unknown): AzkarSettings {
  const settings = { ...DEFAULT_AZKAR_SETTINGS }
  if (!isRecord(value)) return settings

  if (isArabicScale(value.arabicScale)) settings.arabicScale = value.arabicScale
  for (const key of ['showTransliteration', 'showTranslation'] as const) {
    const stored = value[key]
    if (typeof stored === 'boolean' || stored === null) settings[key] = stored
  }
  for (const key of ['haptics', 'keepAwake', 'autoAdvance'] as const) {
    const stored = value[key]
    if (typeof stored === 'boolean') settings[key] = stored
  }
  return settings
}

export const useAzkarSettings = create<AzkarSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_AZKAR_SETTINGS,
      update: (patch) => set((state) => sanitizeAzkarSettings({ ...state, ...patch })),
    }),
    {
      name: AZKAR_SETTINGS_STORAGE_KEY,
      version: AZKAR_SETTINGS_VERSION,
      partialize: (state): AzkarSettings => sanitizeAzkarSettings(state),
      // Version 1 is the only shape so far; other versions are read field by field.
      migrate: (persisted) => sanitizeAzkarSettings(persisted),
      // Stored settings can come from an imported backup, so they are validated on every load.
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, ...sanitizeAzkarSettings(persisted) },
    },
  ),
)

export function arabicFontSize(scale: ArabicScale): string {
  return `${ARABIC_SIZE_REM[scale]}rem`
}

/** Whether a reading aid shows: the user's choice, else on for English and off for Arabic. */
export function resolveAid(choice: boolean | null, lang: Lang): boolean {
  return choice ?? lang === 'en'
}

export interface ReaderPrefs {
  arabicFontSize: string
  showTransliteration: boolean
  showTranslation: boolean
  haptics: boolean
  keepAwake: boolean
  autoAdvance: boolean
}

/** The reader's settings with the language-dependent defaults filled in. */
export function useReaderPrefs(): ReaderPrefs {
  const { lang } = useI18n()
  const arabicScale = useAzkarSettings((state) => state.arabicScale)
  const showTransliteration = useAzkarSettings((state) => state.showTransliteration)
  const showTranslation = useAzkarSettings((state) => state.showTranslation)
  const haptics = useAzkarSettings((state) => state.haptics)
  const keepAwake = useAzkarSettings((state) => state.keepAwake)
  const autoAdvance = useAzkarSettings((state) => state.autoAdvance)
  return {
    arabicFontSize: arabicFontSize(arabicScale),
    showTransliteration: resolveAid(showTransliteration, lang),
    showTranslation: resolveAid(showTranslation, lang),
    haptics,
    keepAwake,
    autoAdvance,
  }
}
