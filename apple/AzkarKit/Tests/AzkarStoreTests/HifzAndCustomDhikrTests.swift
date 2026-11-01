import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

@Suite struct HifzTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    @Test func aSurahOutsideTheMushafChangesNothing() async throws {
        let store = try makeStore()
        for sura in [0, 115] {
            #expect(try await store.logHifz(.memorised, sura: sura, on: today, at: start).result == .unchanged)
        }
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func theLogShowsOnItsDayAndAnUndoTakesItOut() async throws {
        let store = try makeStore()
        let change = try await store.logHifz(.memorised, sura: 112, on: today, at: start)
        #expect(change.day.hifz.map(\.sura) == [112])
        let id = try #require(change.day.hifz.first?.id)
        try await store.undoHifzEntry(id)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func eraseAndABackupTakeItAlong() async throws {
        let store = try makeStore()
        try await store.logHifz(.memorised, sura: 67, on: today, at: start)
        try await store.logHifz(.reviewed, sura: 67, on: today.adding(days: 1), at: start.addingTimeInterval(86_400))
        let records = try await store.snapshot()
        let data = Backup.export(records: records, settings: SettingsSnapshot(), at: start)
        let read = try Backup.read(data, catalog: Fixtures.catalog)
        #expect(read.snapshot.records.hifz == records.hifz)

        let other = try makeStore()
        try await other.replaceAll(with: read.snapshot.records)
        #expect(try await other.snapshot().hifz == records.hifz)
        // Merged twice, a line is still one line.
        try await other.merge(read.snapshot.records)
        #expect(try await other.snapshot().hifz.count == 2)
        try await other.replaceAll(with: RecordsSnapshot())
        #expect(try await other.snapshot().hifz.isEmpty)
    }

    @Test func aBackupWithoutTheLogWritesNoStoreAndUnreadableLinesAreSkipped() throws {
        let data = Backup.export(records: RecordsSnapshot(), settings: SettingsSnapshot(), at: start)
        #expect(!String(decoding: data, as: UTF8.self).contains("azkar:hifz"))
        let read = WebHifz.read(["entries": [
            ["id": "not-a-uuid", "sura": 1, "day": "2026-11-01", "at": 1, "kind": "memorised"],
            ["id": .string(UUID().uuidString), "sura": 115, "day": "2026-11-01", "at": 1, "kind": "memorised"],
            ["id": .string(UUID().uuidString), "sura": 2, "day": "2026-11-01", "at": 1, "kind": "memorised"],
        ]])
        #expect(read.map(\.sura) == [2])
    }
}

@Suite struct CustomDhikrTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")
    let dhikr = CustomDhikr(text: "اللهم صل على محمد")

    @Test func aCustomDhikrCountsLikeAPreset() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        try await store.countTasbih(dhikr.id, on: today, at: start)
        let change = try await store.countTasbih(dhikr.id, on: today, at: start)
        #expect(change.day.tasbih[dhikr.id]?.count == 2)
        #expect(change.totals.tasbih[dhikr.id] == 2)
    }

    @Test func somethingElseUnknownStillCountsNothing() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        #expect(try await store.countTasbih("customary", on: today, at: start).result == .unchanged)
    }

    @Test func itsCountsAndNameSurviveABackup() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        try await store.countTasbih(dhikr.id, on: today, at: start)
        var settings = SettingsSnapshot()
        settings.reader.customDhikr = [dhikr, CustomDhikr(text: "old", isHidden: true)]
        let data = Backup.export(records: try await store.snapshot(), settings: settings, at: start)
        let read = try Backup.read(data, catalog: AzkarRecordTests.catalog)
        #expect(read.snapshot.settings.reader.customDhikr == settings.reader.customDhikr)
        #expect(read.snapshot.records.tasbih[today]?[dhikr.id]?.count == 1)
        #expect(read.snapshot.records.totals.tasbih[dhikr.id] == 1)
    }

    @Test func mergingABackupBringsTheNamesOfItsCounts() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        try await store.countTasbih(dhikr.id, on: today, at: start)
        var settings = SettingsSnapshot()
        settings.reader.customDhikr = [dhikr]
        settings.reader.tasbihTarget = 100
        let data = Backup.export(records: try await store.snapshot(), settings: settings, at: start)
        let read = try Backup.read(data, catalog: AzkarRecordTests.catalog)

        let here = SettingsStore(defaults: UserDefaults(suiteName: "custom-merge-\(UUID().uuidString)")!, postsNotifications: false)
        var mine = here.load()
        mine.reader.tasbihTarget = 7
        here.save(mine, groups: [.reader])
        try await Backup.restore(read, into: try makeStore(catalog: AzkarRecordTests.catalog), settings: here, mode: .merge)
        #expect(here.load().reader.customDhikr == [dhikr])
        #expect(here.load().reader.tasbihTarget == 7)
    }

    @Test func noCustomDhikrWritesNoField() {
        #expect(ReaderSettings().web["customDhikr"] == nil)
    }

    @Test func textIsOneCleanLineWithinTheLimit() {
        #expect(CustomDhikr.cleaned("  a\nb  ") == "a b")
        #expect(CustomDhikr.cleaned("   \n ") == nil)
        #expect(CustomDhikr.cleaned(String(repeating: "x", count: 500))?.count == CustomDhikr.maxLength)
    }
}
