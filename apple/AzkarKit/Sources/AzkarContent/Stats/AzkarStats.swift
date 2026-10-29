import AzkarCore
import Foundation

/// Streaks of the two daily sessions.
public struct AzkarStreaks: Hashable, Sendable {
    public var morning: Streak
    public var evening: Streak
    /// Days on which both the morning and the evening session were completed.
    public var both: Streak
}

/// Completion of the two daily sessions over a window.
public struct AzkarCompletionRates: Hashable, Sendable {
    /// The morning and evening sessions together.
    public var all: CompletionRate
    public var morning: CompletionRate
    public var evening: CompletionRate
}

/// Lifetime repetitions of one dhikr.
public struct DhikrTotal: Hashable, Sendable {
    public var id: String
    /// Every session and day together.
    public var recitations: Int
    /// The opening words of the dhikr's Arabic text, or `nil` if the dataset no longer has it.
    public var snippet: String?
}

/// Everything read in the azkar reader, ever.
public struct AzkarLifetime: Hashable, Sendable {
    /// Completed records per session (morning, evening, bedtime and after each prayer).
    public var sessionsCompleted: [AzkarSession: Int]
    /// Every repetition ever counted.
    public var recitations: Int
    /// Most recited first; ties by id.
    public var byDhikr: [DhikrTotal]
}

/// One day's records, for lists of days.
public struct DatedSessions: Hashable, Sendable {
    public var day: DayKey
    public var sessions: [AzkarSession: SessionRecord]
}

/// Statistics over the azkar sessions, ported exactly from `src/features/azkar/tracking.ts`
/// (and the web branch's bedtime additions).
///
/// A session *day* is the date a session is filed under (`openDay(of:today:beforeDawn:)`). A session
/// is *open* while it can still be read for its day; an open session not completed yet is never
/// held against the user. Records dated after a session's open day are ignored.
public enum AzkarStats {
    /// The two sessions of every day, which the streaks and rates follow. Bedtime is apart.
    public static let dailySessions: [AzkarSession] = [.morning, .evening]

    static func isCompleted(_ history: SessionHistory, _ day: DayKey, _ session: AzkarSession) -> Bool {
        history[day]?[session]?.completed == true
    }

    /// Days from `from` to `to`, both included, that have at least one record; oldest first.
    public static func sessions(in history: SessionHistory, from: DayKey, to: DayKey) -> [DatedSessions] {
        history.filter { $0.key >= from && $0.key <= to }
            .sorted { $0.key < $1.key }
            .map { DatedSessions(day: $0.key, sessions: $0.value) }
    }

    /// Consecutive days on which every one of `sessions` was completed, counted back from the
    /// latest open day. A day neither breaks the run nor adds to it while each of its sessions not
    /// completed yet is still open.
    static func streak(_ history: SessionHistory, sessions: [AzkarSession], open: [AzkarSession: DayKey]) -> Streak {
        guard let latest = sessions.compactMap({ open[$0] }).max() else { return .none }
        let completedOn = { (key: DayKey, session: AzkarSession) in key <= open[session]! && isCompleted(history, key, session) }
        return streakFrom(
            candidates: history.keys, latest: latest,
            complete: { key in sessions.allSatisfy { completedOn(key, $0) } },
            undecided: { key in sessions.allSatisfy { completedOn(key, $0) || key >= open[$0]! } }
        )
    }

    /// The day a session is filed under right now. The night does not end at midnight: before
    /// Fajr (`beforeDawn`), evening and bedtime azkar belong to the evening before; the morning
    /// session follows the calendar day. As `sessionDateKey` on the website. The phase of the day
    /// matters to the statistics only as this, so they take `beforeDawn` rather than a phase.
    public static func openDay(of session: AzkarSession, today: DayKey, beforeDawn: Bool) -> DayKey {
        session != .morning && beforeDawn ? today.adding(days: -1) : today
    }

    static func openDays(_ sessions: [AzkarSession], today: DayKey, beforeDawn: Bool) -> [AzkarSession: DayKey] {
        Dictionary(uniqueKeysWithValues: sessions.map { ($0, openDay(of: $0, today: today, beforeDawn: beforeDawn)) })
    }

