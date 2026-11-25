import AzkarKit
import Foundation
import Observation

/// Counters kept with the tasbih counter's records under their own key, other than the tasbih
/// presets: the duas for occasions, the takbir, and the laps of tawaf and sa'i. Each tap is shown
/// at once and saved in order through `RecordsModel`, as `TasbihModel` does.
@MainActor
@Observable
final class KeyedCounter {
    private let records: RecordsModel
    /// Changes shown but not yet saved, by key.
    private var pending: [String: Int] = [:]
    @ObservationIgnored private var writes: Task<Void, Never>?
    /// Bumped on every count, for the light haptic.
    private(set) var ticks = 0

    init(records: RecordsModel) {
        self.records = records
    }

    private func saved(_ key: String, on day: DayKey) -> TasbihCount? { records.records.day(day).tasbih[key] }

    /// Counted under `key` on `day`, rounds before a reset included.
    func count(_ key: String, on day: DayKey) -> Int {
        max(0, (saved(key, on: day)?.count ?? 0) + (pending[key] ?? 0))
    }

    /// The current round under `key` (what a lap counter shows), until it is reset.
    func current(_ key: String, on day: DayKey) -> Int {
        max(0, (saved(key, on: day)?.current ?? 0) + (pending[key] ?? 0))
    }

    /// When `key` was last counted on `day`.
    func lastAt(_ key: String, on day: DayKey) -> Date? { saved(key, on: day)?.lastAt }

    /// Everything ever counted under `key`.
    func lifetime(_ key: String) -> Int {
        max(0, (records.records.totals.tasbih[key] ?? 0) + (pending[key] ?? 0))
    }

    func add(_ key: String, on day: DayKey) {
        ticks += 1
        write(key, change: 1) { records in try await records.countTasbih(key, on: day) }
    }

    func undo(_ key: String, on day: DayKey) {
        guard current(key, on: day) > 0 else { return }
        ticks += 1
        write(key, change: -1) { records in try await records.undoTasbih(key, on: day) }
    }

    /// Starts a new round at 0; what was counted stays counted.
    func reset(_ key: String, on day: DayKey) {
        write(key, change: 0) { records in try await records.resetTasbih(key, on: day) }
    }

    private func write(_ key: String, change: Int, _ operation: @escaping @MainActor (RecordsModel) async throws -> ChangeResult) {
        pending[key, default: 0] += change
        let previous = writes
        let records = records
        writes = Task { [weak self] in
            await previous?.value
            _ = try? await operation(records)
            guard let self else { return }
            let left = (pending[key] ?? 0) - change
            pending[key] = left == 0 ? nil : left
        }
    }
}
