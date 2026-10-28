import { describe, expect, it } from 'vitest'
import { formatClock } from '../../../shared/date'
import { createI18n } from '../../../shared/i18n'
import { computePrayerDay, DEFAULT_CALCULATION } from '../engine/compute'
import type { Place } from '../engine/compute'
import { toPlace } from '../location/place'
import { CAIRO, TROMSO, zonedInstant } from '../test-helpers'
import {
  compareReminders,
  REMINDER_LIMIT,
  reminderEntries,
  reminderId,
  reminderText,
  UNLOGGED_ID_BASE,
  unloggedReminderId,
  upcomingReminders,
  WINDOW_DAYS,
} from './plan'
import type { ReminderChoices, ReminderEntry } from './plan'
import type { IsLogged, UnloggedChoices } from './unlogged'

const cairo = toPlace(CAIRO) as Place
const tromso = toPlace(TROMSO) as Place
const dayIn = (place: Place) => (dateKey: string) => computePrayerDay(dateKey, place, DEFAULT_CALCULATION)
const at = (dateKey: string, clock: string, zone = 'Africa/Cairo') => zonedInstant(dateKey, clock, zone)

const PRAYERS_ONLY: ReminderChoices = { prayers: true, morning: false, evening: false, morningAt: 'fajr' }
const AZKAR_ONLY: ReminderChoices = { prayers: false, morning: true, evening: true, morningAt: 'fajr' }
const EVERYTHING: ReminderChoices = { prayers: true, morning: true, evening: true, morningAt: 'fajr' }

// Cairo, 12 October 2026: Fajr 05:28, sunrise 06:55, Dhuhr 12:43, Asr 15:59, Maghrib 18:28, Isha 19:45.
const NOW = at('2026-10-12', '15:58:30')
const upcoming = (choices: ReminderChoices, now = NOW, place = cairo) => upcomingReminders(dayIn(place), place.timeZone, choices, now)
const keys = (entries: ReminderEntry[]) => entries.map((entry) => entry.key)

describe('reminderEntries', () => {
  it('lists the five prayers of each day in time order, never sunrise', () => {
    const entries = reminderEntries([dayIn(cairo)('2026-10-12')], PRAYERS_ONLY)
    expect(keys(entries)).toEqual(['2026-10-12-fajr', '2026-10-12-dhuhr', '2026-10-12-asr', '2026-10-12-maghrib', '2026-10-12-isha'])
    expect(entries[2]).toEqual({ kind: 'prayer', prayer: 'asr', dateKey: '2026-10-12', at: at('2026-10-12', '15:59'), key: '2026-10-12-asr' })
  })

  it('puts the morning azkar at Fajr or at sunrise, as chosen, and the evening azkar at Asr', () => {
    const day = dayIn(cairo)('2026-10-12')
    expect(reminderEntries([day], AZKAR_ONLY)).toEqual([
      { kind: 'azkar', session: 'morning', after: 'fajr', dateKey: '2026-10-12', at: day.times.fajr, key: '2026-10-12-morning' },
      { kind: 'azkar', session: 'evening', after: 'asr', dateKey: '2026-10-12', at: day.times.asr, key: '2026-10-12-evening' },
    ])
    const [morning] = reminderEntries([day], { ...AZKAR_ONLY, evening: false, morningAt: 'sunrise' })
    expect(morning).toMatchObject({ session: 'morning', after: 'sunrise', at: at('2026-10-12', '06:55') })
  })

  it('gives each session on its own switch', () => {
    const day = dayIn(cairo)('2026-10-12')
    expect(keys(reminderEntries([day], { ...AZKAR_ONLY, morning: false }))).toEqual(['2026-10-12-evening'])
    expect(keys(reminderEntries([day], { ...AZKAR_ONLY, evening: false }))).toEqual(['2026-10-12-morning'])
    expect(reminderEntries([day], { ...PRAYERS_ONLY, prayers: false })).toEqual([])
  })

  it('leaves out every time that does not exist that day', () => {
    // Tromsø at midwinter: no sunrise, no Asr, no Maghrib.
    const polarNight = dayIn(tromso)('2026-12-21')
    expect(keys(reminderEntries([polarNight], { ...EVERYTHING, morningAt: 'sunrise' }))).toEqual([
      '2026-12-21-fajr',
      '2026-12-21-dhuhr',
      '2026-12-21-isha',
    ])
    // Midsummer: only Dhuhr and Asr.
    expect(keys(reminderEntries([dayIn(tromso)('2026-06-21')], EVERYTHING))).toEqual(['2026-06-21-dhuhr', '2026-06-21-asr', '2026-06-21-evening'])
  })
})

