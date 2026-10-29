/**
 * Parity fixtures for apple/AzkarKit's AzkarContent module, produced by running the website's
 * own functions (and, for fasting and the bedtime, after-prayer and tasbih statistics, the web
 * branch's) on realistic and edge-case data. The Swift
 * tests in apple/AzkarKit/Tests/AzkarContentTests read the JSON written here and check the
 * native ports give the same answers.
 *
 *   npx vitest run --config scripts/native/content/vitest.config.ts
 *
 * Deterministic: the random data comes from a seeded generator, so a rerun writes the same files.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, vi } from 'vitest'
import { formatHijri, shiftDateKey } from '../../../src/shared/date'
import { createI18n } from '../../../src/shared/i18n'
import { PRAYERS } from '../../../src/shared/types'
import type { DateKey } from '../../../src/shared/types'
import { azkarData } from '../../../src/features/azkar/data'
import { Recitation } from '../../../src/features/azkar/reader/Recitation'
import { isShortPassage, localizedProse, snippet, toArabicIndicDigits } from '../../../src/features/azkar/reader/text'
import { azkarCompletionRate, computeAzkarStreaks, lifetimeTotals, ratePercent } from '../../../src/features/azkar/tracking'
import type { SessionHistory } from '../../../src/features/azkar/tracking'
import type { SessionRecord } from '../../../src/features/azkar/progressData'
import type { DayPhase } from '../../../src/features/azkar/clock'
import { hijriSpanOfMonth } from '../../../src/features/prayer-log/calendar'
import { csvField, historyCsv } from '../../../src/features/prayer-log/historyCsv'
import {
  completionRate,
  computeStreaks,
  firstLoggedDay,
  monthBreakdown,
  outstandingMissed,
  summarizeDay,
  wholePercent,
} from '../../../src/features/prayer-log/stats'
import {
  firstSunnahDay,
  rawatibStreaks,
  summarizeSunnahDay,
  sunnahCompletion,
  witrStreaks,
} from '../../../src/features/prayer-log/sunnahStats'
import { hasAnyRecord, lifetimePrayers, recordedDays, weeklyTotals } from '../../../src/features/prayer-log/trackerStats'
import { PRAYER_STATUSES, SUNNAH_PRAYERS } from '../../../src/features/prayer-log/types'
import type { LoggedAtEntries, LogEntries, SunnahEntries } from '../../../src/features/prayer-log/types'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const out = join(here, 'fixtures')
mkdirSync(out, { recursive: true })

function write(name: string, value: unknown) {
  writeFileSync(join(out, name), `${JSON.stringify(value)}\n`)
}

/** mulberry32: a small seeded generator, so the fixtures are the same on every run. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PHASES: DayPhase[] = ['beforeDawn', 'morning', 'midday', 'evening']

/** An instant on a day, at a given UTC hour and minute. */
function at(key: DateKey, hour: number, minute = 0): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!, hour, minute)
}

/* ---------- Prayer log data ---------- */

interface PrayerScenario {
  name: string
  entries: LogEntries
  loggedAt: LoggedAtEntries
  sunnah: SunnahEntries
  todays: DateKey[]
}

