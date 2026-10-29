import AzkarCore
import Foundation
@testable import PrayerEngine

/// The website's test places (src/features/prayer-times/test-helpers.ts).
enum TestPlaces {
    static let cairo = PrayerPlace(latitude: 30.0444, longitude: 31.2357, timeZoneIdentifier: "Africa/Cairo", countryCode: "EG")!
    static let tromso = PrayerPlace(latitude: 69.6492, longitude: 18.9553, timeZoneIdentifier: "Europe/Oslo", countryCode: "NO")!
    static let reykjavik = PrayerPlace(latitude: 64.1466, longitude: -21.9426, timeZoneIdentifier: "Atlantic/Reykjavik", countryCode: "IS")!

    /// The instant a wall-clock time ("HH:mm" or "HH:mm:ss") on a day reads in `zone`.
    static func instant(_ day: String, _ clock: String, _ zone: TimeZone) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let key = DayKey(day)!
        let parts = clock.split(separator: ":").map { Int($0)! }
        return calendar.date(from: DateComponents(year: key.year, month: key.month, day: key.day, hour: parts[0], minute: parts[1], second: parts.count > 2 ? parts[2] : 0))!
    }

    static func iso(_ string: String) -> Date { try! Date(string, strategy: .iso8601) }
}

extension UpcomingPrayer {
    /// "fajr 2026-10-12", as the website's tests write an entry.
    var brief: String { "\(prayer.rawValue) \(day)" }
}
