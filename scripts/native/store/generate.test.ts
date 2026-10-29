// Produces the fixtures of apple/AzkarKit/Tests/AzkarStoreTests by running the website's own
// stores. Run from the repository root with:
//
//   TZ=UTC npx vitest run --config scripts/native/store/vitest.config.ts
//
// and commit what changes in scripts/native/store/fixtures. Every expected value below is what
// the website itself saved or loaded; nothing is written by hand except the inputs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { hydrate, loadStores, localStorageSnapshot, persistedState, STORE_NAMES } from './web'

/** Set by vitest.config.ts: jsdom gives modules no file URL to resolve against. */
const OUT = `${process.env.AZKAR_STORE_FIXTURES}/`
mkdirSync(OUT, { recursive: true })

function read<T>(name: string): T {
  return JSON.parse(readFileSync(`${OUT}${name}`, 'utf8')) as T
}

function write(name: string, value: unknown) {
  writeFileSync(`${OUT}${name}`, `${JSON.stringify(value, null, 2)}\n`)
}

const key = (name: string) => `azkar:${name}`
const envelope = (state: unknown, version?: number) =>
  JSON.stringify(version === undefined ? { state } : { state, version })

/** A wall-clock time in Tokyo (UTC+9, no daylight saving), as an ISO instant. */
const tokyo = (day: string, time: string) => new Date(`${day}T${time}+09:00`).toISOString()

const TOKYO = {
  latitude: 35.6762,
  longitude: 139.6503,
  timeZone: 'Asia/Tokyo',
  label: 'Tokyo, Japan',
  countryCode: 'JP',
  source: 'gps',
  updatedAt: Date.parse('2026-08-30T10:00:00Z'),
}

afterAll(() => {
  vi.useRealTimers()
})

