import AzkarCore
import Foundation

/// What one operation of `RecordStore` did, with what a screen needs to show its effect
/// without reading the store again.
public struct RecordChange: Hashable, Sendable {
    public var result: ChangeResult
    /// The day the operation was about, as it is now.
    public var day: DayRecords
    public var totals: LifetimeTotals
    public var owedFastsBefore: Int
    /// Per-dhikr counts deleted because they were more than `RecordLimits.detailDays` older than
    /// the day counted (as the website prunes them), by day.
    public var prunedCounts: [DayKey: Set<AzkarSession>]
    /// The store's revision after the operation (it grows by one with every change made through it).
    public var revision: Int

    public var changed: Bool { result == .changed }
}

extension RecordsSnapshot {
    /// Everything recorded on `day` (empty when nothing is).
    public func day(_ day: DayKey) -> DayRecords {
        var records = DayRecords(day: day)
        records.prayer = prayers[day] ?? DayPrayerRecord()
        records.sessions = sessions[day] ?? [:]
        records.counts = counts[day] ?? [:]
        records.tasbih = tasbih[day] ?? [:]
        records.fast = fasts[day]
        return records
    }

    /// The days from `from` to `to` (both included) that have any record, oldest first.
    public func days(from: DayKey, to: DayKey) -> [DayRecords] {
        days.filter { $0 >= from && $0 <= to }.map(day)
    }

    /// Files `records` under its day, replacing what was there; empty parts leave no entry.
    public mutating func set(_ records: DayRecords) {
        let key = records.day
        prayers[key] = records.prayer.isEmpty ? nil : records.prayer
        sessions[key] = records.sessions.isEmpty ? nil : records.sessions
        counts[key] = records.counts.isEmpty ? nil : records.counts
        tasbih[key] = records.tasbih.isEmpty ? nil : records.tasbih
        fasts[key] = records.fast
    }

    /// The snapshot after `change`, as the store holds it.
    public mutating func apply(_ change: RecordChange) {
        set(change.day)
        totals = change.totals
        owedFastsBefore = change.owedFastsBefore
        for (day, pruned) in change.prunedCounts {
            guard var kept = counts[day] else { continue }
            for session in pruned { kept[session] = nil }
            counts[day] = kept.isEmpty ? nil : kept
        }
    }
}
