import AzkarCore
import Foundation
import SwiftData
import Testing
@testable import AzkarStore

/// Queries, the store on disk, its revision, and the main-actor model.
@Suite struct StorageTests {
    static let utc = TimeZone(identifier: "UTC")!
    let start = instant("2026-09-01T05:00:00Z")

    static func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory.appending(path: "AzkarStoreTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    @Test func queriesReturnTheDaysAndRangesAndTotals() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        try await store.logPrayer(.fajr, on: day("2026-08-30"), at: start)
        try await store.count(.increment, dhikr: "kursi", in: .evening, on: day("2026-08-31"), at: start)
        try await store.countTasbih(nil, on: day("2026-09-01"), at: start)
        try await store.setFast(.voluntary, .fasted, on: day("2026-08-28"), at: start)

        #expect(try await store.daysWithRecords() == [day("2026-08-28"), day("2026-08-30"), day("2026-08-31"), day("2026-09-01")])
        let range = try await store.days(from: day("2026-08-29"), to: day("2026-08-31"))
        #expect(range.map(\.day) == [day("2026-08-30"), day("2026-08-31")])
        #expect(range[0].prayer.prayers[.fajr]?.status == .ontime)
        #expect(range[1].sessions[.evening]?.recitations == 1)
        #expect(try await store.day(day("2026-08-29")).isEmpty)
        #expect(try await store.days(from: day("2026-09-01"), to: day("2026-08-01")).isEmpty)
        let totals = try await store.totals()
        #expect(totals.recitations == 1 && totals.dhikr == ["kursi": 1] && totals.tasbihFree == 1)
        let snapshot = try await store.snapshot()
        #expect(snapshot.days(from: day("2026-08-29"), to: day("2026-08-31")) == range)
    }

    @Test func everyChangeMovesTheRevisionByOneAndNothingElseDoes() async throws {
        let store = try makeStore()
        #expect(try await store.revision() == 0)
        #expect(try await store.logPrayer(.fajr, on: day("2026-09-01"), at: start).revision == 1)
        #expect(try await store.logPrayer(.fajr, on: day("2026-09-01"), at: start).revision == 1)
        #expect(try await store.clearPrayer(.fajr, on: day("2026-09-01")).revision == 2)
        try await store.replaceAll(with: RecordsSnapshot())
        #expect(try await store.revision() == 3, "a restore keeps counting")
    }

    @Test func recordsOnDiskSurviveReopening() async throws {
        let directory = Self.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
            try await store.setPrayer(.asr, .jamaah, on: day("2026-09-01"), at: start)
            try await store.count(.complete, dhikr: "quls", in: .morning, on: day("2026-09-01"), at: start)
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
        let records = try await reopened.day(day("2026-09-01"))
        #expect(records.prayer.prayers[.asr] == PrayerEntry(status: .jamaah, loggedAt: start))
        #expect(records.counts[.morning] == ["quls": 3])
        #expect(try await reopened.totals().recitations == 3)
    }

    @Test func aWriteFromAnotherProcessIsSeenAtTheNextRead() async throws {
        // Two containers on one file stand for the app and a widget's App Intent.
        let directory = Self.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let app = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
        let widget = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
        try await app.logPrayer(.fajr, on: day("2026-09-01"), at: start)
        _ = try await app.day(day("2026-09-01"))
        try await widget.setPrayer(.fajr, .jamaah, on: day("2026-09-01"), at: start)
        #expect(try await app.day(day("2026-09-01")).prayer.prayers[.fajr]?.status == .jamaah)
        #expect(try await app.revision() == 2)
    }

    @Test @MainActor func theModelReadsInAChangeSavedElsewhereWhenItsOwnChangeRevealsIt() async throws {
        let directory = Self.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let app = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
        let widget = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { Self.utc })
        let model = RecordsModel(store: app)
        await model.reload()
        #expect(model.isLoaded)
        try await widget.logPrayer(.dhuhr, on: day("2026-08-31"), at: start)
        // The app's next change finds the revision moved by two, so it reads everything again.
        try await model.setSunnah(.duha, done: true, on: day("2026-08-31"))
        #expect(model.records.day(day("2026-08-31")).prayer.prayers[.dhuhr]?.status == .ontime)
        #expect(model.records == (try await app.snapshot()))
    }

    @Test @MainActor func theModelShowsEachChangeAtOnce() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        let model = RecordsModel(store: store)
        await model.reload()
        #expect(try await model.logPrayer(.isha, on: day("2026-09-01")) == .changed)
        #expect(model.records.day(day("2026-09-01")).prayer.prayers[.isha]?.status == .ontime)
        #expect(try await model.countTasbih("subhanallah", on: day("2026-09-01")) == .changed)
        #expect(model.records.totals.tasbih == ["subhanallah": 1])
        #expect(try await model.setOwedFastsBefore(3) == .changed)
        #expect(model.records.owedFastsBefore == 3)
        #expect(model.records == (try await store.snapshot()))
    }

    @Test func rowsALaterVersionWroteAreSkippedNotLost() async throws {
        let store = try makeStore()
        let context = ModelContext(store.container)
        context.insert(PrayerRow(day: day("2026-09-01").number, prayer: "fajr", status: "prayed-at-home", loggedAt: nil))
        context.insert(PrayerRow(day: day("2026-09-01").number, prayer: "duha", status: "ontime", loggedAt: nil))
        try context.save()
        #expect(try await store.day(day("2026-09-01")).isEmpty)
        // Clearing a prayer whose status cannot be read still clears it.
        #expect(try await store.clearPrayer(.fajr, on: day("2026-09-01")).result == .changed)
        let left: [PrayerRow] = try ModelContext(store.container).fetch(FetchDescriptor())
        #expect(left.map(\.prayer) == ["duha"])
    }

    @Test func theSchemaHasAVersionAndAMigrationPlan() {
        #expect(AzkarSchemaV1.versionIdentifier == Schema.Version(1, 0, 0))
        #expect(AzkarMigrationPlan.schemas.count == 1)
        #expect(AzkarSchemaV1.models.count == 8)
    }

    @Test func dayKeysAreStoredAsSortableNumbers() {
        #expect(day("2026-09-01").number == 20_260_901)
        #expect(DayKey(number: 20_260_901) == day("2026-09-01"))
        #expect(DayKey(number: 20_260_231) == nil)
        #expect(day("2025-12-31").number < day("2026-01-01").number)
    }
}
