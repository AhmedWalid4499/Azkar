import AzkarCore
import Foundation
import Observation

/// The records for SwiftUI: a main-actor copy of everything in `RecordStore`, kept current.
///
/// Screens read `records` (`records.day(today)`, `records.days(from:to:)`, `records.totals`)
/// and call the operations here, which go through the store and update `records` at once from
/// what the store returns. A change saved by another process (a widget's App Intent) arrives as
/// a `StoreChange.records` notification and is read in; call `run()` from the root view's
/// `.task` for that. Widgets and App Intents use `RecordStore` directly.
@MainActor
@Observable
public final class RecordsModel {
    public let store: RecordStore
    /// Everything recorded. Empty until the first load.
    public private(set) var records = RecordsSnapshot()
    public private(set) var isLoaded = false

    /// The store revision `records` shows.
    @ObservationIgnored private var revision = -1
    @ObservationIgnored private var loading = false
    @ObservationIgnored private var loadAgain = false

    public init(store: RecordStore) {
        self.store = store
    }

    /// Loads the records, then reads in every change other processes save, until the calling
    /// task is cancelled.
    public func run() async {
        await reload()
        for await _ in StoreNotifications.changes(.records) {
            // Our own changes come back too: read only when the store moved past what is shown.
            if let current = try? await store.revision(), current == revision { continue }
            await reload()
        }
    }

    /// Reads everything again. Calls made while a read is under way are folded into one more read.
    public func reload() async {
        if loading {
            loadAgain = true
            return
        }
        loading = true
        defer { loading = false }
        repeat {
            loadAgain = false
            guard let (snapshot, loaded) = try? await store.load() else { return }
            if loaded >= revision {
                records = snapshot
                revision = loaded
                isLoaded = true
            } else {
                // A change landed while this read ran: read once more.
                loadAgain = true
            }
        } while loadAgain
    }

    // MARK: Operations (see `RecordStore` for each one's rules)

    @discardableResult
    public func logPrayer(_ prayer: Prayer, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.logPrayer(prayer, on: day))
    }

    @discardableResult
    public func setPrayer(_ prayer: Prayer, _ status: PrayerStatus?, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.setPrayer(prayer, status, on: day))
    }

    @discardableResult
    public func setSunnah(_ sunnah: SunnahPrayer, done: Bool, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.setSunnah(sunnah, done: done, on: day))
    }

    @discardableResult
    public func count(_ step: CountStep, dhikr: String, in session: AzkarSession, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.count(step, dhikr: dhikr, in: session, on: day))
    }

    @discardableResult
    public func startOver(_ session: AzkarSession, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.startOver(session, on: day))
    }

    @discardableResult
    public func countTasbih(_ preset: String?, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.countTasbih(preset, on: day))
    }

    @discardableResult
    public func undoTasbih(_ preset: String?, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.undoTasbih(preset, on: day))
    }

    @discardableResult
    public func resetTasbih(_ preset: String?, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.resetTasbih(preset, on: day))
    }

    @discardableResult
    public func setFast(_ kind: FastKind, _ status: FastStatus, on day: DayKey) async throws -> ChangeResult {
        try await apply(store.setFast(kind, status, on: day))
    }

    @discardableResult
    public func clearFast(on day: DayKey) async throws -> ChangeResult {
        try await apply(store.clearFast(on: day))
    }

    @discardableResult
    public func setOwedFastsBefore(_ days: Int) async throws -> ChangeResult {
        try await apply(store.setOwedFastsBefore(days))
    }

    /// Shows a change the store made. Its revision tells whether anything else was saved in
    /// between (by another process): then everything is read again as well.
    private func apply(_ change: RecordChange) async -> ChangeResult {
        guard change.changed, change.revision > revision else { return change.result }
        records.apply(change)
        if change.revision == revision + 1 {
            revision = change.revision
        } else {
            await reload()
        }
        return change.result
    }
}
