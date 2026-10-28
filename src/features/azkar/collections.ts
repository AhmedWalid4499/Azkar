import { Moon, MoonStar, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { COLLECTION_IDS } from './data'
import type { CollectionId } from './data'

interface CollectionMeta {
  /** The session's name in Arabic, shown alongside the translated title. */
  arabicTitle: string
  icon: LucideIcon
}

export const COLLECTION_META: Record<CollectionId, CollectionMeta> = {
  morning: { arabicTitle: 'أذكار الصباح', icon: Sun },
  evening: { arabicTitle: 'أذكار المساء', icon: Moon },
  sleep: { arabicTitle: 'أذكار النوم', icon: MoonStar },
}

/** The two sessions of every day, which the Today page shows and the streaks and rates follow. Bedtime is left out. */
export const DAILY_COLLECTIONS = ['morning', 'evening'] as const satisfies readonly CollectionId[]

export function isCollectionId(value: unknown): value is CollectionId {
  return (COLLECTION_IDS as readonly unknown[]).includes(value)
}

export function collectionPath(collection: CollectionId): string {
  return `/azkar/${collection}`
}

/** The tasbih counter. */
export const TASBIH_PATH = '/azkar/tasbih'
