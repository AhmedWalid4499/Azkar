import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// Counting in the reader: src/features/azkar/progressStore.ts, and readingCounts.ts of the
/// website's WIP branch for the azkar after the prayers.
@Suite struct AzkarRecordTests {
    static let catalog = StaticSessionCatalog(sessions: [
        .morning: [DhikrTarget(id: "kursi", target: 1), DhikrTarget(id: "quls", target: 3)],
        .evening: [DhikrTarget(id: "kursi", target: 1)],
        .afterPrayer(.fajr): [DhikrTarget(id: "quls", target: 3), DhikrTarget(id: "tasbih", target: 33)],
        .afterPrayer(.dhuhr): [DhikrTarget(id: "quls", target: 1)],
    ], tasbihPresets: ["subhanallah", "alhamdulillah"])

    let today = day("2026-09-01")
    let start = instant("2026-09-01T05:00:00Z")

    func store() throws -> RecordStore { try makeStore(catalog: Self.catalog) }

    func at(_ minutes: Int) -> Date { start.addingTimeInterval(Double(minutes) * 60) }

    @Test func theFirstCountStartsTheDaysRecord() async throws {
        let change = try await store().count(.increment, dhikr: "quls", in: .morning, on: today, at: start)
        #expect(change.day.sessions[.morning] == SessionRecord(startedAt: start, lastAt: start, completed: false, done: 0, total: 2, recitations: 1))
        #expect(change.day.counts[.morning] == ["quls": 1])
        #expect(change.totals.dhikr == ["quls": 1])
        #expect(change.totals.recitations == 1)
    }

    @Test func aCountStopsAtTheDhikrsCountAndAtZero() async throws {
        let store = try store()
        for minute in 0..<5 { try await store.count(.increment, dhikr: "quls", in: .morning, on: today, at: at(minute)) }
        let day = try await store.day(today)
        #expect(day.counts[.morning] == ["quls": 3])
        #expect(day.sessions[.morning]?.recitations == 3)
        #expect(try await store.count(.increment, dhikr: "quls", in: .morning, on: today, at: at(9)).result == .unchanged)
        #expect(try await store.count(.decrement, dhikr: "kursi", in: .morning, on: today, at: at(9)).result == .unchanged)
    }

    @Test func aDhikrTheSessionDoesNotHoldCountsNothing() async throws {
        let store = try store()
        #expect(try await store.count(.increment, dhikr: "unknown", in: .morning, on: today, at: start).result == .unchanged)
        #expect(try await store.count(.increment, dhikr: "anything", in: .sleep, on: today, at: start).result == .unchanged)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func theLastDhikrAtItsCountCompletesTheSessionAtThatMoment() async throws {
        let store = try store()
        try await store.count(.complete, dhikr: "quls", in: .morning, on: today, at: at(1))
        let done = try await store.count(.increment, dhikr: "kursi", in: .morning, on: today, at: at(2))
        let record = try #require(done.day.sessions[.morning])
        #expect(record.completed && record.completedAt == at(2) && record.done == 2 && record.recitations == 4)
    }

    @Test func takingACountBackFromACompleteSessionWithdrawsTheCompletion() async throws {
        let store = try store()
        try await store.count(.complete, dhikr: "quls", in: .morning, on: today, at: at(1))
        try await store.count(.complete, dhikr: "kursi", in: .morning, on: today, at: at(2))
        let undone = try await store.count(.decrement, dhikr: "quls", in: .morning, on: today, at: at(3))
        let record = try #require(undone.day.sessions[.morning])
        #expect(!record.completed && record.completedAt == nil && record.done == 1 && record.recitations == 3)
        let again = try await store.count(.increment, dhikr: "quls", in: .morning, on: today, at: at(4))
        #expect(again.day.sessions[.morning]?.completedAt == at(4))
    }

    @Test func startingOverKeepsTheCompletionAndTheRecitations() async throws {
        let store = try store()
        try await store.count(.complete, dhikr: "kursi", in: .evening, on: today, at: at(1))
        let reset = try await store.startOver(.evening, on: today)
        #expect(reset.result == .changed)
        #expect(reset.day.counts[.evening] == nil)
        #expect(reset.day.sessions[.evening] == SessionRecord(startedAt: at(1), lastAt: at(1), completedAt: at(1), completed: true, done: 0, total: 1, recitations: 1))
        #expect(try await store.startOver(.evening, on: today).result == .unchanged)
        // A second reading keeps the first completion while it is under way, and its time.
        let second = try await store.count(.complete, dhikr: "kursi", in: .evening, on: today, at: at(5))
        #expect(second.day.sessions[.evening]?.completedAt == at(1))
        #expect(second.day.sessions[.evening]?.recitations == 2)
    }

