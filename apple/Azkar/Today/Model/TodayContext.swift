import AzkarKit
import Foundation

/// Everything the Today screen derives from the clock and the settings at one moment: which
/// day it is where the user is, that day's timetable, and the part of the day. Built once per
/// clock move (see `TodayClock`) and handed to every section, so they all agree on "today".
struct TodayContext {
    let now: Date
    let timeZone: TimeZone
    /// The calendar day at the saved place (the device's zone until a place is saved).
    let today: DayKey
    let location: SavedLocation?
    /// `nil` without a location, or when the saved one cannot be used.
    let schedule: PrayerSchedule?
    let phase: DayPhase
    /// Past midnight and not yet Fajr: still last night.
    let beforeDawn: Bool

    var yesterday: DayKey { today.adding(days: -1) }
    var todayTimes: PrayerDay? { schedule?.todayTimes }
    var tomorrowTimes: PrayerDay? { schedule?.days[2] }

    /// A location is saved but it cannot be calculated for (damaged coordinates).
    var locationUnusable: Bool { location != nil && schedule == nil }

    init(now: Date, settings: SettingsSnapshot, cache: ScheduleCache) {
        self.now = now
        let zone = settings.timeZone
        timeZone = zone
        let today = DayKey(now, in: zone)
        self.today = today
        location = settings.location
        let schedule = settings.location.flatMap(PrayerPlace.init).map {
            cache.schedule(today: today, place: $0, config: settings.calculation)
        }
        self.schedule = schedule
        phase = DayPhase(at: now, in: zone, prayerDay: schedule?.todayTimes)
        beforeDawn = Night.isBeforeDawn(now, in: zone, today: schedule?.todayTimes)
    }

    /// The next moment anything on the screen changes: the next time in the three days around
    /// today (prayers and sunrise), or the next midnight at the place, whichever comes first.
    var nextBoundary: Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let midnight = calendar.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0, second: 0), matchingPolicy: .nextTime)
            ?? now.addingTimeInterval(3600)
        let times = (schedule?.days ?? []).flatMap { $0.times.values }.filter { $0 > now }
        return min(times.min() ?? midnight, midnight)
    }
}

/// Keeps the last schedule worked out, so redrawing the screen (a record logged, a setting
/// read in) does not run the astronomy again. Not observed: it only remembers.
final class ScheduleCache {
    private struct Key: Hashable {
        let today: DayKey
        let place: PrayerPlace
        let config: CalculationConfig
    }

    private var last: (key: Key, schedule: PrayerSchedule)?

    func schedule(today: DayKey, place: PrayerPlace, config: CalculationConfig) -> PrayerSchedule {
        let key = Key(today: today, place: place, config: config)
        if let last, last.key == key { return last.schedule }
        let schedule = PrayerSchedule(today: today, at: place, config: config)
        last = (key, schedule)
        return schedule
    }
}
