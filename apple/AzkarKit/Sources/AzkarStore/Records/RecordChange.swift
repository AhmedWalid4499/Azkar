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
    public var owedPrayersBefore: [Prayer: Int]
    public var duas: [DuaItem]
    public var quranBookmarks: [Int: Date]
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
        records.quran = quran.filter { $0.day == day }
        records.hifz = hifz.filter { $0.day == day }
        records.makeups = makeups.filter { $0.day == day }
        records.giving = giving.filter { $0.day == day }
        records.duaEntries = duaEntries.filter { $0.day == day }
        records.seasons = seasons[day] ?? [:]
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
        seasons[key] = records.seasons.isEmpty ? nil : records.seasons
        // Most changes are not about the Quran: the log is put in order again only when one is.
        if quran.filter({ $0.day == key }) != records.quran {
            quran = (quran.filter { $0.day != key } + records.quran).inLogOrder
        }
        if hifz.filter({ $0.day == key }) != records.hifz {
            hifz = (hifz.filter { $0.day != key } + records.hifz).sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
        }
        if makeups.filter({ $0.day == key }) != records.makeups {
            makeups = (makeups.filter { $0.day != key } + records.makeups).sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
        }
        if giving.filter({ $0.day == key }) != records.giving {
            giving = (giving.filter { $0.day != key } + records.giving).sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
        }
        if duaEntries.filter({ $0.day == key }) != records.duaEntries {
            duaEntries = (duaEntries.filter { $0.day != key } + records.duaEntries).sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
        }
    }

    /// The snapshot after `change`, as the store holds it.
    public mutating func apply(_ change: RecordChange) {
        set(change.day)
        totals = change.totals
        owedFastsBefore = change.owedFastsBefore
        owedPrayersBefore = change.owedPrayersBefore
        duas = change.duas
        quranBookmarks = change.quranBookmarks
        for (day, pruned) in change.prunedCounts {
            guard var kept = counts[day] else { continue }
            for session in pruned { kept[session] = nil }
            counts[day] = kept.isEmpty ? nil : kept
        }
    }
}
