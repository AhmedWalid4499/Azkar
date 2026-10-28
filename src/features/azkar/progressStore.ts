import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isValidDateKey } from '../../shared/date'
import { storageKey } from '../../shared/storage'
import type { DateKey, PrayerName } from '../../shared/types'
import { isPrayerName } from './afterPrayer'
import { emptyAfterPrayer, sanitizeAfterPrayer } from './afterPrayerData'
import type { AfterPrayerProgress } from './afterPrayerData'
import { isCollectionId } from './collections'
import { getAfterPrayerAzkar, getCollection, getTasbihPresets } from './data'
import type { CollectionId } from './data'
import { isRecord, MAX_LIFETIME_RECITATIONS, sanitizeProgress } from './progressData'
import type { ProgressData, SessionRecord } from './progressData'
import { progressStorage } from './progressStorage'
import { migrateProgressV1, toVersion1History } from './progressV1'
import type { ProgressDataV1 } from './progressV1'
import { countIn, resetIn, withTally } from './readingCounts'
import type { Counts } from './session'
import { tasbihCounted, tasbihReset } from './tasbihCounts'
import type { TasbihSlot } from './tasbihCounts'
import { emptyTasbih, sanitizeTasbih } from './tasbihData'
import type { TasbihProgress } from './tasbihData'

export { DETAIL_DAYS, pruneOlderThan, sanitizeProgress, SESSION_DAYS } from './progressData'
export type { DayCounts, DaySessions, ProgressData, SessionRecord } from './progressData'

export const AZKAR_PROGRESS_STORAGE_KEY = storageKey('azkar-progress')
/**
 * 2: session records with times, lifetime totals, counts kept for 30 days instead of 7.
 * 3: the azkar after the prayers, and the tasbih counter. Nothing of version 2 changed.
 */
export const AZKAR_PROGRESS_VERSION = 3

/** Everything the store keeps: the sessions of the day as version 2 had them, and what version 3 added. */
export interface AzkarProgressData extends ProgressData {
  afterPrayer: AfterPrayerProgress
  tasbih: TasbihProgress
}

/** What is saved: the data, and its completions again in version 1's shape (see `toVersion1History`). */
export type StoredProgress = AzkarProgressData & Pick<ProgressDataV1, 'history'>

export interface ProgressState extends AzkarProgressData {
  /** Counts one repetition, up to the dhikr's target. */
  increment: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Takes back one repetition. */
  decrement: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Sets a dhikr straight to its target. */
  complete: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /**
   * Clears a session's counts for one day. The day's record keeps its completion and its
   * recitations, and its `done` goes back to 0 with the counts. A completion recorded before
   * the reset is not protected from then on, though: read the session to the end again,
   * undo that final count, and the completion goes (see `countIn` in readingCounts).
   */
  resetSession: (dateKey: DateKey, collection: CollectionId) => void

  /** As `increment`, for the azkar after one prayer (with that prayer's counts). */
  incrementAfterPrayer: (dateKey: DateKey, prayer: PrayerName, dhikrId: string) => void
  decrementAfterPrayer: (dateKey: DateKey, prayer: PrayerName, dhikrId: string) => void
  completeAfterPrayer: (dateKey: DateKey, prayer: PrayerName, dhikrId: string) => void
  resetAfterPrayer: (dateKey: DateKey, prayer: PrayerName) => void

  /** One more on the tasbih counter of a preset (its dhikr id) or of the free count (`null`). */
  countTasbih: (dateKey: DateKey, slot: TasbihSlot) => void
  /** Takes the counter's last count back, while it shows one. */
  undoTasbih: (dateKey: DateKey, slot: TasbihSlot) => void
  /** Puts the counter back to 0. What was counted that day stays counted. */
  resetTasbih: (dateKey: DateKey, slot: TasbihSlot) => void
}

type Change = (count: number, target: number) => number

const ADD_ONE: Change = (count) => count + 1
const TAKE_ONE: Change = (count) => count - 1
const TO_TARGET: Change = (_count, target) => target

function own(tally: Record<string, number>, id: string): number {
  return Object.hasOwn(tally, id) ? (tally[id] ?? 0) : 0
}

