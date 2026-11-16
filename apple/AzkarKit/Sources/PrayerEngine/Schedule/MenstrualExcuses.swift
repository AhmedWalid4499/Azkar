import AzkarCore
import Foundation

/// What menstrual mode excuses while it is on: each obligatory prayer whose time came, the one
/// whose time it already was when the mode was turned on included, and each day of Ramadan it
/// touched between Fajr and Maghrib (that day's fast is owed, without blame). The app logs these
/// as excused where nothing is logged yet; what the user logged stays as it is.
public enum MenstrualExcuses {
    /// The longest stretch looked back over: bleeding after childbirth (nifas) lasts at most forty days.
    public static let maximumDays = 40

    /// Where the excusing starts: when the mode was turned on, or `maximumDays` before `now` if that is later.
    public static func start(since: Date, now: Date) -> Date {
        max(since, now.addingTimeInterval(-Double(maximumDays) * 86_400))
    }

    /// The first day whose times the plan needs: the day before `start`, whose Isha can still be running.
    public static func firstDay(since: Date, now: Date, in timeZone: TimeZone) -> DayKey {
        DayKey(start(since: since, now: now), in: timeZone).adding(days: -1)
    }

    /// The prayers to excuse, oldest first. `timeline` must run from `firstDay` to the day of `now`.
    public static func prayers(since: Date, now: Date, timeline: PrayerTimeline) -> [UpcomingPrayer] {
        guard since <= now else { return [] }
        let start = start(since: since, now: now)
        let running = timeline.current(at: start)
        return timeline.entries.filter { $0.at <= now && ($0.at >= start || $0 == running) }
    }

    /// The days of Ramadan to log as excused fasts, oldest first: those whose fasting hours, Fajr to
    /// Maghrib, have begun and overlap the time the mode has been on.
    public static func ramadanDays(since: Date, now: Date, days: [PrayerDay], isRamadan: (DayKey) -> Bool) -> [DayKey] {
        guard since <= now else { return [] }
        let start = start(since: since, now: now)
        return days.compactMap { day in
            guard isRamadan(day.day), let fajr = day[.fajr], let maghrib = day[.maghrib] else { return nil }
            return fajr <= now && start < maghrib ? day.day : nil
        }
    }
}
