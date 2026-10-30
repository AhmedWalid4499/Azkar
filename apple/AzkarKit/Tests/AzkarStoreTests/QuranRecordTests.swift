import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The Quran log and bookmarks in the store, and the model that shows them.
@Suite struct QuranRecordTests {
    let today = day("2026-09-01")
    let start = instant("2026-09-01T05:00:00Z")

    func minutes(_ count: Int) -> Date { start.addingTimeInterval(Double(count) * 60) }

    func progress(_ store: RecordStore) async throws -> QuranProgress {
        QuranProgress(entries: try await store.snapshot().quran)
    }

    @Test func aReadingStartsFromThePositionInTheLog() async throws {
        let store = try makeStore()
        let first = try await store.logQuranReading(toPage: 10, on: today, at: start)
        #expect(first.kind == .read && first.fromPage == 0 && first.toPage == 10 && first.pages == 10)
        #expect(first.day == today && first.at == start)
        let second = try await store.logQuranReading(toPage: 25, on: today, at: minutes(1))
        #expect(second.fromPage == 10 && second.pages == 15)
        #expect(try await store.snapshot().quran == [first, second])
        #expect(try await progress(store).position == 25)
    }

    @Test(arguments: [(-5, 1), (0, 1), (1, 1), (604, 604), (605, 604), (10_000, 604)])
    func pagesAreKeptToTheMushaf(asked: Int, kept: Int) async throws {
        let store = try makeStore()
        #expect(try await store.logQuranReading(toPage: asked, on: today, at: start).toPage == kept)
    }

