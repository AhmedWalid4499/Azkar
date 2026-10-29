import AzkarCore
import Foundation
import SwiftData

/// The user's records on the device: every write goes through this actor.
///
/// Each call works in a fresh `ModelContext` and saves once, so a call either happens in full or
/// not at all, and nothing read can be stale when a widget's App Intent wrote to the same store
/// from another process. Values in, values out: rows never leave the actor.
///
/// The operations follow the website's stores (src/features/prayer-log/store.ts,
/// src/features/azkar/progressStore.ts and, for the after-prayer azkar, the tasbih counter and
/// fasting, its `wip/web-seven-features` branch): the same checks, the same bookkeeping, and the
/// same refusal of days that have not begun where the user is. Records of sessions, tasbih and
/// fasts are kept for good (the website prunes them after ten years); per-dhikr counts are kept
/// `RecordLimits.detailDays` days, as on the website, to resume a reading.
///
/// After every change it posts `StoreChange.records` so the app, its widgets and its other
/// models read again.
public actor RecordStore {
    public nonisolated let container: ModelContainer
    /// What each session holds, so a reading knows when it is complete.
    public nonisolated let catalog: any SessionCatalog
    /// The zone "today" is worked out in, read at each call (the saved place's zone, normally).
    private let timeZone: @Sendable () -> TimeZone
    private let postsNotifications: Bool

    /// - Parameters:
    ///   - timeZone: where "today" is, for refusing days that have not begun. The app passes the
    ///     saved place's zone (`SettingsStore.timeZone`).
    ///   - postsNotifications: whether changes are announced to other processes (off in tests).
    public init(container: ModelContainer, catalog: any SessionCatalog, timeZone: @escaping @Sendable () -> TimeZone = { .current }, postsNotifications: Bool = true) {
        self.container = container
        self.catalog = catalog
        self.timeZone = timeZone
        self.postsNotifications = postsNotifications
    }

    /// Opens the store at `location` (the App Group's, normally).
    public static func open(_ location: StoreLocation = .shared, catalog: any SessionCatalog, timeZone: @escaping @Sendable () -> TimeZone = { .current }) throws -> RecordStore {
        let opened = try StoreContainer.open(location)
        return RecordStore(container: opened.container, catalog: catalog, timeZone: timeZone, postsNotifications: location != .inMemory)
    }

    // MARK: Queries

    /// Everything recorded on one day.
    public func day(_ day: DayKey) throws -> DayRecords {
        try rows().day(day)
    }

    /// The days from `from` to `to` (both included) with any record, oldest first.
    public func days(from: DayKey, to: DayKey) throws -> [DayRecords] {
        guard from <= to else { return [] }
        return try rows().snapshot(days: from.number...to.number).days(from: from, to: to)
    }

    /// Every day with any record, oldest first.
    public func daysWithRecords() throws -> [DayKey] {
        try rows().snapshot().days
    }

    public func totals() throws -> LifetimeTotals {
        try rows().totals()
    }

    /// Days of Ramadan owed from before the fasting log began.
    public func owedFastsBefore() throws -> Int {
        try rows().value(TallyKind.counter, TallyKind.Counter.owedFastsBefore)
    }

    /// Everything, as plain values (what a backup carries).
    public func snapshot() throws -> RecordsSnapshot {
        try rows().snapshot()
    }

    /// Everything, with the revision it was read at, in one read.
    public func load() throws -> (records: RecordsSnapshot, revision: Int) {
        let rows = rows()
        return (try rows.snapshot(), try rows.revision())
    }

    /// The store's revision: it grows by one with every change saved, by any process. A model
    /// that showed revision `n` is up to date while this is still `n`.
    public func revision() throws -> Int {
        try rows().revision()
    }

    // MARK: Writing

    /// Runs `body` in a fresh context, saves, and describes the result for `day`.
    func change(_ day: DayKey, _ body: (RecordRows) throws -> (ChangeResult, [DayKey: Set<AzkarSession>])) throws -> RecordChange {
        let rows = rows()
        let (result, pruned) = try body(rows)
        if result == .changed { try commit(rows) }
        return RecordChange(
            result: result, day: try rows.day(day), totals: try rows.totals(),
            owedFastsBefore: try rows.value(TallyKind.counter, TallyKind.Counter.owedFastsBefore),
            prunedCounts: result == .changed ? pruned : [:], revision: try rows.revision()
        )
    }

    func rows() -> RecordRows {
        let context = ModelContext(container)
        context.autosaveEnabled = false
        return RecordRows(context: context)
    }

    /// Today where the user is, as the website's `currentDateKey`.
    func today(at now: Date) -> DayKey {
        DayKey(now, in: timeZone())
    }

    /// Saves what `rows` changed, as one change, with the next revision.
    func commit(_ rows: RecordRows) throws {
        try rows.setValue(TallyKind.counter, TallyKind.Counter.revision, try rows.revision() + 1)
        try rows.context.save()
        if postsNotifications { StoreNotifications.post(.records) }
    }
}