function randomPrayerScenario(name: string, seed: number, start: DateKey, days: number, density: number): PrayerScenario {
  const next = random(seed)
  const entries: LogEntries = {}
  const loggedAt: LoggedAtEntries = {}
  const sunnah: SunnahEntries = {}
  const weights: Array<[(typeof PRAYER_STATUSES)[number], number]> = [
    ['ontime', 0.5],
    ['jamaah', 0.2],
    ['late', 0.1],
    ['missed', 0.1],
    ['excused', 0.1],
  ]
  const pick = () => {
    let roll = next()
    for (const [status, weight] of weights) {
      roll -= weight
      if (roll < 0) return status
    }
    return 'ontime'
  }
  for (let index = 0; index < days; index++) {
    const key = shiftDateKey(start, index)
    if (next() > density) continue
    // Some days are wholly excused, some perfect, most mixed.
    const kind = next()
    const day: Record<string, string> = {}
    const times: Record<string, number> = {}
    for (const [slot, prayer] of PRAYERS.entries()) {
      if (kind < 0.08) day[prayer] = 'excused'
      else if (kind < 0.45) day[prayer] = next() < 0.6 ? 'ontime' : 'jamaah'
      else if (next() < 0.9) day[prayer] = pick()
      if (day[prayer] && next() < 0.85) times[prayer] = at(key, 3 + slot * 4, Math.floor(next() * 60))
    }
    if (Object.keys(day).length > 0) entries[key] = day as LogEntries[string]
    if (Object.keys(times).length > 0) loggedAt[key] = times
    const ticks: Record<string, number> = {}
    for (const [slot, prayer] of SUNNAH_PRAYERS.entries()) {
      if (next() < 0.55) ticks[prayer] = at(key, 2 + slot * 3, Math.floor(next() * 60))
    }
    if (Object.keys(ticks).length > 0) sunnah[key] = ticks
  }
  const end = shiftDateKey(start, days - 1)
  return { name, entries, loggedAt, sunnah, todays: [end, shiftDateKey(end, -3), shiftDateKey(end, -17), shiftDateKey(end, 5)] }
}

const all5 = (status: string) => Object.fromEntries(PRAYERS.map((prayer) => [prayer, status])) as LogEntries[string]

const prayerScenarios: PrayerScenario[] = [
  { name: 'empty', entries: {}, loggedAt: {}, sunnah: {}, todays: ['2026-10-29'] },
  {
    name: 'exempt days carry the run, gaps and incomplete days end it, today is never held against',
    entries: {
      '2026-10-20': all5('ontime'),
      '2026-10-21': all5('jamaah'),
      '2026-10-22': all5('excused'),
      '2026-10-23': all5('excused'),
      '2026-10-24': { fajr: 'ontime', dhuhr: 'excused', asr: 'late', maghrib: 'ontime', isha: 'ontime' },
      '2026-10-26': all5('ontime'),
      '2026-10-27': { fajr: 'ontime', dhuhr: 'missed', asr: 'ontime', maghrib: 'ontime', isha: 'ontime' },
      '2026-10-28': all5('ontime'),
      '2026-10-29': { fajr: 'ontime', dhuhr: 'missed' },
      '2026-11-02': all5('missed'),
    },
    loggedAt: { '2026-10-29': { fajr: at('2026-10-29', 3), dhuhr: at('2026-10-30', 1) } },
    sunnah: {
      '2026-10-20': { beforeFajr: at('2026-10-20', 2), witr: at('2026-10-20', 21) },
      '2026-10-21': { witr: at('2026-10-21', 23) },
      '2026-10-22': { duha: at('2026-10-22', 7) },
      '2026-10-24': { beforeFajr: 1, beforeDhuhr: 2, afterDhuhr: 3, afterMaghrib: 4, afterIsha: 5, witr: 6 },
      '2026-10-28': { witr: at('2026-10-28', 22) },
      '2026-11-03': { witr: at('2026-11-03', 22) },
    },
    todays: ['2026-10-29', '2026-10-28', '2026-10-25', '2026-10-31', '2026-11-05'],
  },
  {
    name: 'only today logged, all complete',
    entries: { '2026-10-29': all5('ontime') },
    loggedAt: {},
    sunnah: { '2026-10-29': { witr: at('2026-10-29', 20) } },
    todays: ['2026-10-29', '2026-10-30'],
  },
  {
    name: 'a day centuries back and a leap day',
    entries: { '1826-03-01': all5('ontime'), '2024-02-29': all5('late'), '2024-03-01': all5('ontime') },
    loggedAt: { '2024-02-29': { fajr: at('2024-02-29', 4) } },
    sunnah: { '1826-03-01': { qiyam: at('1826-03-01', 1) } },
    todays: ['2024-03-01', '2024-03-02', '2024-02-29'],
  },
  randomPrayerScenario('dense year', 1, '2025-10-01', 400, 0.92),
  randomPrayerScenario('sparse half year', 2, '2026-04-01', 210, 0.45),
  randomPrayerScenario('new user, a week', 3, '2026-10-23', 7, 1),
]