    @Test func goingBackIsLoggedAsACorrection() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 50, on: today, at: start)
        let back = try await store.logQuranReading(toPage: 40, on: today, at: minutes(1))
        #expect(back.fromPage == 50 && back.toPage == 40 && back.pages == 0)
        let progress = try await progress(store)
        #expect(progress.position == 40 && progress.totalPages == 50)
        #expect(try await store.logQuranReading(toPage: 45, on: today, at: minutes(2)).fromPage == 40)
    }

    @Test func finishingStartsTheNextKhatmahFromTheBeginning() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 604, on: today, at: start)
        #expect(try await progress(store).khatmahs == 1)
        #expect(try await store.logQuranReading(toPage: 3, on: today, at: minutes(1)).fromPage == 0)
        let progress = try await progress(store)
        #expect(progress.position == 3 && progress.khatmahs == 1 && progress.totalPages == 607)
    }

    @Test func aKhatmahByHandKeepsThePosition() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 300, on: today, at: start)
        let khatmah = try await store.logKhatmah(on: today, at: minutes(1))
        #expect(khatmah.kind == .khatmah && khatmah.fromPage == 300 && khatmah.toPage == 0 && khatmah.pages == 0)
        #expect(try await store.logQuranReading(toPage: 301, on: today, at: minutes(2)).fromPage == 300)
        let progress = try await progress(store)
        #expect(progress.khatmahs == 1 && progress.position == 301 && progress.totalPages == 301)
    }

    @Test func undoRestoresThePreviousPosition() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 600, on: today, at: start)
        let finish = try await store.logQuranReading(toPage: 604, on: today, at: minutes(1))
        let next = try await store.logQuranReading(toPage: 5, on: today, at: minutes(2))
        try await store.undoQuranEntry(next.id)
        #expect(try await progress(store).position == 0)
        try await store.undoQuranEntry(finish.id)
        let progress = try await progress(store)
        #expect(progress.position == 600 && progress.khatmahs == 0 && progress.totalPages == 600)
        #expect(try await store.logQuranReading(toPage: 601, on: today, at: minutes(3)).fromPage == 600)
    }

    @Test func undoingAKhatmahByHandTakesOnlyTheKhatmah() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 20, on: today, at: start)
        let khatmah = try await store.logKhatmah(on: today, at: minutes(1))
        try await store.undoQuranEntry(khatmah.id)
        let progress = try await progress(store)
        #expect(progress.khatmahs == 0 && progress.position == 20)
    }

    @Test func undoingWhatIsNotInTheLogChangesNothing() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 20, on: today, at: start)
        let revision = try await store.revision()
        try await store.undoQuranEntry(UUID())
        #expect(try await store.revision() == revision)
        #expect(try await store.snapshot().quran.count == 1)
    }

    @Test func readingPastMidnightStaysOnTheDayPassed() async throws {
        let store = try makeStore()
        let entry = try await store.logQuranReading(toPage: 8, on: today, at: instant("2026-09-02T00:30:00Z"))
        #expect(entry.day == today)
        #expect(entry.at == instant("2026-09-02T00:30:00Z"))
        #expect(try await store.day(today).quran == [entry])
        #expect(try await store.day(today.adding(days: 1)).isEmpty)
        let progress = try await progress(store)
        #expect(progress.pages(on: today) == 8 && progress.pages(on: today.adding(days: 1)) == 0)
    }

    @Test func aClockPutBackCannotFileAReadingBeforeTheLastOne() async throws {
        let store = try makeStore()
        let first = try await store.logQuranReading(toPage: 30, on: today, at: minutes(10))
        let earlier = try await store.logQuranReading(toPage: 35, on: today, at: minutes(5))
        #expect(earlier.at == Date(epochMilliseconds: first.at.epochMilliseconds + 1))
        let same = try await store.logQuranReading(toPage: 36, on: today, at: minutes(10))
        #expect(same.fromPage == 35)
        #expect(try await store.snapshot().quran.map(\.id) == [first.id, earlier.id, same.id])
        #expect(try await progress(store).position == 36)
    }

    @Test func aBookmarkIsSetOnceAndCleared() async throws {
        let store = try makeStore()
        try await store.setQuranBookmark(page: 77, on: true, at: start)
        #expect(try await store.snapshot().quranBookmarks == [77: start])
        let revision = try await store.revision()
        // Already so: nothing changes, its time included.
        try await store.setQuranBookmark(page: 77, on: true, at: minutes(1))
        try await store.setQuranBookmark(page: 12, on: false, at: minutes(1))
        #expect(try await store.revision() == revision)
        #expect(try await store.snapshot().quranBookmarks == [77: start])
        try await store.setQuranBookmark(page: 77, on: false, at: minutes(2))
        #expect(try await store.snapshot().quranBookmarks.isEmpty)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test(arguments: [-1, 0, 605])
    func whatIsNotAPageCannotBeBookmarked(page: Int) async throws {
        let store = try makeStore()
        try await store.setQuranBookmark(page: page, on: true, at: start)
        #expect(try await store.snapshot().isEmpty)
        #expect(try await store.revision() == 0)
    }

    @Test func entriesAreRecordsOfTheirDay() async throws {
        let store = try makeStore()
        try await store.logPrayer(.fajr, on: day("2026-08-30"), at: start)
        let entry = try await store.logQuranReading(toPage: 5, on: day("2026-08-31"), at: start)
        let khatmah = try await store.logKhatmah(on: today, at: minutes(1))
        #expect(try await store.daysWithRecords() == [day("2026-08-30"), day("2026-08-31"), today])
        #expect(try await !store.day(day("2026-08-31")).isEmpty)
        let range = try await store.days(from: day("2026-08-31"), to: today)
        #expect(range.map(\.quran) == [[entry], [khatmah]])
        #expect(try await store.snapshot().days(from: day("2026-08-31"), to: today) == range)
        #expect(try await !store.snapshot().isEmpty)
    }

    @Test func aChangeOfAnotherDayLeavesTheLogAlone() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 5, on: today, at: start)
        let change = try await store.logPrayer(.fajr, on: today.adding(days: -1), at: start)
        var records = try await store.snapshot()
        let before = records
        records.apply(change)
        #expect(records == before)
    }

    @Test func everyChangeMovesTheRevisionByOne() async throws {
        let store = try makeStore()
        let entry = try await store.logQuranReading(toPage: 5, on: today, at: start)
        #expect(try await store.revision() == 1)
        try await store.logKhatmah(on: today, at: start)
        #expect(try await store.revision() == 2)
        try await store.undoQuranEntry(entry.id)
        #expect(try await store.revision() == 3)
        try await store.setQuranBookmark(page: 1, on: true, at: start)
        #expect(try await store.revision() == 4)
    }

    @Test func erasingEverythingTakesTheLogAndTheBookmarks() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 5, on: today, at: start)
        try await store.logKhatmah(on: today, at: minutes(1))
        try await store.setQuranBookmark(page: 9, on: true, at: start)
        try await store.replaceAll(with: RecordsSnapshot())
        #expect(try await store.snapshot().isEmpty)
        #expect(try await store.daysWithRecords().isEmpty)
        #expect(try await store.logQuranReading(toPage: 2, on: today, at: minutes(2)).fromPage == 0)
    }

    @Test func theLogSurvivesReopeningTheStore() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let entry: QuranEntry
        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
            entry = try await store.logQuranReading(toPage: 42, on: today, at: start.addingTimeInterval(0.123))
            try await store.setQuranBookmark(page: 42, on: true, at: start.addingTimeInterval(0.456))
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        #expect(try await reopened.snapshot().quran == [entry])
        #expect(try await reopened.snapshot().quranBookmarks == [42: start.addingTimeInterval(0.456).wholeMilliseconds])
    }

    @Test @MainActor func theModelShowsEachChangeAtOnce() async throws {
        let store = try makeStore()
        let model = RecordsModel(store: store)
        await model.reload()

        let entry = try await model.logQuranReading(toPage: 30, on: today, at: start)
        #expect(model.records.quran == [entry])
        #expect(entry.fromPage == 0)
        let khatmah = try await model.logKhatmah(on: today.adding(days: -1), at: minutes(1))
        #expect(model.records.quran == [entry, khatmah])
        #expect(model.records.day(today).quran == [entry])
        try await model.setQuranBookmark(page: 30, on: true, at: minutes(2))
        #expect(model.records.quranBookmarks == [30: minutes(2)])
        #expect(model.records == (try await store.snapshot()))

        try await model.undoQuranEntry(entry.id)
        #expect(model.records.quran == [khatmah])
        try await model.setQuranBookmark(page: 30, on: false, at: minutes(3))
        #expect(model.records.quranBookmarks.isEmpty)
        // Unrelated changes keep what the model shows of the Quran.
        try await model.logPrayer(.fajr, on: today)
        #expect(model.records == (try await store.snapshot()))
    }

    @Test @MainActor func theModelReadsInAnEntrySavedElsewhere() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let app = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let widget = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let model = RecordsModel(store: app)
        await model.reload()
        try await widget.logQuranReading(toPage: 10, on: today, at: start)
        // Its fromPage comes from the store, so the entry saved elsewhere counts.
        let entry = try await model.logQuranReading(toPage: 15, on: today, at: minutes(1))
        #expect(entry.fromPage == 10)
        #expect(model.records.quran.count == 2)
        #expect(model.records == (try await app.snapshot()))
    }
}