    /// Current and best streaks of the morning session, the evening session, and of both on the same day.
    public static func streaks(_ history: SessionHistory, today: DayKey, beforeDawn: Bool) -> AzkarStreaks {
        let open = openDays(dailySessions, today: today, beforeDawn: beforeDawn)
        return AzkarStreaks(
            morning: streak(history, sessions: [.morning], open: open),
            evening: streak(history, sessions: [.evening], open: open),
            both: streak(history, sessions: dailySessions, open: open)
        )
    }

    /// Consecutive days one session was completed: the bedtime session's nights, say, which many
    /// people read only some nights, so it is kept apart from the daily streaks.
    public static func streak(of session: AzkarSession, in history: SessionHistory, today: DayKey, beforeDawn: Bool) -> Streak {
        streak(history, sessions: [session], open: openDays([session], today: today, beforeDawn: beforeDawn))
    }

    /// Completion of `sessions` over the last `days` days, today included, counted from the first
    /// day with a record of `firstFrom`. A closed session not completed is due; an open one
    /// counts only once completed; sessions of days after their open day are not due yet.
    static func rates(
        _ history: SessionHistory, sessions: [AzkarSession], firstFrom: [AzkarSession],
        today: DayKey, beforeDawn: Bool, days: Int
    ) -> [AzkarSession: CompletionRate] {
        var tally = Dictionary(uniqueKeysWithValues: sessions.map { ($0, CompletionRate(done: 0, due: 0)) })
        let first = history.filter { day in firstFrom.contains { day.value[$0] != nil } }.keys.min()
        guard let first, days > 0 else { return tally }
        let open = openDays(sessions, today: today, beforeDawn: beforeDawn)
        for key in eachDay(from: max(first, today.adding(days: -(days - 1))), through: today) {
            for session in sessions {
                if isCompleted(history, key, session) {
                    if key > open[session]! { continue }
                    tally[session]!.done += 1
                    tally[session]!.due += 1
                } else if key < open[session]! {
                    tally[session]!.due += 1
                }
            }
        }
        return tally
    }

    /// Share of the morning and evening sessions completed over the last `days` calendar days,
    /// today included, from the first day with any morning or evening record.
    public static func completionRates(_ history: SessionHistory, today: DayKey, beforeDawn: Bool, days: Int) -> AzkarCompletionRates {
        let tally = rates(history, sessions: dailySessions, firstFrom: dailySessions, today: today, beforeDawn: beforeDawn, days: days)
        let morning = tally[.morning]!
        let evening = tally[.evening]!
        return AzkarCompletionRates(
            all: CompletionRate(done: morning.done + evening.done, due: morning.due + evening.due),
            morning: morning, evening: evening
        )
    }

    /// Share of the days one session was completed, from the first day it was read.
    public static func completionRate(of session: AzkarSession, in history: SessionHistory, today: DayKey, beforeDawn: Bool, days: Int) -> CompletionRate {
        rates(history, sessions: [session], firstFrom: [session], today: today, beforeDawn: beforeDawn, days: days)[session]!
    }

    /// A lifetime tally by dhikr id, most recited first; ties by id.
    public static func dhikrTotals(_ totals: [String: Int], dataset: AzkarDataset = .bundled) -> [DhikrTotal] {
        totals.filter { $0.value > 0 }
            .map { DhikrTotal(id: $0.key, recitations: $0.value, snippet: dataset.snippet(id: $0.key)) }
            .sorted { $0.recitations != $1.recitations ? $0.recitations > $1.recitations : $0.id < $1.id }
    }

    /// Completed sessions over every day kept, the lifetime repetitions, and the lifetime tally by
    /// dhikr (`totals` and `totalRecitations` are the store's never-pruned counters).
    public static func lifetime(
        _ history: SessionHistory, totals: [String: Int], totalRecitations: Int, dataset: AzkarDataset = .bundled
    ) -> AzkarLifetime {
        var completed = Dictionary(uniqueKeysWithValues: AzkarSession.all.map { ($0, 0) })
        for day in history.values {
            for (session, record) in day where record.completed { completed[session, default: 0] += 1 }
        }
        return AzkarLifetime(sessionsCompleted: completed, recitations: totalRecitations, byDhikr: dhikrTotals(totals, dataset: dataset))
    }
}