describe('upcomingReminders', () => {
  it('covers the next seven days from now, starting with the next prayer', () => {
    const entries = upcoming(PRAYERS_ONLY)
    expect(entries[0]?.key).toBe('2026-10-12-asr')
    expect(entries.at(-1)?.key).toBe('2026-10-19-asr')
    // Asr moves a minute earlier every two days or so, so the 19th's (15:54) is still inside the week.
    expect(entries).toHaveLength(36)
    for (const entry of entries) {
      expect(entry.at.getTime()).toBeGreaterThan(NOW.getTime())
      expect(entry.at.getTime()).toBeLessThanOrEqual(NOW.getTime() + WINDOW_DAYS * 86_400_000)
    }
  })

  it('never offers a time that has passed, even by a second', () => {
    const entries = upcoming(PRAYERS_ONLY, at('2026-10-12', '15:59:00'))
    expect(entries[0]?.key).toBe('2026-10-12-maghrib')
    expect(keys(upcoming(PRAYERS_ONLY, at('2026-10-12', '15:58:59')))[0]).toBe('2026-10-12-asr')
  })

  it('takes yesterday’s Isha when it still lies ahead after midnight', () => {
    // A synthetic day whose Isha falls after the next civil midnight, as it does near the polar circle in summer.
    const dayFor = (dateKey: string) => {
      const day = dayIn(cairo)(dateKey)
      return dateKey === '2026-10-11' ? { ...day, times: { ...day.times, isha: at('2026-10-12', '00:30') } } : day
    }
    const entries = upcomingReminders(dayFor, 'Africa/Cairo', PRAYERS_ONLY, at('2026-10-12', '00:10'))
    expect(entries[0]).toMatchObject({ key: '2026-10-11-isha', dateKey: '2026-10-11' })
  })

  it(`keeps prayer and azkar reminders together within ${REMINDER_LIMIT}, well under iOS’s 64`, () => {
    expect(REMINDER_LIMIT).toBeLessThanOrEqual(64 - 10)
    const entries = upcoming(EVERYTHING)
    // 36 prayers, 7 morning and 8 evening reminders fall in the week: the latest one is dropped.
    expect(entries).toHaveLength(REMINDER_LIMIT)
    expect(entries.at(-1)?.key).toBe('2026-10-19-asr')
    expect(keys(entries)).not.toContain('2026-10-19-evening')
    expect(entries.filter((entry) => entry.kind === 'azkar')).toHaveLength(14)
  })

  it('leaves out the days of a polar night on which a reminder has no time', () => {
    const entries = upcoming({ ...EVERYTHING, morningAt: 'sunrise' }, zonedInstant('2026-12-20', '12:00', 'Europe/Oslo'), tromso)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((entry) => entry.kind === 'prayer' && ['fajr', 'dhuhr', 'isha'].includes(entry.prayer))).toBe(true)
  })
})

describe('reminderId', () => {
  it('is the day as YYYYMMDD and one digit for the reminder', () => {
    const [entry] = upcoming(PRAYERS_ONLY)
    expect(entry && reminderId(entry)).toBe(202610122)
  })

  it('stays the same for the same reminder however often it is planned, and never repeats', () => {
    const first = upcoming(EVERYTHING).map(reminderId)
    const again = upcoming(EVERYTHING, at('2026-10-12', '15:58:45')).map(reminderId)
    expect(again).toEqual(first)
    expect(new Set(first).size).toBe(first.length)
    for (const id of first) {
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThan(0)
      expect(id).toBeLessThanOrEqual(2 ** 31 - 1)
    }
  })

  it('gives each of the seven reminders of a day its own digit', () => {
    const day = dayIn(cairo)('2026-10-13')
    const ids = [
      ...reminderEntries([day], EVERYTHING),
      ...reminderEntries([day], { ...AZKAR_ONLY, morningAt: 'sunrise' }),
    ].map(reminderId)
    // The morning reminder keeps its id whichever time it is set for, so a change of time replaces it.
    expect([...new Set(ids)].sort()).toEqual([202610130, 202610131, 202610132, 202610133, 202610134, 202610135, 202610136])
  })
})

