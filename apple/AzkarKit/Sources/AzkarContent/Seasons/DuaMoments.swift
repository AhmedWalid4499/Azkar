import AzkarCore
import Foundation

/// A time the app brings the user's duas forward.
public enum DuaMoment: Hashable, Sendable {
    case arafah
    /// A night of the last ten of Ramadan, by its number.
    case lastTenNight(Int)
    /// Friday between Asr and Maghrib.
    case fridayHour
}

public enum DuaMoments {
    /// The moment `now` falls in, if any. `beforeDawn` is past midnight and not yet Fajr, which is
    /// still last night. Without prayer times, the times that hang on them are not known and do not come.
    public static func current(now: Date, today: DayKey, beforeDawn: Bool, asr: Date?, maghrib: Date?, offset: Int = 0) -> DuaMoment? {
        let afterMaghrib = maghrib.map { now >= $0 } ?? false
        if beforeDawn || afterMaghrib,
           let night = RamadanCalendar.night(onEvening: beforeDawn ? today.adding(days: -1) : today, offset: offset), night.isLastTen {
            return .lastTenNight(night.number)
        }
        guard !beforeDawn else { return nil }
        let hijri = HijriCalendar.date(of: today, offset: offset)
        if hijri.month == HijriDate.dhuAlHijjah, hijri.day == 9, !afterMaghrib { return .arafah }
        if today.isFriday, let asr, let maghrib, now >= asr, now < maghrib { return .fridayHour }
        return nil
    }
}
