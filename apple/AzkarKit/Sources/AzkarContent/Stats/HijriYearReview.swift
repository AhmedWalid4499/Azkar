import AzkarCore
import Foundation

/// Everything recorded in one Hijri year, up to today. Days are told apart as everywhere in the
/// tracker: a prayer, a session or a fast belongs to the day it is filed under, and a day not yet
/// begun counts for nothing.
public struct HijriYearReview: Hashable, Sendable {
    /// One Hijri month of the year.
    public struct Month: Hashable, Sendable, Identifiable {
        /// 1 (Muharram) to 12 (Dhu al-Hijjah).
        public var month: Int
        public var prayed = 0
        public var sessions = 0
        public var pages = 0
        public var fasts = 0

        public var id: Int { month }
        public var hasAnyRecord: Bool { prayed > 0 || sessions > 0 || pages > 0 || fasts > 0 }

        init(month: Int) {
            self.month = month
        }
    }

    public var year: Int
    /// The year is over.
    public var isFinished: Bool
    /// Days of the year that have begun.
    public var daysSoFar: Int
    /// Those with anything recorded.
    public var activeDays: Int

    /// Obligatory prayers by status.
    public var prayers = StatusCounts()
    /// Prayers logged as on time, in congregation or made up late.
    public var prayed = 0
    /// Days with every prayer prayed or excused and at least one prayed.
    public var completeDays = 0
    /// The longest run of complete days within the year, as `PrayerStats.streaks` runs them.
    public var bestStreak = 0
    public var sunnah = 0

    /// Sessions read to the end, by session.
    public var sessions: [AzkarSession: Int] = [:]
    public var recitations = 0
    public var tasbih = 0

    public var pages = 0
    /// Days with any page read.
    public var quranDays = 0
    public var khatmahs = 0

    /// Fasts kept to the end, by kind.
    public var fasts: [FastKind: Int] = [:]
    public var tarawih = 0
    public var eidPrayers = 0

    /// Muharram to Dhu al-Hijjah.
    public var months: [Month]

    public var sessionsCompleted: Int { sessions.values.reduce(0, +) }
    public var fastsKept: Int { fasts.values.reduce(0, +) }
    public var hasAnyRecord: Bool { activeDays > 0 }

    public init(hijriYear: Int, offset: Int, today: DayKey, history: TrackerHistory) {
        year = hijriYear
        months = (1...12).map(Month.init(month:))
        let days = (1...12).flatMap { month in
            HijriCalendar.civilDays(ofYear: hijriYear, month: month, offset: offset).map { (month: month, day: $0) }
        }
        isFinished = days.last.map { $0.day < today } ?? true
        let quran = QuranProgress(entries: history.quran)
        let khatmahs = Dictionary(grouping: quran.khatmahDates) { $0 }
        var run = 0
        var counted = 0
        var active = 0
        for (month, day) in days where day <= today {
            counted += 1
            var isActive = false

            let summary = PrayerStats.summarize(history.prayers[day])
            for status in PrayerStatus.allCases { prayers[status] += summary.counts[status] }
            prayed += summary.prayed
            months[month - 1].prayed += summary.prayed
            isActive = isActive || summary.logged > 0
            switch summary.standing {
            case .complete:
                completeDays += 1
                run += 1
                bestStreak = max(bestStreak, run)
            case .incomplete where day != today:
                run = 0
            default:
                break
            }
            let sunnahTicked = history.prayers[day]?.sunnah.count ?? 0
            sunnah += sunnahTicked
            isActive = isActive || sunnahTicked > 0

            for (session, record) in history.sessions[day] ?? [:] {
                isActive = true
                recitations += record.recitations
                if record.completed {
                    sessions[session, default: 0] += 1
                    months[month - 1].sessions += 1
                }
            }
            let counts = TasbihStats.count(of: history.tasbih[day] ?? [])
            tasbih += counts
            isActive = isActive || counts > 0

            let read = quran.pages(on: day)
            pages += read
            months[month - 1].pages += read
            if read > 0 { quranDays += 1 }
            let finished = khatmahs[day]?.count ?? 0
            self.khatmahs += finished
            isActive = isActive || read > 0 || finished > 0

            if let fast = history.fasts[day] {
                isActive = true
                if fast.status == .fasted {
                    fasts[fast.kind, default: 0] += 1
                    months[month - 1].fasts += 1
                }
            }
            if let deeds = history.seasons[day], !deeds.isEmpty {
                isActive = true
                if deeds[.tarawih] != nil { tarawih += 1 }
                if deeds[.eidPrayer] != nil { eidPrayers += 1 }
            }
            if isActive { active += 1 }
        }
        daysSoFar = counted
        activeDays = active
    }
}

public extension TrackerHistory {
    /// Hijri years with anything recorded up to today, newest first; always includes `current`.
    func reviewYears(current: Int, today: DayKey, offset: Int) -> [Int] {
        var days = Set(prayers.keys)
        days.formUnion(sessions.keys)
        days.formUnion(tasbih.keys)
        days.formUnion(fasts.keys)
        days.formUnion(seasons.keys)
        days.formUnion(quran.map(\.day))
        var years = Set(days.filter { $0 <= today }.map { HijriCalendar.date(of: $0, offset: offset).year })
        years.insert(current)
        return years.sorted(by: >)
    }
}