/// The Quran log in backup files.
@Suite struct QuranBackupTests {
    let today = day("2026-09-01")
    let start = instant("2026-09-01T05:00:00Z")

    /// Reading, a correction, a finished khatmah, one by hand and two bookmarks.
    func storeWithReading() async throws -> RecordStore {
        let store = try makeStore()
        try await store.logPrayer(.fajr, on: today, at: start)
        try await store.logQuranReading(toPage: 500, on: today.adding(days: -2), at: start.addingTimeInterval(1))
        try await store.logQuranReading(toPage: 490, on: today.adding(days: -2), at: start.addingTimeInterval(2))
        try await store.logQuranReading(toPage: 604, on: today.adding(days: -1), at: start.addingTimeInterval(3.25))
        try await store.logKhatmah(on: today, at: start.addingTimeInterval(4))
        try await store.logQuranReading(toPage: 3, on: today, at: start.addingTimeInterval(5))
        try await store.setQuranBookmark(page: 1, on: true, at: start)
        try await store.setQuranBookmark(page: 604, on: true, at: start.addingTimeInterval(6))
        return store
    }

    func file(_ quran: JSONValue) throws -> Data {
        try JSONEncoder().encode(["app": "azkar", "version": 1, "exportedAt": "2026-10-29T08:00:00.000Z", "data": ["azkar:quran": quran]] as JSONValue)
    }