describe('fixtures', () => {
  it('writes the session catalog of the real dataset', async () => {
    const { data, session } = await loadStores()
    const sessions: Record<string, { id: string; target: number }[]> = {}
    for (const id of data.COLLECTION_IDS) {
      sessions[id] = data.getCollection(id).map((dhikr: { id: string }) => ({ id: dhikr.id, target: session.targetOf(dhikr) }))
    }
    write('catalog.json', { sessions })
  })

  it('writes the operations scenario and what the website saved after it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-30T10:00:00Z'))
    localStorage.clear()
    const { stores, data } = await loadStores()
    ;(stores.location.getState() as { setLocation: (l: unknown) => void }).setLocation(TOKYO)

    type Step = Record<string, unknown> & { at: string; op: string }
    const steps: Step[] = []
    const morning = data.getCollection('morning') as { id: string }[]
    const add = (at: string, op: string, rest: Record<string, unknown>) => steps.push({ at, op, ...rest })
    const completeAll = (at: string, day: string, session: string, items: { id: string }[]) => {
      for (const item of items) add(at, 'complete', { day, session, dhikr: item.id })
    }

    // Obligatory prayers: one tap, the same status again, changes, a future day, clearing.
    add(tokyo('2026-09-01', '05:10'), 'status', { day: '2026-09-01', prayer: 'fajr', status: 'ontime' })
    add(tokyo('2026-09-01', '05:11'), 'status', { day: '2026-09-01', prayer: 'fajr', status: 'ontime' })
    add(tokyo('2026-09-01', '12:30'), 'status', { day: '2026-09-01', prayer: 'dhuhr', status: 'jamaah' })
    add(tokyo('2026-09-01', '12:31'), 'status', { day: '2026-09-02', prayer: 'dhuhr', status: 'ontime' })
    add(tokyo('2026-09-01', '12:32'), 'status', { day: '2026-09-02', prayer: 'dhuhr', status: null })
    add(tokyo('2026-09-01', '20:00'), 'status', { day: '2026-09-01', prayer: 'isha', status: 'late' })
    add(tokyo('2026-09-01', '20:01'), 'status', { day: '2026-09-01', prayer: 'isha', status: 'missed' })
    add(tokyo('2026-09-01', '20:02'), 'status', { day: '2026-08-31', prayer: 'asr', status: 'excused' })
    add(tokyo('2026-09-01', '20:03'), 'status', { day: '2026-08-31', prayer: 'asr', status: null })
    add(tokyo('2026-09-01', '20:04'), 'status', { day: '2026-08-31', prayer: 'maghrib', status: 'late' })
    // Sunnah prayers, a night prayer after midnight, a future day, unticking.
    add(tokyo('2026-09-01', '23:59'), 'sunnah', { day: '2026-09-01', sunnah: 'witr', done: true })
    add(tokyo('2026-09-02', '00:30'), 'sunnah', { day: '2026-09-01', sunnah: 'qiyam', done: true })
    add(tokyo('2026-09-02', '00:31'), 'sunnah', { day: '2026-09-01', sunnah: 'qiyam', done: true })
    add(tokyo('2026-09-02', '00:32'), 'sunnah', { day: '2026-09-03', sunnah: 'duha', done: true })
    add(tokyo('2026-09-02', '00:33'), 'sunnah', { day: '2026-09-01', sunnah: 'witr', done: false })
    add(tokyo('2026-09-02', '00:34'), 'sunnah', { day: '2026-08-30', sunnah: 'beforeFajr', done: true })
    add(tokyo('2026-09-02', '00:35'), 'sunnah', { day: '2026-08-30', sunnah: 'beforeFajr', done: false })
    add(tokyo('2026-09-02', '06:00'), 'sunnah', { day: '2026-09-02', sunnah: 'beforeFajr', done: true })

    // Morning azkar: counting, the target, unknown and untouched azkar, completion, undoing the
    // final count, counting it again, starting over, a second reading, and undoing its end.
    const day = '2026-09-01'
    add(tokyo(day, '06:00'), 'increment', { day, session: 'morning', dhikr: 'ayat-al-kursi' })
    add(tokyo(day, '06:01'), 'increment', { day, session: 'morning', dhikr: 'ayat-al-kursi' })
    add(tokyo(day, '06:02'), 'increment', { day, session: 'morning', dhikr: 'no-such-dhikr' })
    add(tokyo(day, '06:03'), 'decrement', { day, session: 'morning', dhikr: 'sayyid-al-istighfar' })
    add(tokyo(day, '06:04'), 'increment', { day, session: 'morning', dhikr: 'al-ikhlas-al-falaq-an-nas' })
    add(tokyo(day, '06:05'), 'increment', { day, session: 'morning', dhikr: 'al-ikhlas-al-falaq-an-nas' })
    completeAll(tokyo(day, '06:20'), day, 'morning', morning)
    add(tokyo(day, '06:21'), 'decrement', { day, session: 'morning', dhikr: 'astaghfirullah-wa-atubu-ilayh' })
    add(tokyo(day, '06:22'), 'increment', { day, session: 'morning', dhikr: 'astaghfirullah-wa-atubu-ilayh' })
    add(tokyo(day, '06:30'), 'reset', { day, session: 'morning' })
    add(tokyo(day, '06:31'), 'increment', { day, session: 'morning', dhikr: 'ayat-al-kursi' })
    completeAll(tokyo(day, '06:40'), day, 'morning', morning)
    add(tokyo(day, '06:41'), 'decrement', { day, session: 'morning', dhikr: 'allahumma-salli-wa-sallim-ala-nabiyyina-muhammad' })
    // A tap taken straight back leaves nothing; a session without azkar counts nothing.
    add(tokyo(day, '18:00'), 'increment', { day, session: 'evening', dhikr: 'ayat-al-kursi' })
    add(tokyo(day, '18:01'), 'decrement', { day, session: 'evening', dhikr: 'ayat-al-kursi' })
    add(tokyo(day, '21:00'), 'increment', { day, session: 'sleep', dhikr: 'ayat-al-kursi' })
    // Counts are kept for thirty days after the day counted, and pruned past that.
    add(tokyo('2026-10-01', '17:00'), 'increment', { day: '2026-10-01', session: 'evening', dhikr: 'ya-hayyu-ya-qayyum' })
    add(tokyo('2026-10-01', '17:01'), 'increment', { day: '2026-10-01', session: 'evening', dhikr: 'subhanallahi-wa-bihamdih' })
    add(tokyo('2026-10-02', '17:00'), 'increment', { day: '2026-10-02', session: 'evening', dhikr: 'ya-hayyu-ya-qayyum' })
    add(tokyo('2026-10-02', '17:05'), 'reset', { day: '2026-10-01', session: 'evening' })
    add(tokyo('2026-10-02', '17:06'), 'reset', { day: '2026-09-01', session: 'morning' })
    add(tokyo('2026-10-02', '17:07'), 'reset', { day: '2026-10-02', session: 'morning' })
    // "Today" is the saved place's day: past midnight in Tokyo, still the day before in UTC.
    add('2026-10-12T16:00:00.000Z', 'status', { day: '2026-10-13', prayer: 'fajr', status: 'ontime' })
    add('2026-10-12T16:00:01.000Z', 'status', { day: '2026-10-14', prayer: 'fajr', status: 'ontime' })
    add('2026-10-12T16:00:02.000Z', 'sunnah', { day: '2026-10-13', sunnah: 'beforeFajr', done: true })

    const log = stores['prayer-log'].getState() as Record<string, (...args: unknown[]) => void>
    const progress = stores['azkar-progress'].getState() as Record<string, (...args: unknown[]) => void>
    for (const step of steps) {
      vi.setSystemTime(new Date(step.at))
      switch (step.op) {
        case 'status':
          log.setStatus(step.day, step.prayer, step.status)
          break
        case 'sunnah':
          log.setSunnah(step.day, step.sunnah, step.done)
          break
        case 'reset':
          progress.resetSession(step.day, step.session)
          break
        default:
          progress[step.op](step.day, step.session, step.dhikr)
      }
    }

    // The settings of a real install, changed through the stores' own actions.
    vi.setSystemTime(new Date('2026-10-12T16:10:00Z'))
    ;(stores.settings.getState() as { update: (p: unknown) => void }).update({
      name: '  Ahmed‏ \n Walid ',
      theme: 'dark',
      timeFormat: '24h',
      hijriOffset: 1,
      arabicDigits: false,
      language: 'ar',
    })
    const times = stores['prayer-times'].getState() as Record<string, (...args: unknown[]) => void>
    times.setMethod('Egyptian')
    times.setMadhab('hanafi')
    times.setAdjustment('isha', 3)
    times.setAdjustment('fajr', -2)
    times.setNotifications(true)
    times.setAzkarReminder('morning', true)
    times.setMorningReminderTime('sunrise')
    ;(stores['azkar-settings'].getState() as { update: (p: unknown) => void }).update({ arabicScale: 4, showTranslation: false })

    const saved = Object.fromEntries(STORE_NAMES.map((name) => [name, persistedState(stores[name])]))
    const raw = localStorageSnapshot()
    write('operations.json', {
      timeZone: TOKYO.timeZone,
      location: TOKYO,
      steps,
      expected: { 'prayer-log': saved['prayer-log'], 'azkar-progress': saved['azkar-progress'] },
    })
    write('realistic-storage.json', raw)
    // The backup the website exports of the same install.
    const { storage } = await loadStores()
    write('realistic-backup.json', storage.exportBackup(new Date('2026-10-12T16:10:00.123Z')))
    vi.useRealTimers()
  })

  it('writes what the website makes of names and settings typed or stored', async () => {
    const { sanitizeName, sanitizeSettings } = await import('../../../src/shared/settings')
    const { sanitizeAzkarSettings } = await import('../../../src/features/azkar/settingsStore')
    const prayerTimes = await import('../../../src/features/prayer-times/config')
    const names: unknown[] = [
      'Ahmed', '  Ahmed   Walid  ', 'Ahmed\nWalid', 'A\tB\r\nC', '\u200fأحمد\u200e', '\u202eevil\u202c', 'Zero\u200bWidth',
      'Bom\ufeffhere', 'No\u00a0break', 'Ideo\u3000space', 'Line\u2028sep', 'Para\u2029sep', 'Ctl\u0001\u001f\u007f\u0085',
      'e\u0301', 'Cafe\u0301 au lait', '👨‍👩‍👧‍👦 family', '😀'.repeat(45), 'x'.repeat(39) + ' y', 'x'.repeat(39) + '\u0301y',
      'a'.repeat(40) + 'b', ' '.repeat(5), '', 42, null, 'محمد بن عبد الله', 'Ma\u180eongolian', '\u00adsoft', 'Tab\u000bvt\u000cff',
    ]
    const settings: unknown[] = [
      undefined, null, 'x', [], {},
      { language: 'ar', theme: 'dark', timeFormat: '24h', arabicDigits: false, hijriOffset: -2, name: 'Ali' },
      { hijriOffset: 1.5 }, { hijriOffset: -9 }, { hijriOffset: '1' }, { hijriOffset: Number.NaN }, { arabicDigits: 0 },
    ]
    const azkar: unknown[] = [
      undefined, {}, { arabicScale: 5, showTransliteration: false, showTranslation: true, haptics: false, keepAwake: false, autoAdvance: false },
      { arabicScale: 0 }, { arabicScale: 2.5 }, { arabicScale: '3' }, { showTranslation: null, showTransliteration: 1 },
    ]
    const times: unknown[] = [
      undefined, {}, { method: 'Tehran', madhab: 'shafi', highLatitudeRule: 'seventhofthenight', polar: 'nearestLatitude' },
      { adjustments: { fajr: 1e9, sunrise: -1e9, dhuhr: 0.5, asr: -0.5, maghrib: 1.4999, isha: Number.NaN } },
      { adjustments: [] }, { azkarReminders: { morning: true, evening: true, morningAt: 'sunrise' }, notifications: true },
      { method: 'muslimworldleague' }, { highLatitudeRule: 'auto', madhab: 'auto', method: 'auto' },
    ]
    write('sanitize.json', {
      names: names.map((input) => ({ input: input === undefined ? null : input, output: sanitizeName(input) })),
      settings: settings.map((input) => ({ input: input ?? null, output: sanitizeSettings(input) })),
      azkarSettings: azkar.map((input) => ({ input: input ?? null, output: sanitizeAzkarSettings(input) })),
      prayerTimes: times.map((input) => ({ input: input ?? null, output: prayerTimes.sanitizeSettings(input) })),
    })
  })

  it('writes what the website loads from every kind of stored data', async () => {
    const realistic = read<Record<string, string>>('realistic-storage.json')
    const cases: { name: string; raw: Record<string, string | null> }[] = []
    const add = (name: string, raw: Record<string, string | null>) => cases.push({ name, raw })

    add('nothing stored', {})
    add('a realistic install', realistic)
    add('a location but no calculation settings, from before the Asr school followed the country', {
      [key('location')]: envelope({ location: TOKYO }, 1),
    })
    add('a version 1 install', {
      [key('location')]: envelope({ location: { ...TOKYO, countryCode: 'eg', timeZone: 'Africa/Cairo', label: 'Cairo' } }, 1),
      [key('settings')]: envelope({ language: 'en', theme: 'light', timeFormat: '12h', arabicDigits: true, hijriOffset: -1, name: 'Ali' }, 1),
      [key('prayer-times')]: envelope({ method: 'Egyptian', madhab: 'shafi', highLatitudeRule: 'auto', polar: 'unresolved', adjustments: { fajr: 0, sunrise: 0, dhuhr: 1, asr: 0, maghrib: 2, isha: 0 }, notifications: true }, 1),
      [key('prayer-log')]: envelope({
        entries: {
          '2025-01-05': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed', isha: 'excused' },
          '2025-01-06': { fajr: 'ontime' },
          '2031-01-01': { fajr: 'ontime' },
        },
      }, 1),
      [key('azkar-progress')]: envelope({
        days: {
          '2025-01-05': { morning: { 'ayat-al-kursi': 1, 'al-ikhlas-al-falaq-an-nas': 3, 'subhanallahi-wa-bihamdih': 100 }, evening: { 'ayat-al-kursi': 1 } },
          '2025-01-06': { evening: { 'audhu-bi-kalimatillah-at-tammat': 2, 'retired-dhikr': 4 } },
        },
        history: { '2025-01-05': ['morning'], '2024-12-01': ['morning', 'evening', 'sleep'], '2024-12-02': [] },
      }, 1),
      [key('azkar-settings')]: envelope({ arabicScale: 2, showTransliteration: true, showTranslation: null, haptics: false, keepAwake: true, autoAdvance: false }, 1),
    })
    add('bad values everywhere', {
      [key('location')]: envelope({ location: { latitude: 21.4225, longitude: 39.8262, timeZone: 'Mars/Olympus', label: 7, countryCode: 'SAU', source: 'satellite', updatedAt: -5 } }, 1),
      [key('settings')]: envelope({ language: 'fr', theme: 'blue', timeFormat: 24, arabicDigits: 'yes', hijriOffset: 7, name: '‮Fatima\u0000 \t  Zahra ' + 'x'.repeat(60) }, 1),
      [key('prayer-times')]: envelope({ method: 'Moon', madhab: 'maliki', highLatitudeRule: 'TwilightAngle', polar: 'nearest', adjustments: { fajr: 45, sunrise: -31.5, dhuhr: '5', asr: 2.5, maghrib: -2.5, isha: -0.4 }, notifications: 'true', azkarReminders: { morning: 1, evening: true, morningAt: 'noon' } }, 2),
      [key('prayer-log')]: envelope({
        entries: {
          '2026-02-30': { fajr: 'ontime' },
          '2026-1-5': { fajr: 'ontime' },
          '2026-01-05': { fajr: 'prayed', dhuhr: 'late', duha: 'ontime', asr: null },
          '2026-01-06': { fajr: 'nope' },
          '2099-12-31': { isha: 'jamaah' },
          '2026-01-07': 'ontime',
        },
        loggedAt: {
          '2026-01-05': { dhuhr: 1767600000000.5, fajr: 1767600000000 },
          '2099-12-31': { isha: 4102444800000, fajr: 4102444800000 },
          '2026-01-08': { fajr: 1767800000000 },
        },
        sunnah: {
          '2026-01-05': { witr: 1767600000000, qiyam: '1767600000000', duha: -1, beforeFajr: 9e15, tarawih: 1767600000000 },
          '2026-13-01': { witr: 1767600000000 },
          '2026-01-09': {},
        },
      }, 2),
      [key('azkar-progress')]: envelope({
        days: {
          '2026-01-05': { morning: { 'ayat-al-kursi': 1, 'zero': 0, 'negative': -2, 'half': 1.5, 'huge': 10001, '': 3, ['l'.repeat(101)]: 1, 'ok-100': 10000 }, noon: { 'ayat-al-kursi': 1 } },
          '2026-02-29': { morning: { 'ayat-al-kursi': 1 } },
          '2099-01-01': { evening: { 'ayat-al-kursi': 1 } },
        },
        sessions: {
          '2026-01-05': {
            morning: { completed: true, done: 23, total: 23, recitations: 330, startedAt: 1767560000000, lastAt: 1767561000000, completedAt: 1767561000000 },
            evening: { completed: false, done: 3, total: 2, recitations: 4 },
            sleep: { completed: 'no', done: 0, total: 0, recitations: 0 },
            noon: { completed: true, done: 1, total: 1, recitations: 1 },
          },
          '2026-01-06': {
            morning: { completed: false, done: 0, total: 23, recitations: 1000001 },
            evening: { completed: false, done: 2, total: 20, recitations: 5, startedAt: 900000000000, lastAt: 1767561000000.5, completedAt: 1767561000000 },
            sleep: { completed: true, done: 0, total: 0, recitations: 0, completedAt: 7258118400000 },
          },
          '2099-01-01': { evening: { completed: false, done: 1, total: 20, recitations: 1 } },
        },
        totals: { 'ayat-al-kursi': 12, 'bad': -1, 'float': 2.5, 'big': 1000000000001, 'astaghfirullah-wa-atubu-ilayh': 300 },
        totalRecitations: 100,
        history: { '2026-01-05': ['morning'] },
      }, 2),
      [key('azkar-settings')]: envelope({ arabicScale: 6, showTransliteration: 'yes', showTranslation: false, haptics: 1, keepAwake: null, autoAdvance: false }, 1),
    })
    add('data no store can read', {
      [key('location')]: '{not json',
      [key('settings')]: 'null',
      [key('prayer-times')]: '{"state": 5, "version": 2}',
      [key('prayer-log')]: '5',
      [key('azkar-progress')]: '[]',
      [key('azkar-settings')]: '{"foo": 1}',
    })
    add('unreadable calculation settings beside a location', {
      [key('location')]: envelope({ location: TOKYO }, 1),
      [key('prayer-times')]: '{"state": {"madhab": "hanafi"',
    })
    add('stamps the stores do not expect', {
      [key('location')]: envelope({ location: TOKYO }, 2),
      [key('settings')]: envelope({ theme: 'dark', hijriOffset: -2 }, 0),
      [key('prayer-times')]: envelope({ method: 'Karachi', madhab: 'hanafi' }, 9),
      [key('prayer-log')]: envelope({ entries: { '2026-03-01': { asr: 'late' } }, loggedAt: { '2026-03-01': { asr: 1772360000000 } } }, 7),
      [key('azkar-progress')]: envelope({ days: { '2026-03-01': { morning: { 'ayat-al-kursi': 1 } } }, history: { '2026-03-01': ['morning'] } }, 3),
      [key('azkar-settings')]: JSON.stringify({ state: { arabicScale: 5 }, version: '1' }),
    })
    add('version 1 stamp on version 2 data, and version 2 data with no stamp', {
      [key('azkar-progress')]: envelope({
        days: { '2026-03-01': { evening: { 'ayat-al-kursi': 1 } } },
        sessions: { '2026-03-01': { evening: { completed: false, done: 1, total: 20, recitations: 1, startedAt: 1772360000000, lastAt: 1772360000000 } } },
        totals: { 'ayat-al-kursi': 1 },
        totalRecitations: 1,
        history: { '2026-02-01': ['morning'] },
      }, 1),
      [key('prayer-log')]: envelope({ entries: { '2026-03-01': { fajr: 'jamaah' } }, loggedAt: { '2026-03-01': { fajr: 1772330000000 } }, sunnah: { '2026-03-01': { beforeFajr: 1772329000000 } } }),
    })
    add('version 1 progress with no stamp at all', {
      [key('azkar-progress')]: JSON.stringify({ state: { days: {}, history: { '2026-02-01': ['evening'] } } }),
    })

    // The website after importing a backup: what is written is what is read back.
    const backup = read<{ data: Record<string, unknown> }>('realistic-backup.json')
    localStorage.clear()
    localStorage.setItem(key('settings'), envelope({ name: 'Old name' }, 1))
    const { storage } = await loadStores()
    const withExtras = {
      ...backup,
      data: { ...backup.data, [key('today-layout')]: { state: { sunnahCollapsed: true }, version: 1 }, [key('from-a-newer-build')]: { state: {}, version: 1 } },
    }
    expect(storage.isBackupFile(withExtras)).toBe(true)
    storage.importBackup(withExtras)
    add('after importing a backup', localStorageSnapshot())
    write('backup-with-extras.json', withExtras)
    write('not-backups.json', [
      { ...backup, app: 'other' },
      { ...backup, version: 2 },
      { ...backup, data: [] },
      { ...backup, data: { ...backup.data, 'someone-else': 1 } },
      { app: 'azkar', version: 1 },
    ].map((file) => {
      expect(storage.isBackupFile(file)).toBe(false)
      return file
    }))

    // A zone that cannot be used becomes the device's: run with TZ=UTC so the fixtures do not depend on the machine.
    const { deviceTimeZone } = await import('../../../src/shared/date')
    const out = []
    for (const { name, raw } of cases) out.push({ name, deviceTimeZone: deviceTimeZone(), raw, expected: await hydrate(raw) })
    write('hydration.json', out)
  })
})
