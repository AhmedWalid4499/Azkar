import AzkarKit
import Foundation

/// Where the tracker is in time: today in the saved place's zone, and whether the night still
/// belongs to yesterday (past midnight, before Fajr), which decides the day streaks are counted to.
struct TrackerClock: Hashable {
    let now: Date
    let timeZone: TimeZone
    let today: DayKey
    let beforeDawn: Bool

    init(now: Date, settings: SettingsSnapshot) {
        let zone = settings.timeZone
        let today = DayKey(now, in: zone)
        self.now = now
        timeZone = zone
        self.today = today
        beforeDawn = Night.isBeforeDawn(now, in: zone, today: TrackerClock.prayerDay(today, settings: settings))
    }

    /// The day the prayer and sunnah streaks and rates are counted up to (yesterday until Fajr).
    var statsDay: DayKey { TrackerStats.statsDay(today: today, beforeDawn: beforeDawn) }

    /// The timetable of `day` at the saved place, or `nil` while no place is set.
    static func prayerDay(_ day: DayKey, settings: SettingsSnapshot) -> PrayerDay? {
        guard let location = settings.location, let place = PrayerPlace(location) else { return nil }
        return PrayerCalculator.day(day, at: place, config: settings.calculation)
    }
}
