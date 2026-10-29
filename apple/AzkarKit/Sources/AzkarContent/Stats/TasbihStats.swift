import AzkarCore
import Foundation

/// One day of the tasbih counter.
public struct DatedTasbih: Hashable, Sendable {
    public var day: DayKey
    public var records: [TasbihRecord]
    /// Everything counted that day, presets and free count together.
    public var count: Int
}

/// Everything counted on the tasbih counter, ever.
public struct TasbihLifetime: Hashable, Sendable {
    /// Every count, presets and free count together.
    public var count: Int
    /// Counted freely, with no dhikr chosen.
    public var free: Int
    /// By preset, most counted first (`recitations` is the count).
    public var byPreset: [DhikrTotal]
    /// Days on which anything was counted.
    public var days: Int
}

/// Totals of the tasbih counter, as the web branch's `tasbihTracking.ts`. A count is filed as
/// the evening is: today, or yesterday until Fajr (`openDay(today:beforeDawn:)`).
public enum TasbihStats {
    /// The day a count made now is filed under (`tasbihDateKey` on the web branch).
    public static func openDay(today: DayKey, beforeDawn: Bool) -> DayKey {
        AzkarStats.openDay(of: .evening, today: today, beforeDawn: beforeDawn)
    }

    public static func count(of records: [TasbihRecord]) -> Int {
        records.reduce(0) { $0 + max(0, $1.count) }
    }

    /// Days from `from` to `to`, both included, with any record; oldest first.
    public static func days(in history: TasbihHistory, from: DayKey, to: DayKey) -> [DatedTasbih] {
        history.filter { $0.key >= from && $0.key <= to }
            .sorted { $0.key < $1.key }
            .map { DatedTasbih(day: $0.key, records: $0.value, count: count(of: $0.value)) }
    }

    /// Lifetime totals from the day records, which are kept for good.
    public static func lifetime(_ history: TasbihHistory, dataset: AzkarDataset = .bundled) -> TasbihLifetime {
        var byPreset: [String: Int] = [:]
        var free = 0
        for record in history.values.joined() {
            if record.preset == TasbihRecord.freeCount { free += max(0, record.count) } else { byPreset[record.preset, default: 0] += max(0, record.count) }
        }
        let presets = AzkarStats.dhikrTotals(byPreset, dataset: dataset)
        return TasbihLifetime(
            count: presets.reduce(free) { $0 + $1.recitations }, free: free, byPreset: presets,
            days: history.values.filter { count(of: $0) > 0 }.count
        )
    }

    /// Everything counted over the last `days` calendar days, today included.
    public static func count(_ history: TasbihHistory, today: DayKey, days: Int) -> Int {
        guard days > 0 else { return 0 }
        return Self.days(in: history, from: today.adding(days: -(days - 1)), to: today).reduce(0) { $0 + $1.count }
    }
}
