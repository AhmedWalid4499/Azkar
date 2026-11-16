import AzkarKit
import SwiftUI

/// Menstrual mode: while it is on, each obligatory prayer whose time comes is logged as excused (so
/// streaks and stats are untouched), each day of Ramadan it touches is logged as an excused fast
/// (owed, without blame), and the prayer and fasting reminders pause
/// (`SettingsSnapshot.activeReminders`). What the user logged themself is never changed.
///
/// Nothing runs on a timer: `catchUp` fills in what came since, whenever the system services
/// refresh (launch, foreground, every change, each prayer time while the app runs, background refresh).
enum MenstrualMode {
    /// Turns it on from now.
    @MainActor
    static func turnOn(_ app: AppEnvironment, now: Date = .now) {
        app.settings.update { $0.app.menstrualSince = now.wholeSecond }
    }

    /// Turns it off. The prayer whose time is still running, if the mode excused it, is cleared again,
    /// so it can be prayed and its reminder comes back.
    @MainActor
    static func turnOff(_ app: AppEnvironment, now: Date = .now) async {
        let settings = app.settings.settings
        guard let since = settings.app.menstrualSince else { return }
        app.settings.update { $0.app.menstrualSince = nil }
        guard let location = settings.location, let place = PrayerPlace(location),
              let running = PrayerSchedule(around: now, at: place, config: settings.calculation).current(at: now),
              let entry = try? await app.store.day(running.day).prayer.prayers[running.prayer],
              entry.status == .excused, let logged = entry.loggedAt, logged >= since.addingTimeInterval(-1) else { return }
        _ = try? await app.store.setPrayer(running.prayer, nil, on: running.day, at: now)
    }

    /// Logs as excused every prayer and Ramadan fast the mode covers up to `now` that has nothing
    /// logged yet. Returns whether anything was logged.
    @discardableResult
    static func catchUp(settings: SettingsSnapshot, store: RecordStore, now: Date = .now) async -> Bool {
        guard let since = settings.app.menstrualSince, since <= now,
              let location = settings.location, let place = PrayerPlace(location) else { return false }
        let first = MenstrualExcuses.firstDay(since: since, now: now, in: place.timeZone)
        let today = DayKey(now, in: place.timeZone)
        let days = PrayerCalculator.days(from: first, count: first.days(to: today) + 1, at: place, config: settings.calculation)
        let prayers = MenstrualExcuses.prayers(since: since, now: now, timeline: PrayerTimeline(days: days))
        let offset = settings.app.hijriOffset
        let fasts = MenstrualExcuses.ramadanDays(since: since, now: now, days: days) { HijriCalendar.isRamadan($0, offset: offset) }
        guard !prayers.isEmpty || !fasts.isEmpty,
              let recorded = try? await store.days(from: first, to: today) else { return false }
        let byDay = Dictionary(recorded.map { ($0.day, $0) }, uniquingKeysWith: { first, _ in first })

        var logged = false
        for prayer in prayers where byDay[prayer.day]?.prayer.prayers[prayer.prayer] == nil {
            if (try? await store.setPrayer(prayer.prayer, .excused, on: prayer.day, at: now))?.changed == true { logged = true }
        }
        for day in fasts where byDay[day]?.fast == nil {
            if (try? await store.setFast(.ramadan, .excused, on: day, at: now))?.changed == true { logged = true }
        }
        return logged
    }

    /// Which day of the mode `now` is, from 1.
    static func dayNumber(since: Date, now: Date, in timeZone: TimeZone) -> Int {
        max(1, DayKey(since, in: timeZone).days(to: DayKey(now, in: timeZone)) + 1)
    }
}

extension Date {
    /// This instant without its fraction of a second (what the settings keep, in milliseconds).
    fileprivate var wholeSecond: Date { Date(timeIntervalSince1970: timeIntervalSince1970.rounded(.down)) }
}

extension Color {
    /// Menstrual mode's own colour: a dusk indigo, apart from the app's green and gold.
    static let menstrual = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x9C / 255, green: 0xA6 / 255, blue: 0xF0 / 255, alpha: 1)
            : UIColor(red: 0x4F / 255, green: 0x5B / 255, blue: 0xA6 / 255, alpha: 1)
    })

    /// A quiet wash of the indigo, for cards and icon tiles.
    static let menstrualWash = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x9C / 255, green: 0xA6 / 255, blue: 0xF0 / 255, alpha: 0.16)
            : UIColor(red: 0x4F / 255, green: 0x5B / 255, blue: 0xA6 / 255, alpha: 0.10)
    })
}

/// A string of the Menstrual table (`Menstrual.xcstrings`).
nonisolated func M(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Menstrual")
}