/** Every count in the reader goes into the lifetime totals: the sessions' and the after-prayer azkar's. */
function withRecitations(state: ProgressData, dhikrId: string, change: number): Pick<ProgressData, 'totals' | 'totalRecitations'> {
  const totals = withTally(state.totals, dhikrId, change)
  if (totals === state.totals) return { totals: state.totals, totalRecitations: state.totalRecitations }
  const added = own(totals, dhikrId) - own(state.totals, dhikrId)
  const totalRecitations = Math.min(MAX_LIFETIME_RECITATIONS, Math.max(0, state.totalRecitations + added))
  return { totals, totalRecitations }
}

/** Applies `change` to one dhikr's count in a session (see `countIn`). */
function applyCount(
  state: ProgressState,
  dateKey: DateKey,
  collection: CollectionId,
  dhikrId: string,
  change: Change,
): Partial<AzkarProgressData> {
  if (!isValidDateKey(dateKey) || !isCollectionId(collection)) return state
  const counted = countIn(state, dateKey, collection, getCollection(collection), dhikrId, change)
  if (!counted) return state
  return { days: counted.days, sessions: counted.sessions, ...withRecitations(state, dhikrId, counted.change) }
}

function applyReset(state: ProgressState, dateKey: DateKey, collection: CollectionId): Partial<AzkarProgressData> {
  const reset = resetIn(state, dateKey, collection)
  return reset ? { days: reset.days, sessions: reset.sessions } : state
}

/** As `applyCount`, after one prayer. Its repetitions count in its own totals and in everyone's. */
function applyAfterPrayerCount(
  state: ProgressState,
  dateKey: DateKey,
  prayer: PrayerName,
  dhikrId: string,
  change: Change,
): Partial<AzkarProgressData> {
  if (!isValidDateKey(dateKey) || !isPrayerName(prayer)) return state
  const counted = countIn(state.afterPrayer, dateKey, prayer, getAfterPrayerAzkar(prayer), dhikrId, change)
  if (!counted) return state
  return {
    afterPrayer: {
      days: counted.days,
      sessions: counted.sessions,
      totals: withTally(state.afterPrayer.totals, dhikrId, counted.change),
    },
    ...withRecitations(state, dhikrId, counted.change),
  }
}

function applyAfterPrayerReset(state: ProgressState, dateKey: DateKey, prayer: PrayerName): Partial<AzkarProgressData> {
  const reset = resetIn(state.afterPrayer, dateKey, prayer)
  return reset ? { afterPrayer: { ...state.afterPrayer, days: reset.days, sessions: reset.sessions } } : state
}

/** A preset of the dataset's tasbih list, or the free count. */
function isTasbihSlot(slot: unknown): slot is TasbihSlot {
  return slot === null || (typeof slot === 'string' && getTasbihPresets().some((preset) => preset.id === slot))
}

function applyTasbih(
  state: ProgressState,
  dateKey: DateKey,
  slot: TasbihSlot,
  next: (tasbih: TasbihProgress) => TasbihProgress | null,
): Partial<AzkarProgressData> {
  if (!isValidDateKey(dateKey) || !isTasbihSlot(slot)) return state
  const tasbih = next(state.tasbih)
  return tasbih ? { tasbih } : state
}

/** Version 1's completions lived in `history`; version 2 has `sessions` instead. */
function hasSessions(value: unknown): boolean {
  return isRecord(value) && isRecord(value.sessions)
}

function hasVersion1Shape(value: unknown): boolean {
  return isRecord(value) && isRecord(value.history) && !hasSessions(value)
}

/**
 * The sessions of the day. The shape decides before the stamp, so that no stamp can cost a
 * record: data with `sessions` is read as version 2 or later whatever its stamp, and data with
 * `history` and no `sessions` as version 1 (a hand-edited backup with no version, say).
 * Otherwise anything stamped older than version 2 is version 1, and data stamped with a newer
 * version (a backup from a newer build) is read as far as it can be understood.
 */
