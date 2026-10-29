import AzkarCore
import Foundation

/// One day's sunnah prayers.
public struct SunnahDaySummary: Hashable, Sendable {
    /// Sunnah prayers done, of the eight.
    public var done: Int
    /// Sunnah prayers open to the user that day: the eight less the excused ones not done.
    public var due: Int
    /// Rawatib done, of the five.
    public var rawatib: Int
    /// Rak'ahs of the rawatib done, of twelve.
    public var rawatibRakahs: Int
    /// `complete` when all twelve rak'ahs of the rawatib are done (or excused).
    public var rawatibStanding: DayStanding
    public var witr: Bool
    public var witrStanding: DayStanding
}

/// The sunnah prayers' share over a window, and on how many of its days each one was done.
public struct SunnahCompletion: Hashable, Sendable {
    /// `done` is the sunnah prayers done, `due` those open to the user.
    public var rate: CompletionRate
    public var byPrayer: [SunnahPrayer: Int]
    /// Days measured: the window, starting at the first day anything was ticked when that is later.
    public var days: Int
}

extension SunnahPrayer {
    /// Rak'ahs of a prayer of the rawatib; `nil` for the others.
    public var rawatibRakahs: Int? {
        switch self {
        case .beforeFajr: 2
        case .beforeDhuhr: 4
        case .afterDhuhr, .afterMaghrib, .afterIsha: 2
        default: nil
        }
    }

    /// The obligatory prayers it goes with: excusing one of them excuses it.
    public var anchors: [Prayer] {
        switch self {
        case .beforeFajr: [.fajr]
        case .duha: [.fajr, .dhuhr]
        case .beforeDhuhr, .afterDhuhr: [.dhuhr]
        case .afterMaghrib: [.maghrib]
        case .afterIsha, .qiyam, .witr: [.isha]
        }
    }
}

/// Statistics over the ticked sunnah prayers, ported exactly from
/// `src/features/prayer-log/sunnahStats.ts`. A sunnah prayer is *excused* when an obligatory
/// prayer it goes with is excused that day; ticked all the same, it counts as done. Between
/// midnight and Fajr pass the day before as `today` (see `TrackerStats.statsDay`).
public enum SunnahStats {
    static func isDone(_ day: DayPrayerRecord?, _ sunnah: SunnahPrayer) -> Bool {
        day?.sunnah[sunnah] != nil
    }

    /// Whether a sunnah prayer was not asked of the user that day.
    public static func isExcused(_ sunnah: SunnahPrayer, on day: DayPrayerRecord?) -> Bool {
        sunnah.anchors.contains { day?.prayers[$0]?.status == .excused }
    }

    static func standing(_ day: DayPrayerRecord?, _ prayers: [SunnahPrayer]) -> DayStanding {
        var done = 0
        var excused = 0
        for sunnah in prayers {
            if isDone(day, sunnah) { done += 1 } else if isExcused(sunnah, on: day) { excused += 1 }
        }
        if done == 0, excused == prayers.count { return .exempt }
        if done > 0, done + excused == prayers.count { return .complete }
        return .incomplete
    }

    public static func summarize(_ day: DayPrayerRecord?) -> SunnahDaySummary {
        var done = 0
        var due = 0
        for sunnah in SunnahPrayer.allCases {
            if isDone(day, sunnah) {
                done += 1
                due += 1
            } else if !isExcused(sunnah, on: day) {
                due += 1
            }
        }
        let rawatibDone = SunnahPrayer.rawatib.filter { isDone(day, $0) }
        return SunnahDaySummary(
            done: done, due: due, rawatib: rawatibDone.count,
            rawatibRakahs: rawatibDone.reduce(0) { $0 + ($1.rawatibRakahs ?? 0) },
            rawatibStanding: standing(day, SunnahPrayer.rawatib),
            witr: isDone(day, .witr), witrStanding: standing(day, [.witr])
        )
    }

    /// The earliest day with a sunnah prayer ticked, ignoring the future.
    public static func firstSunnahDay(_ history: PrayerHistory, today: DayKey) -> DayKey? {
        history.filter { $0.key <= today && !$0.value.sunnah.isEmpty }.keys.min()
    }

    /// Share of the sunnah prayers done over the last `days` days, today included. Days before
    /// the first tick are left out; today can raise the rate but never lower it.
    public static func completion(_ history: PrayerHistory, today: DayKey, days: Int) -> SunnahCompletion {
        var byPrayer = Dictionary(uniqueKeysWithValues: SunnahPrayer.allCases.map { ($0, 0) })
        var done = 0
        var due = 0
        var measured = 0
        if let first = firstSunnahDay(history, today: today) {
            for key in eachDay(from: max(first, today.adding(days: -(days - 1))), through: today) {
                let day = history[key]
                let summary = summarize(day)
                done += summary.done
                due += key == today ? summary.done : summary.due
                measured += 1
                for sunnah in SunnahPrayer.allCases where isDone(day, sunnah) { byPrayer[sunnah]! += 1 }
            }
        }
        return SunnahCompletion(rate: CompletionRate(done: done, due: due), byPrayer: byPrayer, days: measured)
    }

    /// Days on which every one of `prayers` was done, counted like the obligatory streaks.
    public static func streaks(_ history: PrayerHistory, today: DayKey, prayers: [SunnahPrayer]) -> Streak {
        guard let first = firstSunnahDay(history, today: today), !prayers.isEmpty else { return .none }
        var days: Set<DayKey> = [today]
        for key in history.keys where key >= first && key <= today { days.insert(key) }
        var run = 0
        var best = 0
        var previous: DayKey?
        for key in days.sorted() {
            if let previous, previous.days(to: key) > 1 { run = 0 }
            previous = key
            switch standing(history[key], prayers) {
            case .complete:
                run += 1
                best = max(best, run)
            case .incomplete where key != today:
                run = 0
            default:
                break
            }
        }
        return Streak(current: run, best: best)
    }

    /// Days in a row with Witr prayed.
    public static func witrStreaks(_ history: PrayerHistory, today: DayKey) -> Streak {
        streaks(history, today: today, prayers: [.witr])
    }

    /// Days in a row with all twelve rak'ahs of the rawatib prayed.
    public static func rawatibStreaks(_ history: PrayerHistory, today: DayKey) -> Streak {
        streaks(history, today: today, prayers: SunnahPrayer.rawatib)
    }
}
