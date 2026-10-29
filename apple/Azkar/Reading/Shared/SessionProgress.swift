import AzkarKit
import Foundation

/// The counting rules the reader shows, as the website's `session.ts`: a dhikr's target is its
/// repeat count (at least 1), its count never shows above the target, and the next dhikr to read
/// is the first unfinished one after the current, wrapping round to the start.
enum ReadingProgress {
    static func target(of dhikr: Dhikr) -> Int { max(1, dhikr.repeat) }

    static func count(of dhikr: Dhikr, in counts: [String: Int]) -> Int {
        min(max(0, counts[dhikr.id] ?? 0), target(of: dhikr))
    }

    static func isDone(_ dhikr: Dhikr, in counts: [String: Int]) -> Bool {
        count(of: dhikr, in: counts) >= target(of: dhikr)
    }

    /// Index of the first dhikr still short of its count, or `nil` when all are done.
    static func firstUnfinished(_ items: [Dhikr], _ counts: [String: Int]) -> Int? {
        items.firstIndex { !isDone($0, in: counts) }
    }

    /// The next unfinished dhikr after `index`, wrapping to the start so skipped ones are not
    /// forgotten; `nil` when every dhikr is done.
    static func nextUnfinished(_ items: [Dhikr], _ counts: [String: Int], after index: Int) -> Int? {
        guard !items.isEmpty else { return nil }
        for step in 1...items.count {
            let candidate = (index + step) % items.count
            if !isDone(items[candidate], in: counts) { return candidate }
        }
        return nil
    }
}

/// Where a session stands on a day, as the picker shows it. A completion recorded that day stays
/// on show after "Start over", while the counts begin again (`standingOf` on the website).
struct ReadingStanding: Equatable {
    enum Status: Equatable { case notStarted, inProgress, complete }

    var status: Status
    var done: Int
    var total: Int
    /// 0…1, with partial credit for a dhikr part-way through its repetitions.
    var fraction: Double
    var completedAt: Date?

    init(items: [Dhikr], counts: [String: Int], record: SessionRecord?) {
        total = items.count
        var done = 0
        var credit = 0.0
        var touched = false
        for dhikr in items {
            let count = ReadingProgress.count(of: dhikr, in: counts)
            if count > 0 { touched = true }
            credit += Double(count) / Double(ReadingProgress.target(of: dhikr))
            if count >= ReadingProgress.target(of: dhikr) { done += 1 }
        }
        let countsComplete = total > 0 && done == total
        if countsComplete || record?.completed == true {
            status = .complete
            self.done = total
            fraction = 1
            completedAt = record?.completedAt
        } else {
            status = touched ? .inProgress : .notStarted
            self.done = done
            fraction = total == 0 ? 0 : credit / Double(total)
            completedAt = nil
        }
    }
}