function readSessions(persisted: unknown, version?: number): ProgressData {
  if (hasSessions(persisted)) return sanitizeProgress(persisted)
  if ((version !== undefined && version < 2) || hasVersion1Shape(persisted)) return migrateProgressV1(persisted)
  return sanitizeProgress(persisted)
}

/** What version 3 added. Versions 1 and 2 have neither, so both start empty there. */
function readAdded(value: unknown): Pick<AzkarProgressData, 'afterPrayer' | 'tasbih'> {
  const added = isRecord(value) ? value : {}
  return { afterPrayer: sanitizeAfterPrayer(added.afterPrayer), tasbih: sanitizeTasbih(added.tasbih) }
}

/**
 * Any stored version, validated. Data saved by an older build has no after-prayer or tasbih
 * records, unless the spare copy had them put back (see `progressStorage`).
 */
function readProgress(persisted: unknown, version?: number): AzkarProgressData {
  return { ...readSessions(persisted, version), ...readAdded(persisted) }
}

/** Keeps only what is certainly progress, in every part of the store (see `sanitizeProgress`). */
export function sanitizeAzkarProgress(value: unknown): AzkarProgressData {
  return { ...sanitizeProgress(value), ...readAdded(value) }
}

export function emptyAzkarProgress(): AzkarProgressData {
  return { days: {}, sessions: {}, totals: {}, totalRecitations: 0, afterPrayer: emptyAfterPrayer(), tasbih: emptyTasbih() }
}

export const useAzkarProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...emptyAzkarProgress(),
      increment: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, ADD_ONE)),
      decrement: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, TAKE_ONE)),
      complete: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, TO_TARGET)),
      resetSession: (dateKey, collection) => set((state) => applyReset(state, dateKey, collection)),

      incrementAfterPrayer: (dateKey, prayer, dhikrId) =>
        set((state) => applyAfterPrayerCount(state, dateKey, prayer, dhikrId, ADD_ONE)),
      decrementAfterPrayer: (dateKey, prayer, dhikrId) =>
        set((state) => applyAfterPrayerCount(state, dateKey, prayer, dhikrId, TAKE_ONE)),
      completeAfterPrayer: (dateKey, prayer, dhikrId) =>
        set((state) => applyAfterPrayerCount(state, dateKey, prayer, dhikrId, TO_TARGET)),
      resetAfterPrayer: (dateKey, prayer) => set((state) => applyAfterPrayerReset(state, dateKey, prayer)),

      countTasbih: (dateKey, slot) =>
        set((state) => applyTasbih(state, dateKey, slot, (tasbih) => tasbihCounted(tasbih, dateKey, slot, 1))),
      undoTasbih: (dateKey, slot) =>
        set((state) => applyTasbih(state, dateKey, slot, (tasbih) => tasbihCounted(tasbih, dateKey, slot, -1))),
      resetTasbih: (dateKey, slot) =>
        set((state) => applyTasbih(state, dateKey, slot, (tasbih) => tasbihReset(tasbih, dateKey, slot))),
    }),
    {
      name: AZKAR_PROGRESS_STORAGE_KEY,
      version: AZKAR_PROGRESS_VERSION,
      storage: progressStorage(),
      partialize: (state): StoredProgress => ({
        days: state.days,
        sessions: state.sessions,
        totals: state.totals,
        totalRecitations: state.totalRecitations,
        afterPrayer: state.afterPrayer,
        tasbih: state.tasbih,
        history: toVersion1History(state.sessions),
      }),
      migrate: readProgress,
      // Validated on every load, whatever version the data claims to be.
      merge: (persisted, current) => (persisted === undefined ? current : { ...current, ...readProgress(persisted) }),
    },
  ),
)

/** One session's counts for a day, or `undefined` when nothing is counted yet. */
export function useSessionCounts(dateKey: DateKey, collection: CollectionId): Counts | undefined {
  return useAzkarProgress((state) => state.days[dateKey]?.[collection])
}

/** One session's record for a day, or `undefined` when it was not read that day. */
export function useSessionRecord(dateKey: DateKey, collection: CollectionId): SessionRecord | undefined {
  return useAzkarProgress((state) => state.sessions[dateKey]?.[collection])
}