    @Test func theLogAndTheBookmarksRoundTrip() async throws {
        let store = try await storeWithReading()
        let records = try await store.snapshot()
        let data = Backup.export(records: records, settings: SettingsSnapshot(), at: start)
        let read = try Backup.read(data, catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records == records)
        #expect(read.snapshot.found.contains("quran"))
        #expect(read.snapshot.ignored.isEmpty)

        let other = try makeStore()
        let report = try await Backup.restore(read, into: other, settings: makeSettings())
        #expect(try await other.snapshot() == records)
        #expect(report.quranEntries == 5)
        #expect(report.lastDay == today)
    }

    @Test func theFileHasOneMoreStoreUnderThePrefix() async throws {
        let store = try await storeWithReading()
        let data = Backup.export(records: try await store.snapshot(), settings: SettingsSnapshot(), at: start)
        let file = try JSONDecoder().decode(JSONValue.self, from: data)
        #expect(Backup.isBackupFile(file))
        #expect(Set(file["data"]!.object!.keys) == Set((WebStores.names + ["quran"]).map { "azkar:\($0)" }))
        let stored = try #require(file["data"]?["azkar:quran"])
        #expect(stored["version"] == 1)
        #expect(stored["state"]?["entries"]?.array?.count == 5)
        #expect(stored["state"]?["bookmarks"]?["604"] != nil)
        let first = try #require(stored["state"]?["entries"]?.array?.first)
        #expect(first["kind"] == "read" && first["fromPage"] == 0 && first["toPage"] == 500)
        #expect(first["day"] == "2026-08-30")
        #expect(first["at"] == .number(Double(start.addingTimeInterval(1).epochMilliseconds)))
    }

    @Test func aBookmarkAloneIsWorthKeeping() async throws {
        let store = try makeStore()
        try await store.setQuranBookmark(page: 2, on: true, at: start)
        let records = try await store.snapshot()
        let read = try Backup.read(Backup.export(records: records, settings: SettingsSnapshot(), at: start), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records.quranBookmarks == [2: start])
    }

    @Test func aBackupWithoutTheQuranReadsAsBefore() throws {
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(contents.snapshot.records.quran.isEmpty && contents.snapshot.records.quranBookmarks.isEmpty)
        #expect(!contents.snapshot.found.contains("quran"))
        #expect(contents.snapshot.ignored.isEmpty)
    }

    @Test func whatCannotBeReadIsSkippedOneByOne() throws {
        let good: JSONValue = ["id": "E621E1F8-C36C-495A-93FC-0C247A3E6E5F", "day": "2026-09-01", "at": 1_788_000_000_000, "kind": "read", "fromPage": 0, "toPage": 5]
        func with(_ field: String, _ value: JSONValue) -> JSONValue {
            var entry = good.object!
            entry[field] = value
            return .object(entry)
        }
        let state: JSONValue = [
            "entries": .array([
                good, good, // the same id twice
                with("id", "not-a-uuid"), with("day", "2026-02-31"), with("at", -1), with("kind", "listened"),
                with("fromPage", 604), with("fromPage", -1), with("toPage", 605), with("toPage", 0), with("toPage", 1.5),
            ]),
            "bookmarks": ["7": 1_788_000_000_000, "0": 1_788_000_000_000, "605": 1_788_000_000_000, "page": 1_788_000_000_000, "8": "soon"],
        ]
        let read = try Backup.read(try file(["state": state, "version": 1]), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records.quran.map(\.toPage) == [5])
        #expect(Array(read.snapshot.records.quranBookmarks.keys) == [7])
    }