describe('reminderText', () => {
  const english = createI18n('en', true)
  const arabic = createI18n('ar', true)
  const clock = (locale: string, hour12: boolean) => (date: Date, timeZone: string) => formatClock(date, locale, timeZone, hour12)
  const [asr, , , fajr] = upcoming(PRAYERS_ONLY)
  // From 15:58:30: this evening's at Asr comes first, then tomorrow morning's.
  const [evening, morning] = upcoming(AZKAR_ONLY)

  it('names the prayer and gives its time and the place', () => {
    expect(asr && reminderText(asr, { t: english.t, tp: english.tp, formatTime: clock('en', false), timeZone: 'Africa/Cairo', place: 'Cairo, Egypt' })).toEqual({
      title: 'It’s time for Asr',
      body: '15:59 · Cairo, Egypt',
    })
    expect(fajr && reminderText(fajr, { t: english.t, tp: english.tp, formatTime: clock('en', true), timeZone: 'Africa/Cairo', place: null })).toEqual({
      title: 'It’s time for Fajr',
      body: '5:29 AM',
    })
  })

  it('gives the time in the saved place’s zone, not the device’s', () => {
    const text = asr && reminderText(asr, { t: english.t, tp: english.tp, formatTime: clock('en', false), timeZone: 'Africa/Cairo', place: 'Cairo, Egypt' })
    expect(text?.body.startsWith('15:59')).toBe(true)
    const elsewhere = asr && reminderText(asr, { t: english.t, tp: english.tp, formatTime: clock('en', false), timeZone: 'Asia/Tokyo', place: 'Cairo, Egypt' })
    expect(elsewhere?.body.startsWith('21:59')).toBe(true)
  })

  it('invites to the azkar with the time it is tied to', () => {
    const wording = { t: english.t, tp: english.tp, formatTime: clock('en', true), timeZone: 'Africa/Cairo', place: 'Cairo, Egypt' }
    expect(evening && reminderText(evening, wording)).toEqual({ title: 'Time for the evening azkar', body: 'Asr began at 3:59 PM' })
    expect(morning && reminderText(morning, wording)).toEqual({ title: 'Time for the morning azkar', body: 'Fajr began at 5:29 AM' })
    const [sunrise] = upcoming({ ...AZKAR_ONLY, evening: false, morningAt: 'sunrise' })
    expect(sunrise && reminderText(sunrise, wording)).toEqual({ title: 'Time for the morning azkar', body: 'The sun rose at 6:56 AM' })
  })

  it('addresses the user by name when one is set, keeping the name isolated from the sentence', () => {
    const named = (t: typeof english.t, name: string) => ({ t, tp: english.tp, formatTime: clock('en', false), timeZone: 'Africa/Cairo', place: null, name })
    expect(asr && reminderText(asr, named(english.t, 'Ahmed'))?.title).toBe('\u2068Ahmed\u2069, it’s time for Asr')
    expect(evening && reminderText(evening, named(english.t, 'Ahmed'))?.title).toBe('\u2068Ahmed\u2069, time for the evening azkar')
    expect(morning && reminderText(morning, named(english.t, 'Ahmed'))?.title).toBe('\u2068Ahmed\u2069, time for the morning azkar')
    expect(asr && reminderText(asr, named(arabic.t, 'أحمد'))?.title).toBe('حان وقت صلاة العصر يا \u2068أحمد\u2069')
    // No name: the plain wording.
    expect(asr && reminderText(asr, named(english.t, ''))?.title).toBe('It’s time for Asr')
  })

  it('is written in Arabic, with Arabic digits and the 12-hour clock when chosen', () => {
    const wording = { t: arabic.t, tp: arabic.tp, formatTime: clock(arabic.locale, true), timeZone: 'Africa/Cairo', place: 'القاهرة، مصر' }
    expect(asr && reminderText(asr, wording)).toEqual({ title: 'حان وقت صلاة العصر', body: '٣:٥٩ م · القاهرة، مصر' })
    expect(evening && reminderText(evening, wording)).toEqual({ title: 'حان وقت أذكار المساء', body: 'دخل وقت العصر الساعة ٣:٥٩ م' })
  })
})

