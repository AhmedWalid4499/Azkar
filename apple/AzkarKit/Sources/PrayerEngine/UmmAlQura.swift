import AzkarCore
import Foundation

/// The Umm al-Qura calendar, for the one rule of the method that depends on it.
public enum UmmAlQura {
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private static let ramadan = 9

    /// Whether the civil day falls in Ramadan of the Umm al-Qura calendar.
    public static func isRamadan(_ day: DayKey) -> Bool {
        calendar.component(.month, from: day.noonUTC) == ramadan
    }
}
