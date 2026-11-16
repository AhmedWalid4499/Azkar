import AzkarCore
import Foundation
import SwiftData
import Testing
@testable import AzkarStore

/// The hadith of the day read, and the hadith kept as favourites: no schema change, both kept
/// for good and carried by a backup.
@Suite struct HadithRecordTests {
    let today = day("2026-11-16")
    let start = instant("2026-11-16T09:00:00Z")

    @Test func readingIsNotedOncePerDayAndTheFirstStays() async throws {
        let store = try makeStore()
        try await store.logHadithRead(1268, on: today, at: start)
        #expect(try await store.day(today).hadithRead == 1268)
        let revision = try await store.revision()
        try await store.logHadithRead(5, on: today, at: start)
        #expect(try await store.day(today).hadithRead == 1268)
        #expect(try await store.revision() == revision)
        try await store.logHadithRead(5, on: today.adding(days: -1), at: start)
        #expect(try await store.snapshot().hadithRead == [today: 1268, today.adding(days: -1): 5])
        #expect(try await store.snapshot().days == [today.adding(days: -1), today])
        // Stored as a tally row of its own kind, which is no lifetime total.
        let rows = try ModelContext(store.container).fetch(FetchDescriptor<TallyRow>()).filter { $0.kind == TallyKind.hadithRead }
        #expect(rows.count == 2)
        #expect(try await store.totals() == LifetimeTotals())
    }

    @Test func aDayNotBegunOrNoHadithIsRefused() async throws {
        let store = try makeStore()
        try await store.logHadithRead(3, on: today.adding(days: 1), at: start)
        try await store.logHadithRead(0, on: today, at: start)
        #expect(try await store.snapshot().isEmpty)
    }

    @MainActor @Test func theModelShowsIt() async throws {
        let model = RecordsModel(store: try makeStore())
        await model.reload()
        try await model.logHadithRead(42, on: today)
        #expect(model.records.hadithRead[today] == 42)
        #expect(model.records.day(today).hadithRead == 42)
    }

    @Test func aBackupCarriesItAndOnlyWhenThereIsSome() async throws {
        let store = try makeStore()
        let empty = Backup.export(records: try await store.snapshot(), settings: SettingsSnapshot(), at: start)
        #expect(String(decoding: empty, as: UTF8.self).contains("azkar:hadith") == false)

        try await store.logHadithRead(1268, on: today, at: start)
        try await store.logHadithRead(7, on: today.adding(days: -3), at: start)
        let records = try await store.snapshot()
        var settings = SettingsSnapshot()
        settings.app.hadithFavourites = [3, 1268]
        let file = Backup.export(records: records, settings: settings, at: start)
        let read = try Backup.read(file, catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records.hadithRead == records.hadithRead)
        #expect(read.snapshot.settings.app.hadithFavourites == [3, 1268])

        // Restored, then merged over a store that already has a hadith that day: that one stays.
        let other = try makeStore()
        try await other.logHadithRead(99, on: today, at: start)
        try await Backup.restore(read, into: other, settings: makeSettings(), mode: .merge)
        #expect(try await other.snapshot().hadithRead == [today: 99, today.adding(days: -3): 7])
        let replaced = try makeStore()
        try await Backup.restore(read, into: replaced, settings: makeSettings(), mode: .replace)
        #expect(try await replaced.snapshot().hadithRead == records.hadithRead)
    }

    @Test func unreadableEntriesAreSkippedOneByOne() {
        let read = WebHadith.read([
            "read": [
                ["day": "2026-11-16", "number": 12],
                ["day": "2026-11-16", "number": 13],
                ["day": "not a day", "number": 1],
                ["day": "2026-11-15", "number": "4"],
                ["day": "2026-11-14", "number": 0],
                ["day": "2026-11-13", "number": 2.5],
                ["day": "2026-11-12", "number": 8],
            ],
        ])
        #expect(read == [day("2026-11-16"): 12, day("2026-11-12"): 8])
        #expect(WebHadith.read(nil).isEmpty)
    }

    @Test func favouritesAreKeptInOrderOnceAndOnlyWrittenWhenThere() {
        var settings = AppSettings()
        #expect(settings.web["hadithFavourites"] == nil)
        settings = settings.withHadithFavourite(1268, true).withHadithFavourite(3, true).withHadithFavourite(1268, true)
        #expect(settings.hadithFavourites == [3, 1268])
        #expect(settings.web["hadithFavourites"] == [3, 1268])
        #expect(AppSettings(web: settings.web).hadithFavourites == [3, 1268])
        settings = settings.withHadithFavourite(3, false)
        #expect(settings.hadithFavourites == [1268])
        #expect(AppSettings(web: ["hadithFavourites": [5, "6", -1, 2.5, 5, 1]]).hadithFavourites == [1, 5])
        #expect(AppSettings(web: ["hadithFavourites": "5"]).hadithFavourites.isEmpty)
    }

    @Test func favouritesSurviveTheSettingsStore() {
        let store = makeSettings()
        _ = store.update { $0.app = $0.app.withHadithFavourite(77, true) }
        #expect(store.load().app.hadithFavourites == [77])
    }
}