/* ---------- Azkar sessions ---------- */

function sessionRecord(next: () => number, key: DateKey, evening: boolean): SessionRecord {
  const total = evening ? 20 : 23
  const completed = next() < 0.7
  const done = completed ? (next() < 0.2 ? Math.floor(next() * total) : total) : Math.floor(next() * total)
  const record: SessionRecord = { completed, done, total, recitations: Math.floor(next() * 400) }
  if (next() < 0.9) {
    const start = at(key, evening ? 15 + Math.floor(next() * 10) : 3 + Math.floor(next() * 5), Math.floor(next() * 60))
    record.startedAt = start
    record.lastAt = start + Math.floor(next() * 3_600_000)
    if (completed && next() < 0.9) record.completedAt = record.lastAt
  }
  return record
}

function randomSessions(seed: number, start: DateKey, days: number, density: number): SessionHistory {
  const next = random(seed)
  const sessions: SessionHistory = {}
  for (let index = 0; index < days; index++) {
    const key = shiftDateKey(start, index)
    const day: SessionHistory[string] = {}
    if (next() < density) day.morning = sessionRecord(next, key, false)
    if (next() < density) day.evening = sessionRecord(next, key, true)
    if (next() < density / 3) day.sleep = sessionRecord(next, key, true)
    if (Object.keys(day).length > 0) sessions[key] = day
  }
  return sessions
}

const done = (key: DateKey): SessionRecord => ({ completed: true, done: 20, total: 20, recitations: 60, startedAt: at(key, 4), lastAt: at(key, 5), completedAt: at(key, 5) })
const partial = (key: DateKey): SessionRecord => ({ completed: false, done: 4, total: 20, recitations: 9, startedAt: at(key, 16), lastAt: at(key, 16, 30) })

interface AzkarScenario {
  name: string
  sessions: SessionHistory
  totals: Record<string, number>
  totalRecitations: number
  todays: DateKey[]
}

const azkarScenarios: AzkarScenario[] = [
  { name: 'empty', sessions: {}, totals: {}, totalRecitations: 0, todays: ['2026-10-29'] },
  {
    name: 'open sessions, the evening before dawn, a future record, a version 1 record',
    sessions: {
      '2026-10-24': { morning: done('2026-10-24'), evening: done('2026-10-24') },
      '2026-10-25': { morning: done('2026-10-25'), evening: done('2026-10-25') },
      '2026-10-26': { morning: done('2026-10-26'), evening: partial('2026-10-26') },
      '2026-10-27': { morning: done('2026-10-27'), evening: { completed: true, done: 20, total: 20, recitations: 0 } },
      '2026-10-28': { morning: done('2026-10-28'), evening: done('2026-10-28'), sleep: done('2026-10-28') },
      '2026-10-29': { morning: done('2026-10-29') },
      '2026-11-04': { morning: done('2026-11-04'), evening: done('2026-11-04') },
    },
    totals: { 'ayat-al-kursi': 40, 'sayyid-al-istighfar': 40, 'no-longer-in-the-dataset': 7, zero: 0 },
    totalRecitations: 500,
    todays: ['2026-10-29', '2026-10-30', '2026-10-28', '2026-11-04', '2026-11-05'],
  },
  {
    name: 'dense year',
    sessions: randomSessions(11, '2025-10-01', 394, 0.85),
    totals: { 'ayat-al-kursi': 812, 'al-ikhlas-al-falaq-an-nas': 2400, 'sayyid-al-istighfar': 812 },
    totalRecitations: 99_000,
    todays: ['2026-10-29', '2026-09-30', '2026-10-01'],
  },
  {
    name: 'sparse',
    sessions: randomSessions(12, '2026-07-01', 121, 0.35),
    totals: {},
    totalRecitations: 3,
    todays: ['2026-10-29', '2026-08-15'],
  },
]

/* ---------- Generators ---------- */

