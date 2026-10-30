import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The tasbih counter (tasbihCounts.ts) and the fasting log (fasting/store.ts) of the website's
/// `wip/web-seven-features` branch.
@Suite struct TasbihAndFastingTests {
    let today = day("2026-09-01")
    let start = instant("2026-09-01T05:00:00Z")

    func store() throws -> RecordStore { try makeStore(catalog: AzkarRecordTests.catalog) }

    @Test func countingAPresetKeepsTheDaysCountAndTheLifetimeTotal() async throws {
        let store = try store()
        try await store.countTasbih("subhanallah", on: today, at: start)
        let second = try await store.countTasbih("subhanallah", on: today, at: start.addingTimeInterval(1))
        #expect(second.day.tasbih["subhanallah"] == TasbihCount(startedAt: start, lastAt: start.addingTimeInterval(1), count: 2, current: 2))
        #expect(second.totals.tasbih == ["subhanallah": 2])
        #expect(second.day.tasbihRecords == [TasbihRecord(preset: "subhanallah", count: 2, lastAt: start.addingTimeInterval(1))])
    }

    @Test func theFreeCountIsKeptApartFromThePresets() async throws {
        let store = try store()
        try await store.countTasbih(nil, on: today, at: start)
        let change = try await store.countTasbih("alhamdulillah", on: today, at: start)
        #expect(change.day.tasbih[TasbihRecord.freeCount]?.count == 1)
        #expect(change.totals.tasbihFree == 1)
        #expect(change.totals.tasbih == ["alhamdulillah": 1])
        #expect(change.totals.tasbihCount == 2)
    }

    @Test func countsFromTheWatchArriveTogether() async throws {
        let store = try store()
        try await store.countTasbih(nil, on: today, at: start)
        let change = try await store.countTasbih(nil, times: 33, on: today, at: start.addingTimeInterval(1))
        #expect(change.day.tasbih[TasbihRecord.freeCount]?.count == 34)
        #expect(change.day.tasbih[TasbihRecord.freeCount]?.current == 34)
        #expect(change.totals.tasbihFree == 34)
    }

    @Test func countsFromTheWatchOnANewCounterStartIt() async throws {
        let change = try await store().countTasbih(nil, times: 5, on: today, at: start)
        #expect(change.day.tasbih[TasbihRecord.freeCount] == TasbihCount(startedAt: start, lastAt: start, count: 5, current: 5))
    }

    @Test func countsFromTheWatchStopAtTheDaysLimit() async throws {
        let store = try store()
        try await store.countTasbih(nil, times: RecordLimits.maxSessionRecitations - 2, on: today, at: start)
        let change = try await store.countTasbih(nil, times: 10, on: today, at: start)
        #expect(change.day.tasbih[TasbihRecord.freeCount]?.count == RecordLimits.maxSessionRecitations)
        #expect(change.totals.tasbihFree == RecordLimits.maxSessionRecitations)
        #expect(try await store.countTasbih(nil, times: 1, on: today, at: start).result == .unchanged)
    }

    @Test func aPresetNotInTheListCountsNothing() async throws {
        let store = try store()
        #expect(try await store.countTasbih("not-a-preset", on: today, at: start).result == .unchanged)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func resetPutsTheCounterBackToZeroAndKeepsWhatWasCounted() async throws {
        let store = try store()
        for second in 0..<3 { try await store.countTasbih("subhanallah", on: today, at: start.addingTimeInterval(Double(second))) }
        let reset = try await store.resetTasbih("subhanallah", on: today)
        #expect(reset.day.tasbih["subhanallah"]?.count == 3)
        #expect(reset.day.tasbih["subhanallah"]?.current == 0)
        #expect(reset.totals.tasbih == ["subhanallah": 3])
        #expect(try await store.resetTasbih("subhanallah", on: today).result == .unchanged)
        // Nothing to take back once the counter shows 0.
        #expect(try await store.undoTasbih("subhanallah", on: today, at: start).result == .unchanged)
    }

    @Test func undoTakesTheLastCountBackFromTheDayAndTheTotal() async throws {
        let store = try store()
        try await store.countTasbih("subhanallah", on: today, at: start)
        try await store.countTasbih("subhanallah", on: today, at: start)
        let undone = try await store.undoTasbih("subhanallah", on: today, at: start.addingTimeInterval(5))
        #expect(undone.day.tasbih["subhanallah"] == TasbihCount(startedAt: start, lastAt: start.addingTimeInterval(5), count: 1, current: 1))
        #expect(undone.totals.tasbih == ["subhanallah": 1])
        let empty = try await store.undoTasbih("subhanallah", on: today, at: start)
        #expect(empty.day.tasbih.isEmpty)
        #expect(empty.totals == LifetimeTotals())
        #expect(try await store.undoTasbih(nil, on: today, at: start).result == .unchanged)
    }

    @Test func aFastIsLoggedWithItsTimeAndTheSameChoiceAgainKeepsIt() async throws {
        let store = try store()
        let logged = try await store.setFast(.voluntary, .fasted, on: today, at: start)
        #expect(logged.day.fast == FastRecord(kind: .voluntary, status: .fasted, loggedAt: start))
        #expect(try await store.setFast(.voluntary, .fasted, on: today, at: start.addingTimeInterval(9)).result == .unchanged)
        let changed = try await store.setFast(.ramadan, .excused, on: today, at: start.addingTimeInterval(9))
        #expect(changed.day.fast == FastRecord(kind: .ramadan, status: .excused, loggedAt: start.addingTimeInterval(9)))
        #expect(try await store.clearFast(on: today).day.fast == nil)
        #expect(try await store.clearFast(on: today).result == .unchanged)
    }

    @Test func aFastOnADayNotYetBegunIsRefused() async throws {
        let store = try store()
        #expect(try await store.setFast(.qada, .fasted, on: today.adding(days: 1), at: start).result == .refusedFutureDay)
    }

    @Test func theDaysOwedFromBeforeTheLogAreWholeAndCapped() async throws {
        let store = try store()
        #expect(try await store.setOwedFastsBefore(12, at: start).owedFastsBefore == 12)
        #expect(try await store.setOwedFastsBefore(12, at: start).result == .unchanged)
        #expect(try await store.setOwedFastsBefore(-4, at: start).owedFastsBefore == 0)
        #expect(try await store.setOwedFastsBefore(99_999, at: start).owedFastsBefore == RecordLimits.maxOwedFastsBefore)
        #expect(try await store.owedFastsBefore() == RecordLimits.maxOwedFastsBefore)
    }
}
