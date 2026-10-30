import AzkarCore
import Foundation

/// One night of Ramadan. The night comes before its day: the first falls on the civil evening
/// before 1 Ramadan, and the evening of the last day of Ramadan is already the night of the Eid.
public struct RamadanNight: Hashable, Sendable, Identifiable {
    /// 1...30, the day of Ramadan it leads into.
    public var number: Int
    /// The civil day it falls on, which its tarawih and its night prayer are filed under.
    public var evening: DayKey
    /// One of the last ten nights.
    public var isLastTen: Bool
    public var isOdd: Bool

    public var id: Int { number }

    init(number: Int, evening: DayKey) {
        self.number = number
        self.evening = evening
        isLastTen = number >= 21
        isOdd = number % 2 == 1
    }
}

/// The nights of Ramadan in the Umm al-Qura calendar with the user's offset.
public enum RamadanCalendar {
    /// The nights of one Ramadan, in order: one for each of its days. Empty for a year the
    /// calendar does not cover.
    public static func nights(hijriYear: Int, offset: Int = 0) -> [RamadanNight] {
        HijriCalendar.civilDays(ofYear: hijriYear, month: HijriDate.ramadan, offset: offset).enumerated().map { index, day in
            RamadanNight(number: index + 1, evening: day.adding(days: -1))
        }
    }

    /// The Ramadan night falling on the evening of `day`, or nil.
    public static func night(onEvening day: DayKey, offset: Int = 0) -> RamadanNight? {
        HijriCalendar.ramadanDay(of: day.adding(days: 1), offset: offset).map { RamadanNight(number: $0, evening: day) }
    }
}

/// One Ramadan and the Eids of its year, whatever the year. The fasting figures of the tracker
/// (`RamadanFasts`) count the same fasts, so the two always agree.
public struct RamadanSummary: Hashable, Sendable {
    public var year: Int
    /// Days of Ramadan that year.
    public var days: Int
    /// Ramadan fasts kept, counted by the Hijri year of their day as `FastingStats.ramadan` counts
    /// them, so a fast filed on the edge of the month before the offset changed still counts.
    public var fasted: Int
    /// Nights logged.
    public var tarawih: Int
    public var tarawihAtMasjid: Int
    public var tarawihAtHome: Int
    /// The sum of the rakahs given.
    public var tarawihRakahs: Int
    /// Quran pages on the days of Ramadan, the Eid not among them.
    public var pagesRead: Int
    /// Khatmahs finished on the days of Ramadan, those added by hand included.
    public var khatmahs: Int
    /// Nights of the last ten with tarawih or the night prayer. Both are filed under the evening:
    /// `Night.sunnahDay` keeps a night prayer ticked before Fajr on the day whose Isha opened that
    /// night, so one prayed past midnight is found on the evening too.
    public var lastTenStood: Int
    /// How many of the last ten there were: 9 in a Ramadan of 29 days.
    public var lastTenNights: Int
    public var eidFitrPrayed: Bool
    /// The day of Arafah was fasted to the end, whatever the fast was logged as.
    public var arafahFasted: Bool
    public var eidAdhaPrayed: Bool
    /// Anything at all in the figures above; `days` and `lastTenNights` are the calendar's.
    public var hasAnyRecord: Bool

    public init(hijriYear: Int, offset: Int, history: TrackerHistory) {
        let ramadan = HijriCalendar.civilDays(ofYear: hijriYear, month: HijriDate.ramadan, offset: offset)
        let nights = RamadanCalendar.nights(hijriYear: hijriYear, offset: offset)
        let lastTen = nights.filter(\.isLastTen)
        let tarawih = nights.compactMap { history.seasons[$0.evening]?[.tarawih] }
        let quran = QuranProgress(entries: history.quran)
        let occasions = IslamicOccasions.dates(hijriYear: hijriYear, offset: offset)
        func day(of occasion: IslamicOccasion) -> DayKey? {
            occasions.first { $0.occasion == occasion }?.first
        }
        func prayed(on occasion: IslamicOccasion) -> Bool {
            day(of: occasion).flatMap { history.seasons[$0]?[.eidPrayer] } != nil
        }

        year = hijriYear
        days = ramadan.count
        fasted = history.fasts.filter { key, record in
            record.kind == .ramadan && record.status == .fasted && HijriCalendar.date(of: key, offset: offset).year == hijriYear
        }.count
        self.tarawih = tarawih.count
        tarawihAtMasjid = tarawih.filter { $0.place == .masjid }.count
        tarawihAtHome = tarawih.filter { $0.place == .home }.count
        tarawihRakahs = tarawih.compactMap(\.rakahs).reduce(0, +)
        pagesRead = ramadan.reduce(0) { $0 + quran.pages(on: $1) }
        khatmahs = quran.khatmahDates.filter(Set(ramadan).contains).count
        lastTenStood = lastTen.filter { night in
            history.seasons[night.evening]?[.tarawih] != nil || history.prayers[night.evening]?.sunnah[.qiyam] != nil
        }.count
        lastTenNights = lastTen.count
        eidFitrPrayed = prayed(on: .eidAlFitr)
        arafahFasted = day(of: .arafah).flatMap { history.fasts[$0] }?.status == .fasted
        eidAdhaPrayed = prayed(on: .eidAlAdha)
        hasAnyRecord = fasted > 0 || !tarawih.isEmpty || pagesRead > 0 || khatmahs > 0 || lastTenStood > 0
            || eidFitrPrayed || arafahFasted || eidAdhaPrayed
    }
}

/// What a khatmah goal for Ramadan asks of each day.
public enum RamadanGoal {
    /// Pages a day still needed to finish `goal` khatmahs by the end of Ramadan, today included;
    /// nil when today is not in Ramadan or goal is 0. 0 once met.
    ///
    /// Khatmahs count as in `RamadanSummary`: those finished on the days of Ramadan, by hand
    /// too. What is left is measured from the position, so a khatmah under way counts for all that
    /// is read of it, before Ramadan included, and what was read today already counts.
    public static func pagesPerDay(goal: Int, today: DayKey, offset: Int, quran: [QuranEntry]) -> Int? {
        let hijri = HijriCalendar.date(of: today, offset: offset)
        guard goal > 0, hijri.month == HijriDate.ramadan else { return nil }
        let ramadan = HijriCalendar.civilDays(ofYear: hijri.year, month: HijriDate.ramadan, offset: offset)
        guard let last = ramadan.last else { return nil }
        let progress = QuranProgress(entries: quran)
        let finished = progress.khatmahDates.filter(Set(ramadan).contains).count
        let pages = (goal - finished) * QuranProgress.pageCount - progress.position
        guard pages > 0 else { return 0 }
        let daysLeft = today.days(to: last) + 1
        return (pages + daysLeft - 1) / daysLeft
    }
}

public extension TrackerHistory {
    /// Hijri years with anything in `RamadanSummary`, newest first; always includes `current`.
    func ramadanYears(current: Int, offset: Int) -> [Int] {
        // Sha'ban to Dhu al-Hijjah, all within one Hijri year, so a record's day gives its year.
        var days = Set(seasons.keys)
        days.formUnion(fasts.keys)
        days.formUnion(quran.map(\.day))
        days.formUnion(prayers.filter { $0.value.sunnah[.qiyam] != nil }.keys)
        var years = Set(days.map { HijriCalendar.date(of: $0, offset: offset).year })
            .filter { RamadanSummary(hijriYear: $0, offset: offset, history: self).hasAnyRecord }
        years.insert(current)
        return years.sorted(by: >)
    }
}
