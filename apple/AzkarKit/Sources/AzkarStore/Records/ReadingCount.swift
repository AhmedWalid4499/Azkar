import AzkarCore
import Foundation

/// How one tap changes a dhikr's count in the reader.
public enum CountStep: Sendable, Hashable {
    /// One more repetition, up to the dhikr's count.
    case increment
    /// One repetition taken back.
    case decrement
    /// Straight to the dhikr's count ("mark as done").
    case complete

    func applied(to count: Int, target: Int) -> Int {
        switch self {
        case .increment: count + 1
        case .decrement: count - 1
        case .complete: target
        }
    }
}

/// The counting rules of the azkar reader, ported from the website's `applyCount`/`countedRecord`
/// (src/features/azkar/progressStore.ts; `countIn` in readingCounts.ts on the WIP branch, which
/// uses the same rules for the after-prayer azkar). Pure values in, values out, so the store
/// and the tests share one implementation.
enum ReadingCount {
    typealias Step = CountStep

    struct Outcome: Equatable {
        /// The session's counts that day after the change (empty: none left).
        var counts: [String: Int]
        /// The day's record, or `nil` when it has nothing left to tell.
        var record: SessionRecord?
        /// Repetitions added (positive) or taken back (negative). Never 0.
        var change: Int
    }

    /// `countOf`: the recorded count, never above the target (the dataset may have changed).
    static func count(of dhikr: DhikrTarget, in counts: [String: Int]) -> Int {
        guard let raw = counts[dhikr.id], raw > 0 else { return 0 }
        return min(raw, dhikr.target)
    }

    static func isDone(_ dhikr: DhikrTarget, in counts: [String: Int]) -> Bool {
        count(of: dhikr, in: counts) >= dhikr.target
    }

    /// `summarize(items, counts).done`.
    static func done(_ items: [DhikrTarget], _ counts: [String: Int]) -> Int {
        items.reduce(0) { $0 + (isDone($1, in: counts) ? 1 : 0) }
    }

    /// One count changed in the reading of `items`, or `nil` when the dhikr is not in it or its count stays.
    static func apply(_ step: Step, to dhikrID: String, items: [DhikrTarget], counts current: [String: Int], record previous: SessionRecord?, at: Date) -> Outcome? {
        guard let dhikr = items.first(where: { $0.id == dhikrID }) else { return nil }
        let before = count(of: dhikr, in: current)
        let after = min(dhikr.target, max(0, step.applied(to: before, target: dhikr.target)))
        guard after != before else { return nil }

        var counts = current
        counts[dhikrID] = after == 0 ? nil : after
        let change = after - before
        let wasComplete = items.allSatisfy { isDone($0, in: current) }
        let completed = items.allSatisfy { isDone($0, in: counts) }

        var record = previous ?? SessionRecord(startedAt: at, completed: false, done: 0, total: items.count, recitations: 0)
        record.lastAt = at
        record.done = done(items, counts)
        record.total = items.count
        record.recitations = min(RecordLimits.maxSessionRecitations, max(0, record.recitations + change))
        if completed != wasComplete {
            if !completed {
                record.completed = false
                record.completedAt = nil
            } else if !record.completed {
                record.completed = true
                record.completedAt = at
            }
        }
        let keep = record.completed || record.recitations != 0 || !counts.isEmpty
        return Outcome(counts: counts, record: keep ? record : nil, change: change)
    }

    /// `withTally`: a lifetime tally after `change` to one id, never below zero, `nil` when it does not move.
    static func tally(_ before: Int, change: Int) -> Int? {
        let after = min(RecordLimits.maxLifetimeRecitations, max(0, before + change))
        return after == before ? nil : after
    }
}
