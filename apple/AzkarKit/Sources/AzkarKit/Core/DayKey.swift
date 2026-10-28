import Foundation

/// A calendar day, independent of any time zone: the same `YYYY-MM-DD` the website stores.
/// Records are filed under the day in the saved place's zone, never under a raw `Date`.
public struct DayKey: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    public let year: Int
    public let month: Int
    public let day: Int

    private static let gregorian: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    /// A real calendar day, or `nil` (no 30 February).
    public init?(year: Int, month: Int, day: Int) {
        guard (1...9999).contains(year), let date = DayKey.gregorian.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) else { return nil }
        let back = DayKey.gregorian.dateComponents([.year, .month, .day], from: date)
        guard back.year == year, back.month == month, back.day == day else { return nil }
        self.year = year
        self.month = month
        self.day = day
    }

    /// Parses `YYYY-MM-DD` exactly as the website writes it.
    public init?(_ string: String) {
        let parts = string.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else { return nil }
        self.init(year: year, month: month, day: day)
    }

    /// The calendar day an instant falls on in `timeZone`.
    public init(_ date: Date, in timeZone: TimeZone) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.year = parts.year!
        self.month = parts.month!
        self.day = parts.day!
    }

    public var description: String { String(format: "%04d-%02d-%02d", year, month, day) }

    /// Noon UTC on this day: format it with a UTC calendar to show the day without any zone moving it.
    public var noonUTC: Date {
        DayKey.gregorian.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    public func adding(days: Int) -> DayKey {
        let date = DayKey.gregorian.date(byAdding: .day, value: days, to: noonUTC)!
        return DayKey(date, in: TimeZone(identifier: "UTC")!)
    }

    /// Whole days from `self` to `other` (positive when `other` is later).
    public func days(to other: DayKey) -> Int {
        DayKey.gregorian.dateComponents([.day], from: noonUTC, to: other.noonUTC).day!
    }

    /// 1 = Sunday … 7 = Saturday, as `Calendar` numbers weekdays.
    public var weekday: Int { DayKey.gregorian.component(.weekday, from: noonUTC) }

    public static func < (lhs: DayKey, rhs: DayKey) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    // Stored as the string, so records and backups read the same as the website's.
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        guard let key = DayKey(string) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not a YYYY-MM-DD day: \(string)")
        }
        self = key
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }
}
