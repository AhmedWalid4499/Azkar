import AzkarCore
import Foundation

/// Where the reading stands, small enough for a widget.
public struct QuranGlance: Hashable, Sendable {
    /// The last page reached in this khatmah, 0 before the first.
    public var position: Int
    /// The page reading goes on from.
    public var nextPage: Int
    /// Of the surah on `nextPage`.
    public var suraName: String
    public var suraTransliteration: String
    public var juz: Int
    public var pagesToday: Int
    public var khatmahs: Int
    /// Anything is in the log.
    public var hasStarted: Bool

    public var fraction: Double { Double(position) / Double(QuranProgress.pageCount) }

    public init(entries: [QuranEntry], today: DayKey, index: QuranPageIndex = .bundled) {
        let progress = QuranProgress(entries: entries)
        position = progress.position
        nextPage = min(progress.position + 1, QuranProgress.pageCount)
        suraName = index.suraName(ofPage: nextPage)
        suraTransliteration = index.suraTransliteration(ofPage: nextPage)
        juz = index.juz(ofPage: nextPage)
        pagesToday = progress.pages(on: today)
        khatmahs = progress.khatmahs
        hasStarted = !entries.isEmpty
    }
}

/// Ramadan at this moment, small enough for a widget: from the day whose evening is the first night
/// to the last day of the month. The Eid has none.
public struct RamadanGlance: Hashable, Sendable {
    /// The day of Ramadan today; nil on the day before it begins.
    public var day: Int?
    /// The night ahead, or the one under way before Fajr; nil from the last evening on, when what
    /// falls is the night of the Eid.
    public var night: RamadanNight?
    /// That night's tarawih, once logged.
    public var tarawih: SeasonRecord?
    /// Pages a day still needed for the khatmah goal; nil without a goal. 0 once met.
    public var pagesPerDay: Int?

    /// The civil day the night of this moment falls on: last evening's until Fajr.
    public static func evening(today: DayKey, beforeDawn: Bool) -> DayKey {
        beforeDawn ? today.adding(days: -1) : today
    }

    /// `tarawih` is what is logged on `evening(today:beforeDawn:)`.
    public init?(today: DayKey, beforeDawn: Bool, offset: Int, goal: Int, quran: [QuranEntry], tarawih: SeasonRecord?) {
        day = HijriCalendar.ramadanDay(of: today, offset: offset)
        night = RamadanCalendar.night(onEvening: Self.evening(today: today, beforeDawn: beforeDawn), offset: offset)
        guard day != nil || night != nil else { return nil }
        self.tarawih = night == nil ? nil : tarawih
        pagesPerDay = RamadanGoal.pagesPerDay(goal: goal, today: today, offset: offset, quran: quran)
    }
}
