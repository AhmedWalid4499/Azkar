import AzkarCore
import Foundation

/// A day of the Umm al-Qura calendar. Months run from 1 (Muharram) to 12 (Dhu al-Hijjah).
public struct HijriDate: Hashable, Comparable, Sendable, CustomStringConvertible {
    public var year: Int
    public var month: Int
    public var day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public static let muharram = 1
    public static let ramadan = 9
    public static let shawwal = 10
    public static let dhuAlHijjah = 12

    public var description: String { "\(year)-\(month)-\(day) AH" }

    public static func < (lhs: HijriDate, rhs: HijriDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

/// A Gregorian month; `month` runs 1 to 12.
public struct GregorianMonth: Hashable, Comparable, Sendable, CustomStringConvertible {
    public var year: Int
    public var month: Int

    public init(year: Int, month: Int) {
        self.year = year
        self.month = month
    }

    public init(_ day: DayKey) {
        self.init(year: day.year, month: day.month)
    }

    public var firstDay: DayKey { DayKey(year: year, month: month, day: 1)! }

    public var dayCount: Int { firstDay.days(to: adding(months: 1).firstDay) }

    public var lastDay: DayKey { firstDay.adding(days: dayCount - 1) }

    public var days: [DayKey] { (0..<dayCount).map { firstDay.adding(days: $0) } }

    public func adding(months: Int) -> GregorianMonth {
        let index = year * 12 + (month - 1) + months
        let year = Int((Double(index) / 12).rounded(.down))
        return GregorianMonth(year: year, month: index - year * 12 + 1)
    }

    public func contains(_ day: DayKey) -> Bool { day.year == year && day.month == month }

    public var description: String { String(format: "%04d-%02d", year, month) }

    public static func < (lhs: GregorianMonth, rhs: GregorianMonth) -> Bool {
        (lhs.year, lhs.month) < (rhs.year, rhs.month)
    }
}

/// The Umm al-Qura calendar (Foundation's `islamicUmmAlQura`, the same ICU calendar the
/// website's `Intl` uses) with the user's day offset. Local moon sighting can differ by a day
/// or two; a positive offset moves the Hijri date later, exactly as the website's
/// `formatHijri` and `hijriOf` shift it.
public enum HijriCalendar {
    /// The offset the settings allow.
    public static let offsetRange = -2...2

    private static let ummAlQura: Calendar = {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    /// The Hijri date of a civil day.
    public static func date(of day: DayKey, offset: Int = 0) -> HijriDate {
        let parts = ummAlQura.dateComponents([.year, .month, .day], from: day.adding(days: offset).noonUTC)
        return HijriDate(year: parts.year!, month: parts.month!, day: parts.day!)
    }

    /// The day of Ramadan (1 to 30), or `nil` outside Ramadan.
    public static func ramadanDay(of day: DayKey, offset: Int = 0) -> Int? {
        let hijri = date(of: day, offset: offset)
        return hijri.month == HijriDate.ramadan ? hijri.day : nil
    }

    public static func isRamadan(_ day: DayKey, offset: Int = 0) -> Bool {
        ramadanDay(of: day, offset: offset) != nil
    }

    /// The civil day on which the Hijri month containing `day` begins.
    public static func monthStart(of day: DayKey, offset: Int = 0) -> DayKey {
        day.adding(days: 1 - date(of: day, offset: offset).day)
    }

    /// The civil days of one Hijri month, in order, as the user's offset places them. Empty for
    /// a month that does not exist.
    public static func civilDays(ofYear year: Int, month: Int, offset: Int = 0) -> [DayKey] {
        guard (1...12).contains(month), year > 0,
              let first = ummAlQura.date(from: DateComponents(year: year, month: month, day: 1, hour: 12)) else { return [] }
        let start = DayKey(first, in: TimeZone(identifier: "UTC")!).adding(days: -offset)
        guard date(of: start, offset: offset) == HijriDate(year: year, month: month, day: 1) else { return [] }
        var days: [DayKey] = []
        var key = start
        while days.count < 30 {
            let hijri = date(of: key, offset: offset)
            guard hijri.year == year, hijri.month == month else { break }
            days.append(key)
            key = key.adding(days: 1)
        }
        return days
    }
}