const NOTHING_LOGGED: IsLogged = () => false
const unlogged = (patch: Partial<UnloggedChoices> = {}): UnloggedChoices => ({ leadMinutes: 15, ishaEnds: 'middle', isLogged: NOTHING_LOGGED, ...patch })
const WITH_UNLOGGED: ReminderChoices = { ...EVERYTHING, unlogged: unlogged() }
const UNLOGGED_ONLY: ReminderChoices = { prayers: false, morning: false, evening: false, morningAt: 'fajr', unlogged: unlogged() }

describe('the "not logged yet" reminders in the plan', () => {
  it('come in time order among the others, after a prayer and before azkar at the same instant', () => {
    const entries = reminderEntries([dayIn(cairo)('2026-10-12'), dayIn(cairo)('2026-10-13')], WITH_UNLOGGED)
    expect(keys(entries).slice(0, 12)).toEqual([
      '2026-10-12-fajr',
      '2026-10-12-morning',
      '2026-10-12-fajr-unlogged',
      '2026-10-12-dhuhr',
      '2026-10-12-dhuhr-unlogged',
      '2026-10-12-asr',
      '2026-10-12-evening',
      '2026-10-12-asr-unlogged',
      '2026-10-12-maghrib',
      '2026-10-12-maghrib-unlogged',
      '2026-10-12-isha',
      '2026-10-12-isha-unlogged',
    ])
  })

  it('are ordered soonest first and, at the same instant, prayers before "not logged yet" before azkar', () => {
    const instant = at('2026-10-12', '15:59')
    const prayer: ReminderEntry = { kind: 'prayer', prayer: 'asr', dateKey: '2026-10-12', at: instant, key: 'p' }
    const azkar: ReminderEntry = { kind: 'azkar', session: 'evening', after: 'asr', dateKey: '2026-10-12', at: instant, key: 'a' }
    const notLogged: ReminderEntry = { kind: 'unlogged', prayer: 'dhuhr', dateKey: '2026-10-12', at: instant, endsAt: instant, preferred: false, key: 'u' }
    const earlier: ReminderEntry = { ...azkar, at: at('2026-10-12', '15:58'), key: 'e' }
    expect([azkar, notLogged, prayer, earlier].sort(compareReminders).map((entry) => entry.key)).toEqual(['e', 'p', 'u', 'a'])
  })

  it('are left out when switched off', () => {
    expect(reminderEntries([dayIn(cairo)('2026-10-12'), dayIn(cairo)('2026-10-13')], EVERYTHING).some((entry) => entry.kind === 'unlogged')).toBe(false)
  })

  it('cover the week like the others, the last day’s Isha included, and none for a logged prayer', () => {
    const logged = new Set(['2026-10-12-asr', '2026-10-13-fajr'])
    const entries = upcoming({ ...UNLOGGED_ONLY, unlogged: unlogged({ isLogged: (dateKey, prayer) => logged.has(`${dateKey}-${prayer}`) }) })
    // From 15:58:30 the 12th's Dhuhr reminder (15:44) has passed and its Asr is logged: Maghrib's comes first.
    expect(entries[0]).toMatchObject({ key: '2026-10-12-maghrib-unlogged', at: at('2026-10-12', '19:30') })
    expect(keys(entries)).not.toContain('2026-10-13-fajr-unlogged')
    expect(keys(entries)).toContain('2026-10-13-dhuhr-unlogged')
    // The 18th's Isha ends at the middle of a night that runs into the 19th: the window reaches it.
    expect(keys(entries)).toContain('2026-10-18-isha-unlogged')
    for (const entry of entries) {
      expect(entry.at.getTime()).toBeGreaterThan(NOW.getTime())
      expect(entry.at.getTime()).toBeLessThanOrEqual(NOW.getTime() + WINDOW_DAYS * 86_400_000)
    }
  })

  it('still remind of last night’s Isha after midnight, until the next Fajr when that is its end', () => {
    const entries = upcoming({ ...UNLOGGED_ONLY, unlogged: unlogged({ ishaEnds: 'fajr' }) }, at('2026-10-13', '01:00'))
    expect(entries[0]).toMatchObject({ key: '2026-10-12-isha-unlogged', dateKey: '2026-10-12', at: at('2026-10-13', '05:14') })
    const logged = upcoming(
      { ...UNLOGGED_ONLY, unlogged: unlogged({ ishaEnds: 'fajr', isLogged: (dateKey, prayer) => dateKey === '2026-10-12' && prayer === 'isha' }) },
      at('2026-10-13', '01:00'),
    )
    expect(logged[0]?.key).toBe('2026-10-13-fajr-unlogged')
  })
})

