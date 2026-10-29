import Foundation

// The engine works in epoch milliseconds held in a Double, with NaN for "no such time",
// exactly as the website's engine works with JavaScript Dates. Every operation that
// builds a Date there truncates to a whole millisecond here, so both land on the very
// same instant, down to the leftover milliseconds a night fraction can leave behind.

typealias Instant = Double

enum JS {
    static let invalid: Instant = .nan

    /// `new Date(ms)`: whole milliseconds toward zero, NaN outside the range a Date can hold.
    static func date(_ ms: Double) -> Instant {
        guard ms.isFinite, abs(ms) <= 8.64e15 else { return .nan }
        return ms.rounded(.towardZero)
    }

    /// `Math.round`: halves go toward positive infinity.
    static func round(_ value: Double) -> Double {
        let down = value.rounded(.down)
        return value - down >= 0.5 ? down + 1 : down
    }

    /// `Date.UTC(year, month0, day, hours, minutes, seconds)` for whole-number fields
    /// (any of which may be out of range, or NaN).
    static func utc(year: Int, month0: Int, day: Double, hours: Double = 0, minutes: Double = 0, seconds: Double = 0) -> Instant {
        guard day.isFinite, hours.isFinite, minutes.isFinite, seconds.isFinite else { return .nan }
        let wrappedYear = year + Int((Double(month0) / 12).rounded(.down))
        let month = ((month0 % 12) + 12) % 12
        let days = Double(daysFromCivil(year: wrappedYear, month: month + 1, day: 1)) + day - 1
        let time = hours * 3_600_000 + minutes * 60_000 + seconds * 1000
        return date(days * 86_400_000 + time)
    }

    /// Days since 1970-01-01 of a proleptic Gregorian date (Howard Hinnant's algorithm).
    static func daysFromCivil(year: Int, month: Int, day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yearOfEra = y - era * 400
        let shiftedMonth = month > 2 ? month - 3 : month + 9
        let dayOfYear = (153 * shiftedMonth + 2) / 5 + day - 1
        let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
        return era * 146_097 + dayOfEra - 719_468
    }

    /// `date.getUTCSeconds()`.
    static func utcSeconds(_ instant: Instant) -> Double {
        guard instant.isFinite else { return .nan }
        let wholeSeconds = (instant / 1000).rounded(.down)
        let seconds = wholeSeconds.truncatingRemainder(dividingBy: 60)
        return seconds < 0 ? seconds + 60 : seconds
    }

    static func isValid(_ instant: Instant) -> Bool { instant.isFinite }

    static func toDate(_ instant: Instant) -> Date? {
        instant.isFinite ? Date(timeIntervalSince1970: instant / 1000) : nil
    }

    /// The instant a Date stands for, in whole milliseconds as the engine keeps them.
    static func instant(_ date: Date) -> Instant {
        (date.timeIntervalSince1970 * 1000).rounded()
    }
}