    @Test func aTapTakenStraightBackLeavesNoRecordAndNoTotal() async throws {
        let store = try store()
        try await store.count(.increment, dhikr: "kursi", in: .evening, on: today, at: at(1))
        let back = try await store.count(.decrement, dhikr: "kursi", in: .evening, on: today, at: at(2))
        #expect(back.day.isEmpty)
        #expect(back.totals == LifetimeTotals())
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func countsAreKeptThirtyDaysAfterTheDayCountedAndSessionRecordsForGood() async throws {
        let store = try store()
        let old = day("2026-08-01")
        try await store.count(.increment, dhikr: "quls", in: .morning, on: old, at: at(0))
        try await store.count(.increment, dhikr: "quls", in: .afterPrayer(.fajr), on: old, at: at(0))
        // 31 days later: the morning counts of 1 August go; the after-prayer ones stay until an after-prayer count.
        let change = try await store.count(.increment, dhikr: "kursi", in: .evening, on: day("2026-09-01"), at: at(1))
        #expect(change.prunedCounts == [old: [.morning]])
        var kept = try await store.day(old)
        #expect(kept.counts == [.afterPrayer(.fajr): ["quls": 1]])
        #expect(kept.sessions[.morning]?.recitations == 1)
        try await store.count(.increment, dhikr: "quls", in: .afterPrayer(.dhuhr), on: day("2026-08-31"), at: at(2))
        #expect(try await store.day(old).counts[.afterPrayer(.fajr)] != nil, "30 days later is still kept")
        try await store.count(.increment, dhikr: "quls", in: .afterPrayer(.dhuhr), on: day("2026-09-01"), at: at(3))
        kept = try await store.day(old)
        #expect(kept.counts.isEmpty)
        #expect(kept.sessions.count == 2)
        // Days after the day counted are never pruned.
        try await store.count(.increment, dhikr: "kursi", in: .evening, on: day("2026-12-01"), at: at(4))
        try await store.count(.increment, dhikr: "kursi", in: .evening, on: day("2026-09-02"), at: at(5))
        #expect(try await store.day(day("2026-12-01")).counts[.evening] == ["kursi": 1])
    }

    @Test func afterPrayerAzkarCountWithThatPrayersCountsAndTheirOwnTotals() async throws {
        let store = try store()
        for minute in 0..<3 { try await store.count(.increment, dhikr: "quls", in: .afterPrayer(.fajr), on: today, at: at(minute)) }
        let dhuhr = try await store.count(.increment, dhikr: "quls", in: .afterPrayer(.dhuhr), on: today, at: at(5))
        #expect(dhuhr.day.sessions[.afterPrayer(.dhuhr)]?.completed == true)
        #expect(dhuhr.day.sessions[.afterPrayer(.fajr)]?.completed == false)
        #expect(dhuhr.day.sessions[.afterPrayer(.fajr)]?.done == 1)
        #expect(dhuhr.totals.dhikr == ["quls": 4])
        #expect(dhuhr.totals.afterPrayer == ["quls": 4])
        #expect(dhuhr.totals.recitations == 4)
        try await store.count(.increment, dhikr: "quls", in: .morning, on: today, at: at(6))
        let totals = try await store.totals()
        #expect(totals.dhikr == ["quls": 5] && totals.afterPrayer == ["quls": 4] && totals.recitations == 5)
    }

    @Test func aCountOnAnyDayIsTakenAsTheWebsiteTakesIt() async throws {
        // The website refuses no day for azkar: a reading after midnight can be filed under yesterday.
        let change = try await store().count(.increment, dhikr: "kursi", in: .evening, on: day("2027-01-01"), at: start)
        #expect(change.result == .changed)
    }

    @Test func lifetimeTotalsAreKeptWhenCountsArePruned() async throws {
        let store = try store()
        try await store.count(.complete, dhikr: "quls", in: .morning, on: day("2026-01-01"), at: at(0))
        try await store.count(.increment, dhikr: "kursi", in: .morning, on: day("2026-06-01"), at: at(1))
        let totals = try await store.totals()
        #expect(totals.dhikr == ["quls": 3, "kursi": 1])
        #expect(totals.recitations == 4)
    }
}
