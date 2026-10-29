import AzkarCore
import Foundation

/// Streaks of the azkar after the prayers.
public struct AfterPrayerStreaks: Hashable, Sendable {
    /// Days on which the azkar after every counted prayer were completed.
    public var all: Streak
    public var byPrayer: [Prayer: Streak]
}

/// Completion of the azkar after the prayers over a window.
public struct AfterPrayerRates: Hashable, Sendable {
    /// Every counted prayer together.
    public var all: CompletionRate
    public var byPrayer: [Prayer: CompletionRate]
}

/// Everything read after the prayers, ever.
public struct AfterPrayerLifetime: Hashable, Sendable {
    /// Completed records per prayer.
    public var completed: [Prayer: Int]
    /// Completed records of every prayer together.
    public var completedAll: Int
    /// Repetitions counted after the prayers, from the day records.
    public var recitations: Int
}

/// Statistics over the after-prayer sessions (`AzkarSession.afterPrayer`), as the web branch's
/// `afterPrayerTracking.ts`. They are filed under the prayer's day, which stays open while it
/// is today, or yesterday until Fajr: a prayer of the open day not read after yet is never held
/// against the user. Which prayers count is the caller's to say, by default those the dataset
/// has azkar for: a prayer without any is never due.
public enum AfterPrayerStats {
    /// The day the azkar after any prayer are filed under right now: today, or yesterday until
    /// Fajr, since none of today's prayers has come yet (`afterPrayerDateKey` on the web branch).
    public static func openDay(today: DayKey, beforeDawn: Bool) -> DayKey {
        beforeDawn ? today.adding(days: -1) : today
    }

    static func counted(_ prayers: [Prayer]) -> [Prayer] {
        Prayer.allCases.filter(prayers.contains)
    }

    public static func streaks(
        _ history: SessionHistory, today: DayKey, beforeDawn: Bool,
        prayers: [Prayer] = AzkarDataset.bundled.availableAfterPrayers
    ) -> AfterPrayerStreaks {
        let counted = counted(prayers)
        let open = openDay(today: today, beforeDawn: beforeDawn)
        func streak(_ prayers: [Prayer]) -> Streak {
            guard !prayers.isEmpty else { return .none }
            return streakFrom(
                candidates: history.keys, latest: open,
                complete: { key in key <= open && prayers.allSatisfy { AzkarStats.isCompleted(history, key, .afterPrayer($0)) } },
                undecided: { $0 >= open }
            )
        }
        var byPrayer = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0, Streak.none) })
        for prayer in counted { byPrayer[prayer] = streak([prayer]) }
        return AfterPrayerStreaks(all: streak(counted), byPrayer: byPrayer)
    }

    /// Share of the prayers whose after-prayer azkar were completed over the last `days` days,
    /// today included, from the first day with any after-prayer record.
    public static func completionRates(
        _ history: SessionHistory, today: DayKey, beforeDawn: Bool, days: Int,
        prayers: [Prayer] = AzkarDataset.bundled.availableAfterPrayers
    ) -> AfterPrayerRates {
        let counted = counted(prayers)
        var tally = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0, CompletionRate(done: 0, due: 0)) })
        let first = history.filter { day in day.value.keys.contains { if case .afterPrayer = $0 { true } else { false } } }.keys.min()
        if let first, days > 0 {
            let open = openDay(today: today, beforeDawn: beforeDawn)
            for key in eachDay(from: max(first, today.adding(days: -(days - 1))), through: today) {
                for prayer in counted {
                    if AzkarStats.isCompleted(history, key, .afterPrayer(prayer)) {
                        if key > open { continue }
                        tally[prayer]!.done += 1
                        tally[prayer]!.due += 1
                    } else if key < open {
                        tally[prayer]!.due += 1
                    }
                }
            }
        }
        let done = counted.reduce(0) { $0 + tally[$1]!.done }
        let due = counted.reduce(0) { $0 + tally[$1]!.due }
        return AfterPrayerRates(all: CompletionRate(done: done, due: due), byPrayer: tally)
    }

    public static func lifetime(_ history: SessionHistory) -> AfterPrayerLifetime {
        var completed = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0, 0) })
        var recitations = 0
        for day in history.values {
            for prayer in Prayer.allCases {
                guard let record = day[.afterPrayer(prayer)] else { continue }
                if record.completed { completed[prayer]! += 1 }
                recitations += record.recitations
            }
        }
        return AfterPrayerLifetime(completed: completed, completedAll: completed.values.reduce(0, +), recitations: recitations)
    }
}