    @Test func aLaterVersionsStoreIsReadForWhatItHolds() throws {
        let entry: JSONValue = ["id": "E621E1F8-C36C-495A-93FC-0C247A3E6E5F", "day": "2026-09-01", "at": 1_788_000_000_000, "kind": "khatmah", "fromPage": 12, "toPage": 0, "note": "a later field"]
        let read = try Backup.read(try file(["state": ["entries": [entry], "bookmarks": [:]], "version": 2]), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records.quran.map(\.kind) == [.khatmah])
    }

    @Test func replacingReplacesTheLogAndTheBookmarks() async throws {
        let source = try await storeWithReading()
        let records = try await source.snapshot()
        let contents = try Backup.read(Backup.export(records: records, settings: SettingsSnapshot(), at: start), catalog: Fixtures.catalog, deviceTimeZone: "UTC")

        let store = try makeStore()
        try await store.logQuranReading(toPage: 100, on: day("2020-01-01"), at: start)
        try await store.setQuranBookmark(page: 100, on: true, at: start)
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot() == records)
        // And the same again: the ids are unique, so the second time must not trip on the first.
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot() == records)
    }

    @Test func replacingWithABackupWithoutTheQuranLeavesNone() async throws {
        let store = try makeStore()
        try await store.logQuranReading(toPage: 100, on: today, at: start)
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot().quran.isEmpty)
    }

    @Test func mergingUnitesEntriesByIdAndBookmarksByPage() async throws {
        let shared = try makeStore()
        let both = try await shared.logQuranReading(toPage: 10, on: today, at: start)
        try await shared.setQuranBookmark(page: 5, on: true, at: start)
        let store = try makeStore()
        try await store.replaceAll(with: try await shared.snapshot())

        let only = try await store.logQuranReading(toPage: 20, on: today, at: start.addingTimeInterval(1))
        try await store.setQuranBookmark(page: 6, on: true, at: start)
        let there = try await shared.logKhatmah(on: today.adding(days: -1), at: start.addingTimeInterval(2))
        // The same page, bookmarked later over there: the one here stays.
        try await shared.setQuranBookmark(page: 5, on: false, at: start)
        try await shared.setQuranBookmark(page: 5, on: true, at: start.addingTimeInterval(3))
        try await shared.setQuranBookmark(page: 7, on: true, at: start.addingTimeInterval(4))

        let contents = try Backup.read(Backup.export(records: try await shared.snapshot(), settings: SettingsSnapshot(), at: start), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .merge)
        var records = try await store.snapshot()
        #expect(records.quran.map(\.id) == [both.id, only.id, there.id])
        #expect(records.quranBookmarks == [5: start, 6: start, 7: start.addingTimeInterval(4)])

        // Merging again adds nothing: every id and page is here now.
        let before = records.quran
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .merge)
        records = try await store.snapshot()
        #expect(records.quran == before)
    }

    @Test func mergingKeepsTheEntryAlreadyHere() async throws {
        let store = try makeStore()
        let here = try await store.logQuranReading(toPage: 10, on: today, at: start)
        var incoming = RecordsSnapshot()
        var changed = here
        changed.toPage = 99
        incoming.quran = [changed]
        try await store.merge(incoming)
        #expect(try await store.snapshot().quran == [here])
    }

    @Test func aReportFromBeforeTheQuranStillReads() async throws {
        let report = ImportReport(source: ImportReport.webApp, at: start, snapshot: WebSnapshot(), settings: [])
        var fields = try JSONSerialization.jsonObject(with: JSONEncoder().encode(report)) as! [String: Any]
        fields["quranEntries"] = nil
        let old = try JSONDecoder().decode(ImportReport.self, from: JSONSerialization.data(withJSONObject: fields))
        #expect(old.quranEntries == nil)
        #expect(old.source == ImportReport.webApp)
    }
}