test('prayer log statistics', () => {
  const cases = prayerScenarios.map((scenario) => {
    const { entries, loggedAt, sunnah } = scenario
    const days = [...new Set([...Object.keys(entries), ...Object.keys(sunnah)])].sort()
    const results = scenario.todays.map((today) => {
      const month = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
      const months = [month, { year: month.month === 1 ? month.year - 1 : month.year, month: month.month === 1 ? 12 : month.month - 1 }, { year: month.year + 1, month: month.month }]
      const rates = [1, 7, 30, 0].map((window) => {
        const rate = completionRate(entries, today, window)
        const sunnahRate = sunnahCompletion(sunnah, entries, today, window)
        return { days: window, prayer: { ...rate, percent: wholePercent(rate) }, sunnah: sunnahRate }
      })
      return {
        today,
        firstLoggedDay: firstLoggedDay(entries, today),
        streaks: computeStreaks(entries, today),
        rates,
        months: months.map((ref) => ({ ...ref, breakdown: monthBreakdown(entries, ref, today) })),
        missed: outstandingMissed(entries, today),
        firstSunnahDay: firstSunnahDay(sunnah, today),
        witr: witrStreaks(sunnah, entries, today),
        rawatib: rawatibStreaks(sunnah, entries, today),
        lifetime: lifetimePrayers(entries, sunnah, today),
        hasAnyRecord: hasAnyRecord(entries, sunnah, {}, today),
        weeks: [0, 1, 6].map((weekStart) => ({ weekStart, totals: weeklyTotals({ entries, sunnah, sessions: {} }, today, weekStart, 8) })),
      }
    })
    return {
      name: scenario.name,
      entries,
      loggedAt,
      sunnah,
      days: days.map((key) => ({ key, summary: summarizeDay(entries[key]), sunnah: summarizeSunnahDay(sunnah[key], entries[key]) })),
      recordedDays: recordedDays({ entries, loggedAt, sunnah, sessions: {} }),
      results,
    }
  })
  write('prayer-stats.json', cases)
})

test('azkar statistics', () => {
  const cases = azkarScenarios.map((scenario) => ({
    name: scenario.name,
    sessions: scenario.sessions,
    totals: scenario.totals,
    totalRecitations: scenario.totalRecitations,
    lifetime: lifetimeTotals(scenario),
    results: scenario.todays.flatMap((today) =>
      PHASES.map((phase) => ({
        today,
        phase,
        streaks: computeAzkarStreaks(scenario.sessions, today, phase),
        rates: [7, 30, 1].map((days) => {
          const rates = azkarCompletionRate(scenario.sessions, today, phase, days)
          return { days, ...rates, percent: ratePercent(rates.all) }
        }),
        weeks: weeklyTotals({ entries: {}, sunnah: {}, sessions: scenario.sessions }, today, 6, 8),
      })),
    ),
  }))
  write('azkar-stats.json', cases)
})

test('Hijri calendar and formatting', () => {
  // Every month start from 1356 to 1500 AH, as Intl's Umm al-Qura calendar places them.
  const numeric = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  const parts = (key: DateKey) => {
    const found: Record<string, number> = {}
    const [y, m, d] = key.split('-').map(Number)
    for (const part of numeric.formatToParts(new Date(Date.UTC(y!, m! - 1, d!, 12)))) {
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') found[part.type] = Number(part.value)
    }
    return found as { year: number; month: number; day: number }
  }
  const monthStarts: Array<[DateKey, number, number]> = []
  for (let key = '1937-03-01'; key <= '2077-12-31'; key = shiftDateKey(key, 1)) {
    const hijri = parts(key)
    if (hijri.day === 1) monthStarts.push([key, hijri.year, hijri.month])
  }
  const locales = ['en', 'ar-u-nu-arab', 'ar-u-nu-latn']
  const next = random(21)
  const formatted: Array<{ key: DateKey; offset: number; text: string[] }> = []
  for (let index = 0; index < 600; index++) {
    const key = shiftDateKey('1990-01-01', Math.floor(next() * 365 * 60))
    const offset = Math.floor(next() * 5) - 2
    formatted.push({ key, offset, text: locales.map((locale) => formatHijri(key, locale, offset)) })
  }
  const spans: Array<{ year: number; month: number; offset: number; spans: Array<{ from: string; to: string | null }> }> = []
  for (let year = 2024; year <= 2031; year++) {
    for (let month = 1; month <= 12; month++) {
      for (const offset of [-2, -1, 0, 1, 2]) {
        spans.push({ year, month, offset, spans: locales.map((locale) => hijriSpanOfMonth({ year, month }, locale, offset)) })
      }
    }
  }
  write('hijri.json', { locales, monthStarts, formatted, spans })
})

