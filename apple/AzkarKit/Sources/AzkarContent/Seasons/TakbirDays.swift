import AzkarCore
import Foundation

/// When the takbir of the Eid is said, as Today offers its counter.
public enum TakbirSeason: Hashable, Sendable {
    /// The night before Eid al-Fitr (from Maghrib on the last day of Ramadan) and the Eid day
    /// until its prayer.
    case eidAlFitr
    /// The first thirteen days of Dhu al-Hijjah: the ten days, the day of the sacrifice and the
    /// days of Tashriq. `day` counts from 1.
    case dhulHijjah(day: Int)
}

/// The takbir days of the Umm al-Qura calendar with the user's offset.
public enum TakbirDays {
    /// The last day of Dhu al-Hijjah on which the takbir is said: the third day of Tashriq.
    public static let lastDhulHijjahDay = 13

    /// The takbir season `today` falls in, or `nil`. `afterMaghrib` tells whether the sun has set
    /// on `today`, which begins the night of Eid al-Fitr.
    public static func season(on today: DayKey, afterMaghrib: Bool, offset: Int = 0) -> TakbirSeason? {
        let date = HijriCalendar.date(of: today, offset: offset)
        if date.month == HijriDate.dhuAlHijjah, (1...lastDhulHijjahDay).contains(date.day) {
            return .dhulHijjah(day: date.day)
        }
        if date.month == HijriDate.shawwal, date.day == 1 { return .eidAlFitr }
        if afterMaghrib {
            let tomorrow = HijriCalendar.date(of: today.adding(days: 1), offset: offset)
            if tomorrow.month == HijriDate.shawwal, tomorrow.day == 1 { return .eidAlFitr }
        }
        return nil
    }
}
