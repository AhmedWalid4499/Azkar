import AzkarCore
import Foundation

/// A day on which fasting is not permitted.
public enum ForbiddenFastDay: String, CaseIterable, Codable, Sendable {
    /// 1 Shawwal.
    case eidAlFitr
    /// 10 Dhu al-Hijjah.
    case eidAlAdha
    /// 11 to 13 Dhu al-Hijjah.
    case tashriq
}

/// Why a day is recommended for a voluntary fast, from the most to the least particular.
/// Raw values match the website's `FASTING_REASONS`.
public enum FastingReason: String, CaseIterable, Codable, Sendable {
    /// 9 Dhu al-Hijjah.
    case arafah
    /// 10 Muharram.
    case ashura
    /// 9 Muharram, fasted with Ashura.
    case tasua
    /// Shawwal after the Eid: six of its days.
    case shawwal
    /// The 13th, 14th and 15th of a Hijri month.
    case whiteDays
    case monday
    case thursday
}

/// What the calendar says about fasting on one civil day.
public struct FastingDayInfo: Hashable, Sendable {
    public var day: DayKey
    public var hijri: HijriDate
    /// The day of Ramadan (1 to 30), or `nil` outside Ramadan.
    public var ramadanDay: Int?
    public var forbidden: ForbiddenFastDay?
    /// Empty in Ramadan, whose fast is obligatory, and on a day fasting is not permitted.
    public var reasons: [FastingReason]

    public var isRamadan: Bool { ramadanDay != nil }
    /// A voluntary fast is recommended on this day.
    public var isRecommended: Bool { !reasons.isEmpty }
}

/// The fasting days of the Umm al-Qura calendar with the user's offset. As
/// `src/features/fasting/occasions.ts` on the web branch, checked against the rules: the two
/// Eids and the days of Tashriq are forbidden; Arafah, Ashura with the day before it, Shawwal
/// after the Eid, the white days, Mondays and Thursdays are recommended.
public enum FastingCalendar {
    /// How many fasts the sunnah of Shawwal asks for.
    public static let shawwalFasts = 6
    static let whiteDays = 13...15
    static let monday = 2
    static let thursday = 5

    public static func forbiddenDay(_ hijri: HijriDate) -> ForbiddenFastDay? {
        if hijri.month == HijriDate.shawwal, hijri.day == 1 { return .eidAlFitr }
        if hijri.month == HijriDate.dhuAlHijjah, hijri.day == 10 { return .eidAlAdha }
        if hijri.month == HijriDate.dhuAlHijjah, (11...13).contains(hijri.day) { return .tashriq }
        return nil
    }

    public static func info(for day: DayKey, offset: Int = 0) -> FastingDayInfo {
        let hijri = HijriCalendar.date(of: day, offset: offset)
        let ramadanDay = hijri.month == HijriDate.ramadan ? hijri.day : nil
        let forbidden = forbiddenDay(hijri)
        var reasons: [FastingReason] = []
        if ramadanDay == nil, forbidden == nil {
            if hijri.month == HijriDate.dhuAlHijjah, hijri.day == 9 { reasons.append(.arafah) }
            if hijri.month == HijriDate.muharram, hijri.day == 10 { reasons.append(.ashura) }
            if hijri.month == HijriDate.muharram, hijri.day == 9 { reasons.append(.tasua) }
            if hijri.month == HijriDate.shawwal, hijri.day >= 2 { reasons.append(.shawwal) }
            if whiteDays.contains(hijri.day) { reasons.append(.whiteDays) }
            if day.weekday == monday { reasons.append(.monday) }
            if day.weekday == thursday { reasons.append(.thursday) }
        }
        return FastingDayInfo(day: day, hijri: hijri, ramadanDay: ramadanDay, forbidden: forbidden, reasons: reasons)
    }

    public static func isMondayOrThursday(_ day: DayKey) -> Bool {
        day.weekday == monday || day.weekday == thursday
    }

    /// One of the white days on which fasting is allowed: not in Ramadan, and not the 13th of
    /// Dhu al-Hijjah, a day of Tashriq.
    public static func isWhiteDay(_ hijri: HijriDate) -> Bool {
        whiteDays.contains(hijri.day) && hijri.month != HijriDate.ramadan && forbiddenDay(hijri) == nil
    }
}