describe('the limit with every kind of reminder on', () => {
  it(`keeps the soonest ${REMINDER_LIMIT} of prayers, "not logged yet" and azkar together, well under iOS’s 64`, () => {
    const entries = upcoming(WITH_UNLOGGED)
    expect(entries).toHaveLength(REMINDER_LIMIT)
    // Twelve a day: the week is cut after about four days, every kind alike.
    expect(entries[0]?.key).toBe('2026-10-12-asr')
    expect(entries.at(-1)?.key).toBe('2026-10-16-evening')
    const count = (kind: ReminderEntry['kind']) => entries.filter((entry) => entry.kind === kind).length
    // The 12th from Asr, the 13th to the 15th whole, the 16th to its Asr and evening azkar.
    expect([count('prayer'), count('unlogged'), count('azkar')]).toEqual([21, 20, 9])
    // Nothing kept comes after anything left out.
    const everything = reminderEntries(
      Array.from({ length: 10 }, (_, offset) => dayIn(cairo)(`2026-10-${String(11 + offset).padStart(2, '0')}`)),
      WITH_UNLOGGED,
    ).filter((entry) => entry.at.getTime() > NOW.getTime())
    expect(keys(entries)).toEqual(keys(everything.slice(0, REMINDER_LIMIT)))
  })

  it('keeps the prayer and drops the azkar reminder when the limit falls between them at the same minute', () => {
    // From 15:40 the 12th's Dhuhr reminder (15:44) comes first, which moves the cut one place earlier:
    // between Asr and the evening azkar of the 16th, both at 15:56.
    const entries = upcoming(WITH_UNLOGGED, at('2026-10-12', '15:40'))
    expect(entries).toHaveLength(REMINDER_LIMIT)
    expect(entries[0]?.key).toBe('2026-10-12-dhuhr-unlogged')
    expect(entries.at(-1)).toMatchObject({ key: '2026-10-16-asr', at: at('2026-10-16', '15:56') })
    expect(keys(entries)).not.toContain('2026-10-16-evening')
  })

  it('makes room for later reminders as prayers are logged', () => {
    const logged: IsLogged = (dateKey) => dateKey === '2026-10-12'
    const entries = upcoming({ ...EVERYTHING, unlogged: unlogged({ isLogged: logged }) })
    expect(entries).toHaveLength(REMINDER_LIMIT)
    expect(keys(entries).filter((key) => key.startsWith('2026-10-12') && key.endsWith('unlogged'))).toEqual([])
    // The three places freed on the 12th go to the next three reminders of the 16th.
    expect(keys(entries).slice(-3)).toEqual(['2026-10-16-asr-unlogged', '2026-10-16-maghrib', '2026-10-16-maghrib-unlogged'])
  })
})

