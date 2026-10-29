import AzkarCore
import Foundation

// The website's checks on stored values, written once so every store reads data alike.
// Each mirrors a JavaScript test named in its comment.

enum WebRules {
    /// `Number.MAX_SAFE_INTEGER`.
    static let maxSafeInteger = 9_007_199_254_740_991.0
    /// The latest instant a JavaScript `Date` can hold.
    static let maxTime = 8.64e15

    /// `Number.isInteger(value)`.
    static func isInteger(_ value: Double) -> Bool {
        value.isFinite && value.rounded(.towardZero) == value
    }

    /// `typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max` (progressData `isWhole`).
    static func whole(_ value: JSONValue?, max: Double) -> Int? {
        guard let number = value?.number, isInteger(number), number >= 0, number <= max else { return nil }
        return Int(number)
    }

    /// `isTimestamp` of the prayer log: whole milliseconds, safe, positive, a real `Date`.
    static func timestamp(_ value: JSONValue?) -> Date? {
        guard let number = value?.number, isInteger(number), abs(number) <= maxSafeInteger, number > 0, number <= maxTime else { return nil }
        return Date(epochMilliseconds: Int64(number))
    }

    /// Earliest and latest plausible recitation times (progressData `isInstant`): 2000 to 2200.
    static let earliestInstant = 946_684_800_000.0
    static let latestInstant = 7_258_118_400_000.0

    /// `isInstant` of the azkar progress: a whole millisecond from 2000 up to, not including, 2200.
    static func instant(_ value: JSONValue?) -> Date? {
        guard let number = value?.number, isInteger(number), number >= earliestInstant, number < latestInstant else { return nil }
        return Date(epochMilliseconds: Int64(number))
    }

    /// `isValidDateKey`: `YYYY-MM-DD` in ASCII digits, a day that exists. Years before 100 never
    /// pass on the website (`Date.UTC` reads them as 19xx), so they do not pass here either.
    static func day(_ key: String) -> DayKey? {
        let scalars = Array(key.unicodeScalars)
        guard scalars.count == 10, scalars[4] == "-", scalars[7] == "-" else { return nil }
        for (index, scalar) in scalars.enumerated() where index != 4 && index != 7 {
            guard ("0"..."9").contains(scalar) else { return nil }
        }
        guard let year = Int(key.prefix(4)), year >= 100 else { return nil }
        return DayKey(key)
    }

    /// `isValidTimeZone`: a zone the system knows. `Intl` also takes a zone in another case
    /// ("asia/tokyo"); that one is given its canonical spelling, which `TimeZone` needs.
    static func timeZone(_ id: String) -> String? {
        if TimeZone(identifier: id) != nil { return id }
        let lowered = id.lowercased()
        return TimeZone.knownTimeZoneIdentifiers.first { $0.lowercased() == lowered }
    }

    /// `id.length > 0 && id.length <= 100`, in UTF-16 units as JavaScript counts.
    static func isDhikrID(_ id: String) -> Bool {
        let length = id.utf16.count
        return length > 0 && length <= 100
    }

    /// `Math.round`: halves go up, towards positive infinity (`Math.round(-2.5) === -2`).
    static func jsRound(_ value: Double) -> Double {
        (value + 0.5).rounded(.down)
    }

    /// The days of a stored map that are real days, each read by `read`; days it rejects are left out.
    static func dated<T>(_ value: JSONValue?, _ read: (JSONValue) -> T?) -> [DayKey: T] {
        guard let object = value?.object else { return [:] }
        var out: [DayKey: T] = [:]
        for (key, stored) in object {
            guard let day = day(key), let item = read(stored) else { continue }
            out[day] = item
        }
        return out
    }
}

extension Date {
    /// Whole milliseconds since 1970, as `Date.now()` gives them.
    var epochMilliseconds: Int64 {
        Int64((timeIntervalSince1970 * 1000).rounded())
    }

    init(epochMilliseconds: Int64) {
        self.init(timeIntervalSince1970: Double(epochMilliseconds) / 1000)
    }

    /// The whole millisecond this instant is nearest to, as `Date(epochMilliseconds:)` makes it:
    /// SQLite keeps a date as seconds since 2001, which comes back a hair off the millisecond.
    var nearestMillisecond: Date {
        Date(epochMilliseconds: epochMilliseconds)
    }

    /// This instant cut to the whole millisecond, so what is stored round-trips through the website's format exactly.
    var wholeMilliseconds: Date {
        Date(epochMilliseconds: Int64((timeIntervalSince1970 * 1000).rounded(.down)))
    }
}