test('display text', () => {
  // The bundled dataset, and the web branch's larger one (bedtime, after-prayer and tasbih items).
  const wip = JSON.parse(execFileSync('git', ['show', 'wip/web-seven-features:src/features/azkar/data/azkar.json'], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 }))
  const items = new Map<string, { arabic: string; reference: { en: string; ar: string }; virtue?: { en: string; ar: string }; note?: { en: string; ar: string } }>()
  for (const item of [...Object.values(azkarData.items), ...Object.values(wip.items as Record<string, typeof azkarData.items[string]>)]) items.set(item.id, item)
  const extra = ['', '   ', 'one', 'a b c d e f', 'a b c d e f g', '  x　y\tz\n', 'word ۚ next', ' ۖ lead', 'aۚ b ۗ', 'x ۚ ۖ y', 'a ۚ b ۛ']
  const segments = (text: string) => {
    const element = Recitation({ text }) as { props: { children: unknown[] } }
    return element.props.children.map((part) => {
      if (typeof part === 'string') return { text: part }
      const span = part as { props: { children: [string, { props: { children: string } }] } }
      return { word: span.props.children[0], mark: span.props.children[1].props.children }
    })
  }
  const texts = [...[...items.values()].map((item) => item.arabic), ...extra]
  const recitations = texts.map((text) => ({ text, snippet: snippet(text), short: isShortPassage(text), segments: segments(text) }))
  const prose = [...items.values()].flatMap((item) =>
    [item.reference, item.virtue, item.note, { en: '', ar: 'رقم 12' }, { en: 'No. 3', ar: ' ' }]
      .filter((field) => field !== undefined)
      .map((field) => ({
        field,
        en: localizedProse(field, 'en', true),
        ar: localizedProse(field, 'ar', true),
        arWestern: localizedProse(field, 'ar', false),
      })),
  )
  write('text.json', { recitations, prose, digits: ['0123456789 x 42', toArabicIndicDigits('0123456789 x 42')] })
})

test('history CSV', () => {
  const scenario = prayerScenarios.find((candidate) => candidate.name === 'sparse half year')!
  const sessions = randomSessions(31, '2026-03-20', 230, 0.5)
  const data = { entries: scenario.entries, loggedAt: scenario.loggedAt, sunnah: scenario.sunnah, sessions }
  const variants = [
    { lang: 'en' as const, digits: true, timeZone: 'Africa/Cairo', hijriOffset: 0 },
    { lang: 'ar' as const, digits: true, timeZone: 'Asia/Riyadh', hijriOffset: 1 },
    { lang: 'ar' as const, digits: false, timeZone: 'America/New_York', hijriOffset: -2 },
    { lang: 'en' as const, digits: false, timeZone: 'Pacific/Kiritimati', hijriOffset: 2 },
  ]
  const files = variants.map((variant) => ({
    ...variant,
    csv: historyCsv(data, { i18n: createI18n(variant.lang, variant.digits), timeZone: variant.timeZone, hijriOffset: variant.hijriOffset }),
  }))
  const fields = ['plain', '', 'a,b', 'say "hi"', 'line\nbreak', 'cr\rlf', '=SUM(A1)', '+1', '-2', '@me', '\tlead', "'quoted", 'عربي، نعم', 'Jumada I 18, 1448 AH']
  write('history-csv.json', { data, files, fields: fields.map((value) => [value, csvField(value)]) })
})

