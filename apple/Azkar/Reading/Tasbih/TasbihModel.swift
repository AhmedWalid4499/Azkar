import AzkarKit
import Foundation
import Observation

/// The tasbih counter's taps, saved in order through `RecordsModel` and shown at once.
@MainActor
@Observable
final class TasbihModel {
    private let context: ReadingContext
    /// Count changes shown but not yet saved, by counter key (preset id or the free count).
    private var pending: [String: Int] = [:]
    @ObservationIgnored private var writes: Task<Void, Never>?
    /// Bumped for the light haptic of a count, and the success haptic of a reached target.
    private(set) var ticks = 0
    private(set) var reached = 0

    init(context: ReadingContext) {
        self.context = context
    }

    /// The preset the counter counts: the one last chosen, else the first; `nil` for the free count.
    var preset: Dhikr? {
        let presets = context.dataset.tasbihPresets
        let settings = context.reader
        guard !settings.tasbihFree else { return nil }
        return presets.first { $0.id == settings.tasbihPreset } ?? presets.first
    }

    private func key(_ preset: Dhikr?) -> String { preset?.id ?? TasbihRecord.freeCount }

    private func saved(on day: DayKey) -> TasbihCount? { context.day(day).tasbih[key(preset)] }

    /// What the counter shows now.
    func current(on day: DayKey) -> Int { max(0, (saved(on: day)?.current ?? 0) + (pending[key(preset)] ?? 0)) }

    /// Everything counted on it today, rounds before a reset included.
    func today(on day: DayKey) -> Int { max(0, (saved(on: day)?.count ?? 0) + (pending[key(preset)] ?? 0)) }

    /// Everything ever counted on it.
    var lifetime: Int {
        let totals = context.records.records.totals
        let saved = preset.map { totals.tasbih[$0.id] ?? 0 } ?? totals.tasbihFree
        return max(0, saved + (pending[key(preset)] ?? 0))
    }

    func count(on day: DayKey) {
        let after = current(on: day) + 1
        write(on: day, change: 1) { records, preset, day in try await records.countTasbih(preset, on: day) }
        if let target = context.reader.tasbihTarget, after % target == 0 {
            reached += 1
        } else {
            ticks += 1
        }
    }

    func undo(on day: DayKey) {
        guard current(on: day) > 0 else { return }
        write(on: day, change: -1) { records, preset, day in try await records.undoTasbih(preset, on: day) }
        ticks += 1
    }

    func reset(on day: DayKey) {
        write(on: day, change: 0) { records, preset, day in try await records.resetTasbih(preset, on: day) }
    }

    func choose(_ preset: Dhikr?) {
        context.updateReader { settings in
            if let preset {
                settings.tasbihFree = false
                settings.tasbihPreset = preset.id
            } else {
                settings.tasbihFree = true
            }
        }
    }

    func setTarget(_ target: Int?) {
        context.updateReader { $0.tasbihTarget = target }
    }

    private func write(on day: DayKey, change: Int, _ operation: @escaping @MainActor (RecordsModel, String?, DayKey) async throws -> ChangeResult) {
        let slot = key(preset)
        let presetID = preset?.id
        pending[slot, default: 0] += change
        let previous = writes
        let records = context.records
        writes = Task { [weak self] in
            await previous?.value
            _ = try? await operation(records, presetID, day)
            guard let self else { return }
            let left = (pending[slot] ?? 0) - change
            pending[slot] = left == 0 ? nil : left
        }
    }
}
