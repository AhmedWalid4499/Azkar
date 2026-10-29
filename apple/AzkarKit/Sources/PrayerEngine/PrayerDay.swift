import AzkarCore
import Foundation

/// The six times of one calendar day at a place. Every time is an absolute instant: show it in `timeZone`.
public struct PrayerDay: Hashable, Sendable {
    public let day: DayKey
    /// The zone the times are shown in: the place's.
    public let timeZone: TimeZone
    /// The times that exist that day. A time that does not (polar day or night, or an Asr that would
    /// not fall between Dhuhr and Maghrib) is absent, never an invalid date.
    public let times: [TimeSlot: Date]

    public init(day: DayKey, timeZone: TimeZone, times: [TimeSlot: Date]) {
        self.day = day
        self.timeZone = timeZone
        self.times = times
    }

    public subscript(slot: TimeSlot) -> Date? { times[slot] }

    public subscript(prayer prayer: Prayer) -> Date? { times[TimeSlot(prayer)] }

    /// Some time of the day does not exist: the screens explain why.
    public var hasMissingTimes: Bool { times.count < TimeSlot.allCases.count }
}

extension TimeSlot {
    /// The slot an obligatory prayer occupies.
    public init(_ prayer: Prayer) {
        self = TimeSlot(rawValue: prayer.rawValue)!
    }
}