describe('unloggedReminderId', () => {
  it('is 1_000_000_000 + YYYYMMDD * 10 + 0 to 4 for Fajr to Isha', () => {
    expect(UNLOGGED_ID_BASE).toBe(1_000_000_000)
    expect(unloggedReminderId('2026-10-12', 'fajr')).toBe(1_202_610_120)
    expect(unloggedReminderId('2026-10-12', 'dhuhr')).toBe(1_202_610_121)
    expect(unloggedReminderId('2026-10-12', 'asr')).toBe(1_202_610_122)
    expect(unloggedReminderId('2026-10-12', 'maghrib')).toBe(1_202_610_123)
    expect(unloggedReminderId('2026-10-12', 'isha')).toBe(1_202_610_124)
    expect(unloggedReminderId('2027-01-05', 'isha')).toBe(1_000_000_000 + 20_270_105 * 10 + 4)
  })

  it('is what the plan gives its entries, stays inside a 32-bit integer and meets no other reminder’s id', () => {
    const entries = upcoming(WITH_UNLOGGED)
    for (const entry of entries.filter((candidate) => candidate.kind === 'unlogged')) {
      expect(reminderId(entry)).toBe(unloggedReminderId(entry.dateKey, entry.prayer))
    }
    const ids = entries.map(reminderId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(unloggedReminderId('9999-12-31', 'isha')).toBeLessThanOrEqual(2 ** 31 - 1)
    // Every other reminder's id has nine digits; these have ten.
    for (const entry of entries) expect(reminderId(entry) >= UNLOGGED_ID_BASE).toBe(entry.kind === 'unlogged')
  })
})

describe('reminderText for a prayer not logged yet', () => {
  const english = createI18n('en', true)
  const arabic = createI18n('ar', true)
  const clock = (locale: string, hour12: boolean) => (date: Date, timeZone: string) => formatClock(date, locale, timeZone, hour12)
  const days = [dayIn(cairo)('2026-10-12'), dayIn(cairo)('2026-10-13')]
  const entry = (prayer: string, patch: Partial<UnloggedChoices> = {}) =>
    reminderEntries(days, { ...UNLOGGED_ONLY, unlogged: unlogged(patch) }).find((candidate) => candidate.key === `2026-10-12-${prayer}-unlogged`)!
  const inEnglish = { t: english.t, tp: english.tp, formatTime: clock('en', false), timeZone: 'Africa/Cairo', place: 'Cairo, Egypt' }
  const inArabic = { t: arabic.t, tp: arabic.tp, formatTime: clock(arabic.locale, true), timeZone: 'Africa/Cairo', place: 'القاهرة، مصر' }

  it('names the prayer and says how long is left and until when', () => {
    expect(reminderText(entry('asr'), inEnglish)).toEqual({ title: 'You haven’t logged Asr yet', body: 'Asr time ends in 15 minutes, at 18:28' })
    expect(reminderText(entry('fajr', { leadMinutes: 60 }), inEnglish)).toEqual({
      title: 'You haven’t logged Fajr yet',
      body: 'Fajr time ends in 1 hour, at 06:55',
    })
  })

  it('speaks of Isha’s preferred time when it ends at the middle of the night, and of its time when at Fajr', () => {
    expect(reminderText(entry('isha'), inEnglish).body).toBe('The preferred time for Isha ends in 15 minutes, at 23:58')
    expect(reminderText(entry('isha', { ishaEnds: 'fajr', leadMinutes: 30 }), inEnglish).body).toBe('Isha time ends in 30 minutes, at 05:29')
  })

  it('addresses the user by name when one is set', () => {
    expect(reminderText(entry('asr'), { ...inEnglish, name: 'Ahmed' }).title).toBe('\u2068Ahmed\u2069, you haven’t logged Asr yet')
    expect(reminderText(entry('asr'), { ...inArabic, name: 'أحمد' }).title).toBe('لم تُسجَّل صلاة العصر بعد يا \u2068أحمد\u2069')
    expect(reminderText(entry('asr'), { ...inEnglish, name: '' }).title).toBe('You haven’t logged Asr yet')
  })

  it('is written in Arabic, with Arabic plurals, digits and the chosen clock', () => {
    expect(reminderText(entry('asr'), inArabic)).toEqual({ title: 'لم تُسجَّل صلاة العصر بعد', body: 'يخرج وقت العصر بعد ١٥ دقيقة، الساعة ٦:٢٨ م' })
    expect(reminderText(entry('maghrib', { leadMinutes: 10 }), inArabic).body).toBe('يخرج وقت المغرب بعد ١٠ دقائق، الساعة ٧:٤٥ م')
    expect(reminderText(entry('dhuhr', { leadMinutes: 60 }), inArabic).body).toBe('يخرج وقت الظهر بعد ساعة واحدة، الساعة ٣:٥٩ م')
    expect(reminderText(entry('isha'), inArabic)).toEqual({
      title: 'لم تُسجَّل صلاة العشاء بعد',
      body: 'ينتهي الوقت المختار لصلاة العشاء بعد ١٥ دقيقة، الساعة ١١:٥٨ م',
    })
  })
})
