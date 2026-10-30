import AzkarCore
import Foundation

/// The days of the Hijri year the app marks, in the order of the year.
public enum IslamicOccasion: String, CaseIterable, Codable, Sendable {
    /// 1 Muharram.
    case hijriNewYear
    /// 10 Muharram.
    case ashura
    /// The whole of Ramadan.
    case ramadan
    /// 1 Shawwal.
    case eidAlFitr
    /// 1 to 10 Dhu al-Hijjah.
    case dhulHijjahDays
    /// 9 Dhu al-Hijjah.
    case arafah
    /// 10 Dhu al-Hijjah.
    case eidAlAdha

    /// How many days ahead Today mentions it.
    var noticeLead: Int { self == .ramadan ? 10 : 3 }

    /// Today says so on the day. Arafah and Ashura have the fasting card that day, and Ramadan
    /// its own card throughout.
    var isAnnouncedOnTheDay: Bool {
        switch self {
        case .hijriNewYear, .eidAlFitr, .eidAlAdha: true
        case .ashura, .ramadan, .dhulHijjahDays, .arafah: false
        }
    }
}

/// When an occasion falls in one Hijri year.
public struct OccasionDates: Hashable, Sendable {
    public var occasion: IslamicOccasion
    public var hijriYear: Int
    public var first: DayKey
    public var last: DayKey

    public init(occasion: IslamicOccasion, hijriYear: Int, first: DayKey, last: DayKey) {
        self.occasion = occasion
        self.hijriYear = hijriYear
        self.first = first
        self.last = last
    }

    public var dayCount: Int { first.days(to: last) + 1 }
    public var isSingleDay: Bool { first == last }

    /// Which of its days `day` is, from 1, or `nil` when it falls outside them.
    public func dayNumber(of day: DayKey) -> Int? {
        let number = first.days(to: day) + 1
        return (1...dayCount).contains(number) ? number : nil
    }
}

/// What Today says about the time of year, when it has something to say.
public enum SeasonNotice: Hashable, Sendable {
    /// It is the day itself.
    case today(OccasionDates)
    /// One of several days under way; `day` counts from 1.
    case running(OccasionDates, day: Int)
    case approaching(OccasionDates, inDays: Int)

    public var dates: OccasionDates {
        switch self {
        case let .today(dates), let .running(dates, _), let .approaching(dates, _): dates
        }
    }
}

/// The occasions of the Umm al-Qura calendar with the user's offset.
public enum IslamicOccasions {
    /// The occasions of one Hijri year, in order. Empty for a year the calendar does not cover.
    public static func dates(hijriYear year: Int, offset: Int = 0) -> [OccasionDates] {
        let muharram = HijriCalendar.civilDays(ofYear: year, month: HijriDate.muharram, offset: offset)
        let ramadan = HijriCalendar.civilDays(ofYear: year, month: HijriDate.ramadan, offset: offset)
        let shawwal = HijriCalendar.civilDays(ofYear: year, month: HijriDate.shawwal, offset: offset)
        let dhuAlHijjah = HijriCalendar.civilDays(ofYear: year, month: HijriDate.dhuAlHijjah, offset: offset)
        guard muharram.count >= 10, let ramadanFirst = ramadan.first, let ramadanLast = ramadan.last,
              let eid = shawwal.first, dhuAlHijjah.count >= 10 else { return [] }
        func single(_ occasion: IslamicOccasion, _ day: DayKey) -> OccasionDates {
            OccasionDates(occasion: occasion, hijriYear: year, first: day, last: day)
        }
        return [
            single(.hijriNewYear, muharram[0]),
            single(.ashura, muharram[9]),
            OccasionDates(occasion: .ramadan, hijriYear: year, first: ramadanFirst, last: ramadanLast),
            single(.eidAlFitr, eid),
            OccasionDates(occasion: .dhulHijjahDays, hijriYear: year, first: dhuAlHijjah[0], last: dhuAlHijjah[9]),
            single(.arafah, dhuAlHijjah[8]),
            single(.eidAlAdha, dhuAlHijjah[9]),
        ]
    }

    /// What Today should say on `today`: the day itself, then whatever is closest ahead, then the
    /// first ten days of Dhu al-Hijjah while they run. `nil` for most of the year.
    public static func notice(on today: DayKey, offset: Int = 0) -> SeasonNotice? {
        let year = HijriCalendar.date(of: today, offset: offset).year
        let occasions = dates(hijriYear: year, offset: offset) + dates(hijriYear: year + 1, offset: offset)
        if let dates = occasions.first(where: { $0.first == today && $0.occasion.isAnnouncedOnTheDay }) {
            return .today(dates)
        }
        let ahead = occasions
            .map { (dates: $0, inDays: today.days(to: $0.first)) }
            .filter { (1...$0.dates.occasion.noticeLead).contains($0.inDays) }
        if let nearest = ahead.min(by: { $0.inDays < $1.inDays }) {
            return .approaching(nearest.dates, inDays: nearest.inDays)
        }
        if let dates = occasions.first(where: { $0.occasion == .dhulHijjahDays }), let day = dates.dayNumber(of: today) {
            return .running(dates, day: day)
        }
        return nil
    }
}
