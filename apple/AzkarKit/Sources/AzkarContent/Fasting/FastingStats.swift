import AzkarCore
import Foundation

/// Every day with a fast logged.
public typealias FastingHistory = [DayKey: FastRecord]

/// Days of Ramadan still to be made up.
public struct OwedFasts: Hashable, Sendable {
    /// Days of Ramadan, of any year, logged as not fasted: missed, excused or broken.
    public var fromRamadan: Int
    /// Days owed from before the log began, as the user entered them.
    public var before: Int
    /// Make-up fasts completed.
    public var madeUp: Int
    /// What is still to be made up. Never below zero.
    public var remaining: Int
}

/// The fasts of the Ramadan of the current Hijri year once it has begun, else last year's.
/// `RamadanSummary` is the whole of one Ramadan, any year.
public struct RamadanFasts: Hashable, Sendable {
    /// The Hijri year of this Ramadan.
    public var year: Int
    /// Its civil days, as the user's offset places them.
    public var days: [DayKey]
    /// The days of it that have begun: all of them once it is over.
    public var elapsed: Int
    /// Ramadan fasts of that year completed.
    public var fasted: Int
    /// Ramadan days of that year logged as not fasted.
    public var notFasted: Int
    /// Days that have begun with nothing logged.
    public var unlogged: Int
    /// Today is one of its days.
    public var ongoing: Bool
}

/// Voluntary fasts completed in today's Hijri month and year.
public struct VoluntaryFastCounts: Hashable, Sendable {
    public var month: Int
    public var year: Int
}

public struct FastingStatistics: Hashable, Sendable {
    public var owed: OwedFasts
    public var ramadan: RamadanFasts
    public var voluntary: VoluntaryFastCounts
    /// Mondays and Thursdays fasted one after the other, counted in fasts.
    public var mondayThursday: Streak
    /// Hijri months in a row whose white days were fasted, counted in months.
    public var whiteDays: Streak
}

/// Statistics over the fasting log, as `src/features/fasting/stats.ts` on the web branch.
public enum FastingStats {
    /// A day of Ramadan that was logged and not fasted to the end: it has to be made up.
    public static func isOwedRamadanDay(_ record: FastRecord?) -> Bool {
        record?.kind == .ramadan && record?.status != .fasted
    }

    /// A make-up fast that was completed.
    public static func isMadeUp(_ record: FastRecord?) -> Bool {
        record?.kind == .qada && record?.status == .fasted
    }

    /// Every logged Ramadan day not fasted, and the days the user owed before they started
    /// logging, less every make-up fast completed. Ramadan days with nothing logged are not
    /// counted: the app cannot know how they went.
    public static func owed(_ days: FastingHistory, owedBefore: Int = 0) -> OwedFasts {
        let fromRamadan = days.values.filter(isOwedRamadanDay).count
        let madeUp = days.values.filter(isMadeUp).count
        let before = max(0, owedBefore)
        return OwedFasts(fromRamadan: fromRamadan, before: before, madeUp: madeUp, remaining: max(0, fromRamadan + before - madeUp))
    }

    /// Fasts are counted by the Hijri year of their day, so a fast logged on the edge of the
    /// month before the user changed their offset still counts.
    public static func ramadan(_ days: FastingHistory, today: DayKey, offset: Int = 0) -> RamadanFasts {
        let now = HijriCalendar.date(of: today, offset: offset)
        let year = now.month >= HijriDate.ramadan ? now.year : now.year - 1
        let civil = HijriCalendar.civilDays(ofYear: year, month: HijriDate.ramadan, offset: offset)
        var fasted = 0
        var notFasted = 0
        for (key, record) in days where record.kind == .ramadan && HijriCalendar.date(of: key, offset: offset).year == year {
            if record.status == .fasted { fasted += 1 } else { notFasted += 1 }
        }
        let begun = civil.filter { $0 <= today }
        return RamadanFasts(
            year: year, days: civil, elapsed: begun.count, fasted: fasted, notFasted: notFasted,
            unlogged: begun.filter { days[$0] == nil }.count, ongoing: now.month == HijriDate.ramadan
        )
    }

    public static func voluntary(_ days: FastingHistory, today: DayKey, offset: Int = 0) -> VoluntaryFastCounts {
        let now = HijriCalendar.date(of: today, offset: offset)
        var counts = VoluntaryFastCounts(month: 0, year: 0)
        for (key, record) in days where record.kind == .voluntary && record.status == .fasted {
            let hijri = HijriCalendar.date(of: key, offset: offset)
            guard hijri.year == now.year else { continue }
            counts.year += 1
            if hijri.month == now.month { counts.month += 1 }
        }
        return counts
    }

