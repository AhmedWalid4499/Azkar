import { describe, expect, it } from 'vitest'
import { formatClock } from '../../shared/date'
import { createI18n } from '../../shared/i18n'
import type { PrayerDay } from '../../shared/types'
import { buildWidgetSnapshot, DAYS_AFTER, DAYS_BEFORE, WIDGET_SNAPSHOT_VERSION, widgetLabels } from './snapshot'
import type { SnapshotInput } from './snapshot'
import fixture from './snapshot.fixture.json'

const ZONE = 'Africa/Cairo'
const utc = (iso: string) => new Date(`${iso}Z`)

/** A day in Cairo (UTC+3), at 05:28, 06:55, 12:42, 15:59, 18:28 and 19:45 local time. */
const october12: PrayerDay = {
  dateKey: '2026-10-12',
  timeZone: ZONE,
  times: {
    fajr: utc('2026-10-12T02:28'),
    sunrise: utc('2026-10-12T03:55'),
    dhuhr: utc('2026-10-12T09:42'),
    asr: utc('2026-10-12T12:59'),
    maghrib: utc('2026-10-12T15:28'),
    isha: utc('2026-10-12T16:45'),
  },
}

/** A day with no Isha, as at high latitudes in summer. */
const october13: PrayerDay = {
  dateKey: '2026-10-13',
  timeZone: ZONE,
  times: { ...october12.times, isha: new Date(Number.NaN) },
}

function input(patch: Partial<SnapshotInput> = {}): SnapshotInput {
  const i18n = createI18n('en', true)
  return {
    days: [october12, october13],
    log: {},
    i18n,
    arabicDigits: true,
    name: '',
    formatTime: (date, timeZone) => formatClock(date, i18n.locale, timeZone, false),
    ...patch,
  }
}

describe('buildWidgetSnapshot', () => {
  it('publishes yesterday and the week ahead', () => {
    expect(DAYS_BEFORE + 1 + DAYS_AFTER).toBe(9)
  })

  it('gives each day its prayers as instants with the time as the app shows it, and its log', () => {
    const snapshot = buildWidgetSnapshot(input({ log: { '2026-10-12': { fajr: 'jamaah', dhuhr: 'ontime' } } }))
    expect(snapshot).toMatchObject({ version: WIDGET_SNAPSHOT_VERSION, lang: 'en', arabicDigits: false, timeZone: ZONE, name: '' })
    expect(snapshot.days[0]).toEqual({
      date: '2026-10-12',
      prayers: [
        { prayer: 'fajr', at: Date.parse('2026-10-12T02:28Z'), time: '05:28' },
        { prayer: 'dhuhr', at: Date.parse('2026-10-12T09:42Z'), time: '12:42' },
        { prayer: 'asr', at: Date.parse('2026-10-12T12:59Z'), time: '15:59' },
        { prayer: 'maghrib', at: Date.parse('2026-10-12T15:28Z'), time: '18:28' },
        { prayer: 'isha', at: Date.parse('2026-10-12T16:45Z'), time: '19:45' },
      ],
      log: { fajr: 'jamaah', dhuhr: 'ontime' },
    })
    // Sunrise is not a prayer, and a time that does not exist is left out.
    expect(snapshot.days[1]?.prayers.map(({ prayer }) => prayer)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib'])
    expect(snapshot.days[1]?.log).toEqual({})
  })

  it('is empty, without a zone, before a location is set', () => {
    const snapshot = buildWidgetSnapshot(input({ days: [null, null, null] }))
    expect(snapshot.timeZone).toBeNull()
    expect(snapshot.days).toEqual([])
    expect(snapshot.labels.noLocation).toBe('Open Azkar and choose your location to see prayer times here.')
  })

  it('carries the interface language, and Arabic-Indic digits only in Arabic', () => {
    const arabic = createI18n('ar', true)
    const snapshot = buildWidgetSnapshot(
      input({ i18n: arabic, formatTime: (date, timeZone) => formatClock(date, arabic.locale, timeZone, true) }),
    )
    expect(snapshot.lang).toBe('ar')
    expect(snapshot.arabicDigits).toBe(true)
    expect(snapshot.days[0]?.prayers[2]?.time).toBe('٣:٥٩ م')
    expect(buildWidgetSnapshot(input({ i18n: createI18n('ar', false), arabicDigits: false })).arabicDigits).toBe(false)
    expect(buildWidgetSnapshot(input({ arabicDigits: true })).arabicDigits).toBe(false)
  })

  it('greets the user by name, kept apart from the text around it', () => {
    expect(buildWidgetSnapshot(input()).labels.greeting).toBe('')
    const snapshot = buildWidgetSnapshot(input({ name: 'أحمد' }))
    expect(snapshot.name).toBe('أحمد')
    expect(snapshot.labels.greeting).toBe('As-salamu alaykum, ⁨أحمد⁩')
  })
})

describe('the contract with the widget extension', () => {
  it('builds exactly the JSON the Swift side is tested against (ios/App/AzkarWidgetTests)', () => {
    const arabic = createI18n('ar', true)
    const days: PrayerDay[] = [
      { ...october12, times: { ...october12.times, dhuhr: utc('2026-10-12T09:43') } },
      {
        dateKey: '2026-10-13',
        timeZone: ZONE,
        times: {
          fajr: utc('2026-10-13T02:29'),
          sunrise: utc('2026-10-13T03:56'),
          dhuhr: utc('2026-10-13T09:42'),
          asr: utc('2026-10-13T12:58'),
          maghrib: utc('2026-10-13T15:27'),
          isha: new Date(Number.NaN),
        },
      },
    ]
    const snapshot = buildWidgetSnapshot({
      days,
      log: { '2026-10-12': { fajr: 'jamaah', dhuhr: 'ontime' } },
      i18n: arabic,
      arabicDigits: true,
      name: 'أحمد',
      formatTime: (date, timeZone) => formatClock(date, arabic.locale, timeZone, true),
    })
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(fixture)
  })
})

describe('widgetLabels', () => {
  it('leaves the placeholders the widget fills in', () => {
    const labels = widgetLabels(createI18n('en', true).t, '')
    expect(labels.loggedRow).toBe('{prayer}, {time}: {status}')
    expect(labels.unloggedRow).toBe('{prayer}, {time}: not logged. Mark as prayed on time.')
  })

  it('names every prayer and status in the interface language', () => {
    const labels = widgetLabels(createI18n('ar', true).t, 'Sara')
    expect(labels).toMatchObject({
      nextPrayer: 'الصلاة القادمة',
      greeting: 'السلام عليكم يا ⁨Sara⁩',
      'prayer.fajr': 'الفجر',
      'prayer.isha': 'العشاء',
      'status.ontime': 'في وقتها',
      'status.excused': 'عذر',
      loggedRow: '{prayer}، {time}: {status}',
    })
    expect(Object.keys(labels).sort()).toEqual(
      [
        'countdown',
        'greeting',
        'loggedRow',
        'nextPrayer',
        'noLocation',
        'prayer.asr',
        'prayer.dhuhr',
        'prayer.fajr',
        'prayer.isha',
        'prayer.maghrib',
        'stale',
        'status.excused',
        'status.jamaah',
        'status.late',
        'status.missed',
        'status.ontime',
        'tomorrow',
        'unloggedRow',
      ].sort(),
    )
    // Nothing falls back to a key or to English.
    for (const value of Object.values(labels)) expect(value).toMatch(/[؀-ۿ]/)
  })
})
