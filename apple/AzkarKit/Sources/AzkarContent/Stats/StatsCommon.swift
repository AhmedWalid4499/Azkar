import AzkarCore
import Foundation

// The statistics are pure functions over record values, as on the website: no clock and no
// time zone. The caller says which calendar day is today (and, for the azkar, which part of
// the day), and records dated after the day they are measured to are ignored.

/// Every day's prayer record, keyed by calendar day.
public typealias PrayerHistory = [DayKey: DayPrayerRecord]

/// Every day's azkar sessions (morning, evening, bedtime and after each prayer).
public typealias SessionHistory = [DayKey: [AzkarSession: SessionRecord]]

/// Every day's tasbih counts, one record per preset (or the free count).
public typealias TasbihHistory = [DayKey: [TasbihRecord]]

/// A run of days (or fasts, or months) in a row.
public struct Streak: Hashable, Sendable {
    /// The run that reaches the present.
    public var current: Int
    /// The longest run ever, `current` included.
    public var best: Int

    public init(current: Int, best: Int) {
        self.current = current
        self.best = best
    }

    public static let none = Streak(current: 0, best: 0)
}

/// What was done of what was due over a window of days.
public struct CompletionRate: Hashable, Sendable {
    /// Prayed, done or completed.
    public var done: Int
    /// Required of the user in the window.
    public var due: Int

    public init(done: Int, due: Int) {
        self.done = done
        self.due = due
    }

    /// `done / due` between 0 and 1, or `nil` when nothing was due.
    public var rate: Double? { due > 0 ? Double(done) / Double(due) : nil }

    /// A whole percentage rounded down, so 100% is only shown when everything due was done.
    public var wholePercent: Int? { due > 0 ? (done * 100) / due : nil }
}

/// The run of `complete` days counted back from `latest`, and the longest run among the
/// `candidates` up to it. A day that is `undecided` neither breaks the current run nor adds to
/// it. Some day before `latest` must be neither (any day with no record is), or the count back
/// would not end. As `streakFrom` in the website's azkar tracking.
func streakFrom(
    candidates: some Sequence<DayKey>, latest: DayKey,
    complete: (DayKey) -> Bool, undecided: (DayKey) -> Bool
) -> Streak {
    var best = 0
    var run = 0
    var previous: DayKey?
    for key in candidates.filter({ $0 <= latest && complete($0) }).sorted() {
        run = previous.map { $0.days(to: key) == 1 } == true ? run + 1 : 1
        best = max(best, run)
        previous = key
    }
    var current = 0
    var key = latest
    while true {
        if complete(key) {
            current += 1
        } else if !undecided(key) {
            break
        }
        key = key.adding(days: -1)
    }
    return Streak(current: current, best: max(best, current))
}

/// The days from `from` to `to`, both included.
func eachDay(from: DayKey, through to: DayKey) -> [DayKey] {
    guard from <= to else { return [] }
    return (0...from.days(to: to)).map { from.adding(days: $0) }
}
