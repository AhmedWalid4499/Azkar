import AzkarCore
import Foundation

/// One obligatory prayer's time, with the calendar day it belongs to (tomorrow's Fajr after Isha).
public struct UpcomingPrayer: Hashable, Sendable {
    public let prayer: Prayer
    public let at: Date
    public let day: DayKey

    public init(prayer: Prayer, at: Date, day: DayKey) {
        self.prayer = prayer
        self.at = at
        self.day = day
    }
}

/// The obligatory prayers of several days as one chronological list (sunrise is never in it).
/// Sorting by instant rather than trusting the day order matters at high latitudes, where a
/// day's Maghrib and Isha can fall after the next civil midnight.
public struct PrayerTimeline: Hashable, Sendable {
    public let days: [PrayerDay]
    /// Times that do not exist are left out.
    public let entries: [UpcomingPrayer]

    public init(days: [PrayerDay]) {
        self.days = days
        var entries: [UpcomingPrayer] = []
        for day in days {
            for prayer in Prayer.allCases {
                if let at = day[prayer: prayer] { entries.append(UpcomingPrayer(prayer: prayer, at: at, day: day.day)) }
            }
        }
        // Stable, as JavaScript's sort is: equal instants keep the order the days gave them.
        self.entries = entries.enumerated()
            .sorted { $0.element.at != $1.element.at ? $0.element.at < $1.element.at : $0.offset < $1.offset }
            .map(\.element)
    }

    /// The first prayer strictly after `now`; a prayer whose time has just arrived is no longer "next".
    /// `nil` once the known days are used up.
    public func next(after now: Date) -> UpcomingPrayer? {
        entries.first { $0.at > now }
    }

    /// The prayer whose time it is at `now`, or `nil` when there is none: between sunrise and Dhuhr,
    /// before the first known time, or when the day around `now` has a time that could not be computed.
    /// Isha runs until the following Fajr.
    public func current(at now: Date) -> UpcomingPrayer? {
        guard let current = entries.last(where: { $0.at <= now }),
              let day = days.first(where: { $0.day == current.day }) else { return nil }
        // With gaps in the day there is no telling which period this really is.
        guard Prayer.allCases.allSatisfy({ day[prayer: $0] != nil }) else { return nil }
        if current.prayer == .fajr {
            guard let sunrise = day[.sunrise], sunrise > now else { return nil }
        }
        return current
    }
}

/// The three days around today at a place (yesterday is there because at high latitudes its Isha
/// can still be ahead after midnight), with the next and current prayer at any instant.
public struct PrayerSchedule: Hashable, Sendable {
    public let today: DayKey
    public let timeZone: TimeZone
    /// Yesterday, today and tomorrow.
    public let days: [PrayerDay]
    public let timeline: PrayerTimeline

    public init(today: DayKey, at place: PrayerPlace, config: CalculationConfig) {
        self.today = today
        self.timeZone = place.timeZone
        self.days = PrayerCalculator.days(from: today.adding(days: -1), count: 3, at: place, config: config)
        self.timeline = PrayerTimeline(days: days)
    }

    /// The schedule of the calendar day `now` falls on at the place.
    public init(around now: Date, at place: PrayerPlace, config: CalculationConfig) {
        self.init(today: DayKey(now, in: place.timeZone), at: place, config: config)
    }

    public var todayTimes: PrayerDay { days[1] }

    /// The next obligatory prayer after `now`, rolling over to tomorrow's Fajr after Isha.
    public func next(after now: Date) -> UpcomingPrayer? { timeline.next(after: now) }

    /// The prayer whose time it is at `now`, if any.
    public func current(at now: Date) -> UpcomingPrayer? { timeline.current(at: now) }
}
