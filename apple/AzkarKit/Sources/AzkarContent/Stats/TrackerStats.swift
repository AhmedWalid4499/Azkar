import AzkarCore
import Foundation

/// Everything the tracker records, as plain values: the input of the tracker's statistics,
/// trends and export.
public struct TrackerHistory: Hashable, Sendable {
    public var prayers: PrayerHistory
    public var sessions: SessionHistory
    public var tasbih: TasbihHistory
    public var fasts: FastingHistory

    public init(prayers: PrayerHistory = [:], sessions: SessionHistory = [:], tasbih: TasbihHistory = [:], fasts: FastingHistory = [:]) {
        self.prayers = prayers
        self.sessions = sessions
        self.tasbih = tasbih
        self.fasts = fasts
    }
}

/// Every prayer ever logged up to today.
public struct LifetimePrayers: Hashable, Sendable {
    /// Obligatory prayers with any status.
    public var logged: Int
    /// Obligatory prayers logged as on time, in congregation or made up late.
    public var prayed: Int
    /// Sunnah prayers ticked off.
    public var sunnah: Int
}

/// One week of the trends.
public struct WeekTotals: Hashable, Sendable {
    /// The week's first day.
    public var start: DayKey
    /// Its days that have begun: 7, or fewer for the week under way.
    public var days: Int
    /// The week today falls in.
    public var current: Bool
    /// Obligatory prayers prayed: on time, in congregation or made up late.
    public var prayed: Int
    /// Sunnah prayers ticked off.
    public var sunnah: Int
    /// Morning and evening sessions completed.
    public var azkar: Int
    /// Bedtime sessions completed.
    public var sleep: Int
    /// After-prayer sessions completed, every prayer together.
    public var afterPrayer: Int
    /// Tasbih counts, presets and free count together.
    public var tasbih: Int
    /// Fasts kept to the end, of any kind.
    public var fasted: Int
}

/// Figures of the tracker page, ported from `src/features/prayer-log/trackerStats.ts` and
/// extended with the bedtime and after-prayer azkar, the tasbih and fasting.
public enum TrackerStats {
    /// The most a day can hold of each weekly figure that has a maximum.
    public enum DailyMaximum {
        public static let prayed = Prayer.allCases.count
        public static let sunnah = SunnahPrayer.allCases.count
        public static let azkar = AzkarStats.dailySessions.count
        public static let sleep = 1
        public static let afterPrayer = Prayer.allCases.count
    }

    /// The day the streaks and rates are counted up to: before Fajr, the night still belongs to
    /// the day before, so that day is measured as "today" until Fajr.
    public static func statsDay(today: DayKey, beforeDawn: Bool) -> DayKey {
        beforeDawn ? today.adding(days: -1) : today
    }

    /// Whether anything at all has been recorded up to today.
    public static func hasAnyRecord(_ history: TrackerHistory, today: DayKey) -> Bool {
        PrayerStats.firstLoggedDay(history.prayers, today: today) != nil
            || SunnahStats.firstSunnahDay(history.prayers, today: today) != nil
            || history.sessions.contains { $0.key <= today && !$0.value.isEmpty }
            || history.tasbih.contains { $0.key <= today && TasbihStats.count(of: $0.value) > 0 }
            || history.fasts.keys.contains { $0 <= today }
    }

    public static func lifetimePrayers(_ history: PrayerHistory, today: DayKey) -> LifetimePrayers {
        var result = LifetimePrayers(logged: 0, prayed: 0, sunnah: 0)
        for (key, day) in history where key <= today {
            let summary = PrayerStats.summarize(day)
            result.logged += summary.logged
            result.prayed += summary.prayed
            result.sunnah += day.sunnah.count
        }
        return result
    }

    /// The first day of the week `day` falls in, for weeks that begin on `weekStart`
    /// (1 = Sunday … 7 = Saturday, as `Calendar` and `DayKey.weekday` number them).
    public static func weekStart(of day: DayKey, weekStart: Int) -> DayKey {
        day.adding(days: -(((day.weekday - weekStart) % 7 + 7) % 7))
    }

    /// Totals for the last `weeks` weeks, oldest first, the last being the week under way.
    /// Weeks begin on `weekStart` (1 = Sunday … 7 = Saturday).
    public static func weeklyTotals(_ history: TrackerHistory, today: DayKey, weekStart: Int, weeks: Int) -> [WeekTotals] {
        let currentStart = self.weekStart(of: today, weekStart: weekStart)
        return stride(from: weeks - 1, through: 0, by: -1).map { back in
            let start = currentStart.adding(days: -7 * back)
            var week = WeekTotals(start: start, days: 0, current: back == 0, prayed: 0, sunnah: 0, azkar: 0, sleep: 0, afterPrayer: 0, tasbih: 0, fasted: 0)
            for offset in 0..<7 {
                let key = start.adding(days: offset)
                if key > today { break }
                week.days += 1
                week.prayed += PrayerStats.summarize(history.prayers[key]).prayed
                week.sunnah += history.prayers[key]?.sunnah.count ?? 0
                let sessions = history.sessions[key] ?? [:]
                week.azkar += AzkarStats.dailySessions.filter { sessions[$0]?.completed == true }.count
                week.sleep += sessions[.sleep]?.completed == true ? 1 : 0
                week.afterPrayer += Prayer.allCases.filter { sessions[.afterPrayer($0)]?.completed == true }.count
                week.tasbih += TasbihStats.count(of: history.tasbih[key] ?? [])
                week.fasted += history.fasts[key]?.status == .fasted ? 1 : 0
            }
            return week
        }
    }

    /// Every day with anything stored, oldest first. Days after today are kept: an export leaves
    /// nothing out.
    public static func recordedDays(_ history: TrackerHistory) -> [DayKey] {
        var days = Set(history.prayers.keys)
        days.formUnion(history.sessions.keys)
        days.formUnion(history.tasbih.keys)
        days.formUnion(history.fasts.keys)
        return days.sorted()
    }
}