test('fasting (web branch)', async () => {
  // The fasting feature exists only on the web branch: copy its pure files, and the shared
  // helpers they import, into a scratch tree beside this script (git-ignored, removed after)
  // and run them from there.
  const root = join(here, '.web-branch')
  rmSync(root, { recursive: true, force: true })
  const show = (path: string) => execFileSync('git', ['show', `wip/web-seven-features:${path}`], { cwd: repo, encoding: 'utf8' })
  mkdirSync(join(root, 'src/features/fasting'), { recursive: true })
  mkdirSync(join(root, 'src/shared'), { recursive: true })
  for (const file of ['hijri', 'occasions', 'stats', 'types']) writeFileSync(join(root, `src/features/fasting/${file}.ts`), show(`src/features/fasting/${file}.ts`))
  for (const file of ['date', 'types']) writeFileSync(join(root, `src/shared/${file}.ts`), readFileSync(join(repo, `src/shared/${file}.ts`), 'utf8'))
  const occasions = await import(/* @vite-ignore */ join(root, 'src/features/fasting/occasions.ts'))
  const stats = await import(/* @vite-ignore */ join(root, 'src/features/fasting/stats.ts'))
  const hijri = await import(/* @vite-ignore */ join(root, 'src/features/fasting/hijri.ts'))

  // Compact: [day, offset, Hijri year, month, day, day of Ramadan or null, forbidden or null, reasons].
  const days: unknown[] = []
  for (const offset of [-2, 0, 2]) {
    for (let key = '2025-01-01'; key <= '2028-12-31'; key = shiftDateKey(key, 1)) {
      const info = occasions.fastingDayInfo(key, offset)
      days.push([key, offset, info.hijri.year, info.hijri.month, info.hijri.day, info.ramadanDay, info.forbidden, info.reasons])
    }
  }

  const next = random(41)
  const statuses = ['fasted', 'fasted', 'fasted', 'broken', 'excused', 'missed']
  const history: Record<DateKey, { kind: string; status: string; at?: number }> = {}
  for (let key = '2025-02-01'; key <= '2027-06-30'; key = shiftDateKey(key, 1)) {
    const info = occasions.fastingDayInfo(key, 0)
    const ramadan = info.ramadanDay !== null
    const chance = ramadan ? 0.9 : info.reasons.length > 0 ? 0.55 : 0.04
    if (next() >= chance) continue
    const kind = ramadan ? 'ramadan' : next() < 0.15 ? 'qada' : 'voluntary'
    const record: { kind: string; status: string; at?: number } = { kind, status: statuses[Math.floor(next() * statuses.length)]! }
    if (next() < 0.9) record.at = at(key, 17, Math.floor(next() * 60))
    history[key] = record
  }
  // A record on an Eid, as after a change of offset.
  history['2026-03-20'] = { kind: 'voluntary', status: 'fasted', at: at('2026-03-20', 18) }

  const todays = ['2026-10-29', '2026-03-01', '2026-03-19', '2026-03-28', '2026-04-10', '2027-02-20', '2027-06-30', '2025-03-15', '2025-02-01']
  const results = todays.flatMap((today) =>
    [0, -2, 2].map((offset) => ({
      today,
      offset,
      stats: stats.fastingStats(history, { today, offsetDays: offset, owedBefore: 3 }),
      owedNoneBefore: stats.owedDays(history, -4),
      shawwal: [0, 1, 2, 5, 10, 20, 29].map((step) => {
        const key = shiftDateKey('2026-03-20', step)
        return { key, count: stats.shawwalFastsBefore(history, key, offset) }
      }),
    })),
  )
  const empty = stats.fastingStats({}, { today: '2026-10-29' })
  const civil = [1446, 1447, 1448, 1449].flatMap((year) => [1, 9, 10, 12].map((month) => ({ year, month, days: hijri.civilDaysOfHijriMonth(year, month, 1) })))
  write('fasting.json', { days, history, results, empty, civil })
  rmSync(root, { recursive: true, force: true })
})