    /// Voluntary fasts completed in the Shawwal (or any Hijri month) that `day` falls in, `day`
    /// itself left out. A fast filed on the Eid (the offset changed since, say) is not one of the six.
    public static func shawwalFasts(before day: DayKey, in days: FastingHistory, offset: Int = 0) -> Int {
        let hijri = HijriCalendar.date(of: day, offset: offset)
        return days.filter { key, record in
            guard key != day, record.kind == .voluntary, record.status == .fasted else { return false }
            let other = HijriCalendar.date(of: key, offset: offset)
            return other.year == hijri.year && other.month == hijri.month && FastingCalendar.forbiddenDay(other) == nil
        }.count
    }

    /// `skip` neither extends nor breaks a run: an excused day, or today while nothing is logged yet.
    private enum Outcome { case kept, broken, skip }

    private static func streak(_ outcomes: [Outcome]) -> Streak {
        var run = 0
        var best = 0
        for outcome in outcomes {
            switch outcome {
            case .kept:
                run += 1
                best = max(best, run)
            case .broken: run = 0
            case .skip: break
            }
        }
        return Streak(current: run, best: best)
    }

    private static func firstLoggedDay(_ days: FastingHistory, today: DayKey) -> DayKey? {
        days.keys.filter { $0 <= today }.min()
    }

    private static func outcome(_ record: FastRecord?, day: DayKey, today: DayKey) -> Outcome {
        if record?.status == .fasted { return .kept }
        if record?.status == .excused { return .skip }
        if record == nil, day == today { return .skip }
        return .broken
    }

    /// Mondays and Thursdays fasted one after the other, counted in fasts. Days of Ramadan and
    /// days fasting is not permitted are left out, an excused day neither breaks nor extends the
    /// run, and today counts once it is logged.
    public static func mondayThursdayStreak(_ days: FastingHistory, today: DayKey, offset: Int = 0) -> Streak {
        guard let first = firstLoggedDay(days, today: today) else { return Streak(current: 0, best: 0) }
        var outcomes: [Outcome] = []
        var key = first
        while key <= today {
            defer { key = key.adding(days: 1) }
            guard FastingCalendar.isMondayOrThursday(key) else { continue }
            let hijri = HijriCalendar.date(of: key, offset: offset)
            if hijri.month == HijriDate.ramadan || FastingCalendar.forbiddenDay(hijri) != nil { continue }
            outcomes.append(outcome(days[key], day: key, today: today))
        }
        return streak(outcomes)
    }

    /// Hijri months in a row whose white days (13 to 15) were fasted, counted in months. A month
    /// is kept when every white day that has come was fasted or excused and at least one was
    /// fasted. Ramadan and the 13th of Dhu al-Hijjah (a day of Tashriq) are left out.
    public static func whiteDaysStreak(_ days: FastingHistory, today: DayKey, offset: Int = 0) -> Streak {
        guard let first = firstLoggedDay(days, today: today) else { return Streak(current: 0, best: 0) }
        var months: [Outcome] = []
        var current: (year: Int, month: Int)?
        var month = Outcome.skip
        var key = first
        while key <= today {
            defer { key = key.adding(days: 1) }
            let hijri = HijriCalendar.date(of: key, offset: offset)
            guard FastingCalendar.isWhiteDay(hijri) else { continue }
            if current.map({ $0 != (hijri.year, hijri.month) }) ?? true {
                if current != nil { months.append(month) }
                current = (hijri.year, hijri.month)
                month = .skip
            }
            switch outcome(days[key], day: key, today: today) {
            case .broken: month = .broken
            case .kept where month == .skip: month = .kept
            default: break
            }
        }
        if current != nil { months.append(month) }
        return streak(months)
    }

    public static func statistics(_ days: FastingHistory, today: DayKey, offset: Int = 0, owedBefore: Int = 0) -> FastingStatistics {
        FastingStatistics(
            owed: owed(days, owedBefore: owedBefore),
            ramadan: ramadan(days, today: today, offset: offset),
            voluntary: voluntary(days, today: today, offset: offset),
            mondayThursday: mondayThursdayStreak(days, today: today, offset: offset),
            whiteDays: whiteDaysStreak(days, today: today, offset: offset)
        )
    }
}
