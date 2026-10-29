import AzkarCore
import Foundation

/// How a day counts towards a streak.
public enum DayStanding: String, Sendable {
    /// Everything is accounted for, each one done or excused, and at least one was done.
    case complete
    /// Everything was excused, so the day is skipped over.
    case exempt
    /// Anything else: one missed, or one not logged.
    case incomplete
}

/// A tally of prayers by status.
public struct StatusCounts: Hashable, Sendable {
    public var ontime = 0
    public var jamaah = 0
    public var late = 0
    public var missed = 0
    public var excused = 0

    public init() {}

    public subscript(status: PrayerStatus) -> Int {
        get {
            switch status {
            case .ontime: ontime
            case .jamaah: jamaah
            case .late: late
            case .missed: missed
            case .excused: excused
            }
        }
        set {
            switch status {
            case .ontime: ontime = newValue
            case .jamaah: jamaah = newValue
            case .late: late = newValue
            case .missed: missed = newValue
            case .excused: excused = newValue
            }
        }
    }

    /// Every status together.
    public var total: Int { PrayerStatus.allCases.reduce(0) { $0 + self[$1] } }
}

/// One day of the obligatory prayers.
public struct DaySummary: Hashable, Sendable {
    public var counts: StatusCounts
    /// Prayers with any status at all.
    public var logged: Int
    /// Prayers logged as on time, in congregation or made up late.
    public var prayed: Int
    /// Prayers that were required of the user: five minus the excused ones.
    public var due: Int
    public var standing: DayStanding
}

/// Counts for one Gregorian month, per prayer and per status.
public struct MonthBreakdown: Hashable, Sendable {
    /// Days of the month that have begun, today included; zero for a future month.
    public var elapsedDays: Int
    /// Total logged prayers in the month.
    public var logged: Int
    public var byStatus: StatusCounts
    public var byPrayer: [Prayer: StatusCounts]
}

/// An obligatory prayer logged as missed.
public struct MissedPrayer: Hashable, Sendable {
    public var day: DayKey
    public var prayer: Prayer
}

/// Obligatory prayers still owed.
public struct OutstandingMissed: Hashable, Sendable {
    public var count: Int { prayers.count }
    /// The days they fall on, oldest first, each listed once.
    public var days: [DayKey]
    /// Each of them, oldest day first and in the order of the day.
    public var prayers: [MissedPrayer]
}

/// Statistics over the obligatory prayers, ported exactly from `src/features/prayer-log/stats.ts`.
///
/// A prayer is *prayed* when on time, in congregation or made up late; an *excused* prayer was
/// not required, so it is left out of every denominator; entries after today are ignored.
public enum PrayerStats {
    /// Tallies one day. An absent day is five unlogged prayers.
    public static func summarize(_ day: DayPrayerRecord?) -> DaySummary {
        var counts = StatusCounts()
        var logged = 0
        for prayer in Prayer.allCases {
            guard let status = day?.prayers[prayer]?.status else { continue }
            counts[status] += 1
            logged += 1
        }
        let prayed = counts.ontime + counts.jamaah + counts.late
        let total = Prayer.allCases.count
        let standing: DayStanding = counts.excused == total ? .exempt : prayed + counts.excused == total ? .complete : .incomplete
        return DaySummary(counts: counts, logged: logged, prayed: prayed, due: total - counts.excused, standing: standing)
    }

    /// Logged days up to and including today, oldest first.
    static func pastDays(_ history: PrayerHistory, today: DayKey) -> [DayKey] {
        history.keys.filter { $0 <= today && summarize(history[$0]).logged > 0 }.sorted()
    }

    /// The earliest day with anything logged, ignoring the future. `nil` for a new user.
    public static func firstLoggedDay(_ history: PrayerHistory, today: DayKey) -> DayKey? {
        history.keys.filter { $0 <= today && summarize(history[$0]).logged > 0 }.min()
    }

    /// Streaks in days. A complete day extends the run; an exempt day carries it without adding;
    /// an incomplete day, and any day with nothing logged, ends it; today is never held against
    /// the user while it is under way.
    public static func streaks(_ history: PrayerHistory, today: DayKey) -> Streak {
        var run = 0
        var best = 0
        var previous: DayKey?
        for key in pastDays(history, today: today) {
            if let previous, previous.days(to: key) > 1 { run = 0 }
            switch summarize(history[key]).standing {
            case .complete:
                run += 1
                best = max(best, run)
            case .incomplete where key != today:
                run = 0
            default:
                break
            }
            previous = key
        }
        let reachesToday = previous.map { $0.days(to: today) <= 1 } ?? false
        return Streak(current: reachesToday ? run : 0, best: best)
    }

    /// Share of required prayers prayed over the last `days` days, today included. Days before
    /// the first logged day are left out; from then on a past day's unlogged prayers count as
    /// due; today only counts what is logged so far.
    public static func completionRate(_ history: PrayerHistory, today: DayKey, days: Int) -> CompletionRate {
        guard let first = firstLoggedDay(history, today: today) else { return CompletionRate(done: 0, due: 0) }
        let windowStart = today.adding(days: -(days - 1))
        var prayed = 0
        var due = 0
        for key in eachDay(from: max(first, windowStart), through: today) {
            let summary = summarize(history[key])
            prayed += summary.prayed
            due += key == today ? summary.logged - summary.counts.excused : summary.due
        }
        return CompletionRate(done: prayed, due: due)
    }

    /// Days after today are skipped, so for the current month `elapsedDays` stops at today.
    public static func monthBreakdown(_ history: PrayerHistory, month: GregorianMonth, today: DayKey) -> MonthBreakdown {
        var byStatus = StatusCounts()
        var byPrayer = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0, StatusCounts()) })
        var elapsed = 0
        var logged = 0
        for key in month.days {
            if key > today { break }
            elapsed += 1
            guard let day = history[key] else { continue }
            for prayer in Prayer.allCases {
                guard let status = day.prayers[prayer]?.status else { continue }
                byPrayer[prayer]![status] += 1
                byStatus[status] += 1
                logged += 1
            }
        }
        return MonthBreakdown(elapsedDays: elapsed, logged: logged, byStatus: byStatus, byPrayer: byPrayer)
    }

    /// Every prayer whose status is `missed`, today included. One made up later is logged as
    /// `late`, which takes it off this list.
    public static func outstandingMissed(_ history: PrayerHistory, today: DayKey) -> OutstandingMissed {
        var days: [DayKey] = []
        var prayers: [MissedPrayer] = []
        for key in pastDays(history, today: today) {
            let missed = Prayer.allCases.filter { history[key]?.prayers[$0]?.status == .missed }
            guard !missed.isEmpty else { continue }
            days.append(key)
            prayers += missed.map { MissedPrayer(day: key, prayer: $0) }
        }
        return OutstandingMissed(days: days, prayers: prayers)
    }
}