test('dataset accessors on the web branch dataset', async () => {
  // The web branch's dataset has the bedtime, after-prayer and tasbih lists the bundled one does
  // not have yet. Run the website's own accessors on it, with the JSON module swapped for it.
  const text = execFileSync('git', ['show', 'wip/web-seven-features:src/features/azkar/data/azkar.json'], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 })
  writeFileSync(join(out, 'web-branch-azkar.json'), text)
  vi.resetModules()
  vi.doMock('../../../src/features/azkar/data/azkar.json', () => ({ default: JSON.parse(text) }))
  const data = await import('../../../src/features/azkar/data/index')
  write('dataset.json', {
    availableCollections: data.availableCollections(),
    collections: Object.fromEntries(data.COLLECTION_IDS.map((id) => [id, data.getCollection(id).map((dhikr) => dhikr.id)])),
    afterPrayer: Object.fromEntries(PRAYERS.map((prayer) => [prayer, data.getAfterPrayerAzkar(prayer).map((dhikr) => [dhikr.id, dhikr.repeat])])),
    tasbih: data.getTasbihPresets().map((dhikr) => dhikr.id),
  })
  vi.doUnmock('../../../src/features/azkar/data/azkar.json')
})

test('bedtime, after-prayer and tasbih tracking (web branch)', async () => {
  // These statistics exist only on the web branch. Unpack its whole src tree beside this script
  // (git-ignored, removed after; the repository's own checkout is untouched) and run them there.
  const root = join(here, '.web-branch-tree')
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  const archive = execFileSync('git', ['archive', 'wip/web-seven-features', 'src'], { cwd: repo, maxBuffer: 1 << 28 })
  execFileSync('tar', ['-x', '-C', root], { input: archive })
  const tracking = await import(/* @vite-ignore */ join(root, 'src/features/azkar/tracking.ts'))
  const afterPrayer = await import(/* @vite-ignore */ join(root, 'src/features/azkar/afterPrayerTracking.ts'))
  const tasbih = await import(/* @vite-ignore */ join(root, 'src/features/azkar/tasbihTracking.ts'))
  const afterPrayerData = await import(/* @vite-ignore */ join(root, 'src/features/azkar/afterPrayer.ts'))

  // Bedtime: the random histories above, which have it on about a night in three, and a short one by hand.
  const sleepScenarios = [
    { name: 'dense year', sessions: randomSessions(51, '2025-10-01', 394, 0.85) },
    { name: 'sparse', sessions: randomSessions(52, '2026-07-01', 121, 0.6) },
    {
      name: 'by hand: last night open, a future night, a gap',
      sessions: {
        '2026-10-20': { morning: done('2026-10-20') },
        '2026-10-24': { sleep: done('2026-10-24') },
        '2026-10-26': { sleep: done('2026-10-26') },
        '2026-10-27': { sleep: partial('2026-10-27') },
        '2026-10-28': { sleep: done('2026-10-28') },
        '2026-11-02': { sleep: done('2026-11-02') },
      } as SessionHistory,
    },
  ]
  const todays = ['2026-10-29', '2026-10-28', '2026-11-02', '2026-09-30', '2025-10-01']
  const sleep = sleepScenarios.map((scenario) => ({
    name: scenario.name,
    sessions: scenario.sessions,
    results: todays.flatMap((today) =>
      PHASES.map((phase) => ({
        today,
        phase,
        streak: tracking.computeSleepStreak(scenario.sessions, today, phase),
        rates: [1, 7, 30, 0].map((days) => ({ days, ...tracking.sleepCompletionRate(scenario.sessions, today, phase, days) })),
      })),
    ),
  }))

  // After the prayers: a record per prayer per day, filed by the prayer's name.
  const randomAfterPrayer = (seed: number, start: DateKey, days: number, density: number) => {
    const next = random(seed)
    const history: Record<DateKey, Record<string, SessionRecord>> = {}
    for (let index = 0; index < days; index++) {
      const key = shiftDateKey(start, index)
      const day: Record<string, SessionRecord> = {}
      const keen = next() < 0.6
      for (const prayer of PRAYERS) {
        if (next() < (keen ? 0.95 : density)) day[prayer] = sessionRecord(next, key, prayer !== 'fajr')
      }
      if (Object.keys(day).length > 0) history[key] = day
    }
    return history
  }
  const afterPrayerScenarios = [
    { name: 'dense year', history: randomAfterPrayer(61, '2025-10-01', 394, 0.7) },
    { name: 'sparse', history: randomAfterPrayer(62, '2026-08-01', 90, 0.25) },
    {
      name: 'by hand: today under way, an incomplete Asr, a future day',
      history: {
        '2026-10-26': Object.fromEntries(PRAYERS.map((prayer) => [prayer, done('2026-10-26')])),
        '2026-10-27': Object.fromEntries(PRAYERS.map((prayer) => [prayer, done('2026-10-27')])),
        '2026-10-28': { ...Object.fromEntries(PRAYERS.map((prayer) => [prayer, done('2026-10-28')])), asr: partial('2026-10-28') },
        '2026-10-29': { fajr: done('2026-10-29') },
        '2026-11-03': { fajr: done('2026-11-03') },
      } as Record<DateKey, Record<string, SessionRecord>>,
    },
  ]
  const prayerSets = [[...PRAYERS], ['fajr', 'maghrib'], ['isha', 'fajr'], []]
  const afterPrayerResults = afterPrayerScenarios.map((scenario) => ({
    name: scenario.name,
    history: scenario.history,
    lifetime: afterPrayer.afterPrayerLifetime({ sessions: scenario.history, totals: {} }).completed,
    results: todays.flatMap((today) =>
      PHASES.map((phase) => ({
        today,
        phase,
        sets: prayerSets.map((prayers) => ({
          prayers,
          streaks: afterPrayer.computeAfterPrayerStreaks(scenario.history, today, phase, prayers),
          rates: [1, 7, 30].map((days) => ({ days, ...afterPrayer.afterPrayerCompletionRate(scenario.history, today, phase, days, prayers) })),
        })),
      })),
    ),
  }))

  // Tasbih: presets and the free count on some days, the lifetime totals kept in step with them.
  const next = random(71)
  const presets = ['subhanallah', 'alhamdulillah', 'allahu-akbar', 'astaghfirullah', 'no-longer-in-the-dataset']
  const tasbihDays: Record<DateKey, { presets: Record<string, { count: number; current: number; lastAt?: number }>; free?: { count: number; current: number; lastAt?: number } }> = {}
  const totals: Record<string, number> = {}
  let free = 0
  for (let index = 0; index < 200; index++) {
    const key = shiftDateKey('2026-04-15', index)
    if (next() > 0.4) continue
    const day: (typeof tasbihDays)[string] = { presets: {} }
    for (const preset of presets) {
      if (next() > 0.35) continue
      const count = 1 + Math.floor(next() * 300)
      day.presets[preset] = { count, current: count % 33, lastAt: at(key, 18, Math.floor(next() * 60)) }
      totals[preset] = (totals[preset] ?? 0) + count
    }
    if (next() < 0.3) {
      const count = 1 + Math.floor(next() * 500)
      day.free = { count, current: count, lastAt: at(key, 20) }
      free += count
    }
    if (Object.keys(day.presets).length > 0 || day.free) tasbihDays[key] = day
  }
  const progress = { days: tasbihDays, totals, free }
  const ranges: Array<[DateKey, DateKey]> = [['2026-04-15', '2026-11-01'], ['2026-06-01', '2026-06-30'], ['2026-10-29', '2026-10-29'], ['2027-01-01', '2027-02-01']]
  write('web-branch-tracking.json', {
    sleep,
    afterPrayer: afterPrayerResults,
    tasbihDateKeys: ['2026-10-29'].flatMap((today) => PHASES.map((phase) => ({ today, phase, key: tasbih.tasbihDateKey(today, phase), afterPrayerKey: afterPrayerData.afterPrayerDateKey(today, phase) }))),
    tasbih: {
      progress,
      lifetime: tasbih.tasbihLifetime(progress),
      ranges: ranges.map(([from, to]) => ({ from, to, days: tasbih.tasbihInRange(tasbihDays, from, to).map((entry: { dateKey: DateKey; count: number }) => [entry.dateKey, entry.count]) })),
      since: ['2026-10-31', '2026-07-04', '2026-04-15', '2026-04-14'].flatMap((today) => [1, 7, 30, 0].map((days) => ({ today, days, count: tasbih.tasbihCountSince(progress, today, days) }))),
    },
  })
  rmSync(root, { recursive: true, force: true })
})
