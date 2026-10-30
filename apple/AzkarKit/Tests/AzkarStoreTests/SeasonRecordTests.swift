import AzkarCore
import Foundation
import SwiftData
import Testing
@testable import AzkarStore

/// The records of Ramadan and the Eids in the store, and the model that shows them.
@Suite struct SeasonRecordTests {
    let today = day("2027-02-10")
    let start = instant("2027-02-10T18:00:00Z")

    func minutes(_ count: Int) -> Date { start.addingTimeInterval(Double(count) * 60) }

    @Test func aRecordIsSetAndReadBack() async throws {
        let store = try makeStore()
        let at = start.addingTimeInterval(0.1234)
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 20, on: today, at: at)
        let record = SeasonRecord(deed: .tarawih, day: today, at: at.wholeMilliseconds, place: .masjid, rakahs: 20)
        #expect(try await store.snapshot().seasons == [today: [.tarawih: record]])
        #expect(try await store.day(today).seasons == [.tarawih: record])
    }

    @Test func placeAndRakahsAreOptional() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: today, at: start)
        #expect(try await store.day(today).seasons[.eidPrayer] == SeasonRecord(deed: .eidPrayer, day: today, at: start))
    }

    @Test func settingAgainUpdatesAndKeepsTheFirstTime() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 20, on: today, at: minutes(30))
        #expect(try await store.day(today).seasons[.tarawih] == SeasonRecord(deed: .tarawih, day: today, at: start, place: .masjid, rakahs: 20))
        // Each is set to what is given: nothing given is nothing kept.
        try await store.setSeasonRecord(.tarawih, place: nil, rakahs: nil, on: today, at: minutes(40))
        #expect(try await store.day(today).seasons[.tarawih] == SeasonRecord(deed: .tarawih, day: today, at: start))
        #expect(try ModelContext(store.container).fetchCount(FetchDescriptor<SeasonRow>()) == 1)
    }

    @Test func theSameValuesChangeNothing() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        let revision = try await store.revision()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: minutes(1))
        #expect(try await store.revision() == revision)
    }

    @Test func eachDeedHasItsOwnRecordOnADay() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: today, at: start)
        try await store.setSeasonRecord(.eidPrayer, place: .masjid, rakahs: nil, on: today, at: minutes(1))
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: nil, on: today.adding(days: -1), at: minutes(2))
        let seasons = try await store.snapshot().seasons
        #expect(seasons[today]?.count == 2 && seasons[today.adding(days: -1)]?.count == 1)
        #expect(seasons[today]?[.eidPrayer]?.place == .masjid)
    }

    @Test(arguments: [(Int?.none, Int?.none), (-1, nil), (0, nil), (1, 1), (36, 36), (100, 100), (101, nil), (10_000, nil)])
    func rakahsAreKeptToARealCount(asked: Int?, kept: Int?) async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: asked, on: today, at: start)
        #expect(try await store.day(today).seasons[.tarawih]?.rakahs == kept)
    }

    @Test func clearingTakesTheOneDeed() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        try await store.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: today, at: start)
        try await store.clearSeasonRecord(.tarawih, on: today)
        #expect(try await store.day(today).seasons.keys.sorted { $0.rawValue < $1.rawValue } == [.eidPrayer])
        try await store.clearSeasonRecord(.eidPrayer, on: today)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func clearingNothingChangesNothing() async throws {
        let store = try makeStore()
        try await store.clearSeasonRecord(.tarawih, on: today)
        #expect(try await store.revision() == 0)
    }

    @Test func aRecordSetAgainAfterClearingIsANewRecord() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        try await store.clearSeasonRecord(.tarawih, on: today)
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: minutes(5))
        #expect(try await store.day(today).seasons[.tarawih]?.at == minutes(5))
    }

    @Test func aDayNotBegunCanBeClearedNotLogged() async throws {
        let store = try makeStore()
        let tomorrow = today.adding(days: 1)
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: tomorrow, at: start)
        #expect(try await store.snapshot().isEmpty)
        #expect(try await store.revision() == 0)

        // A file can bring one in; it can then be taken off, not changed.
        var incoming = RecordsSnapshot()
        incoming.seasons = [tomorrow: [.tarawih: SeasonRecord(deed: .tarawih, day: tomorrow, at: start)]]
        try await store.merge(incoming)
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: nil, on: tomorrow, at: start)
        #expect(try await store.day(tomorrow).seasons[.tarawih]?.place == nil)
        try await store.clearSeasonRecord(.tarawih, on: tomorrow)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func aDayIsWhatTheUserIsOnNotTheDateOfTheClock() async throws {
        // 16:00 in UTC is already the next day in Tokyo.
        let late = instant("2027-02-10T16:00:00Z")
        let store = try makeStore(zone: "Asia/Tokyo")
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: day("2027-02-11"), at: late)
        #expect(try await store.day(day("2027-02-11")).seasons[.tarawih]?.at == late)
    }

    @Test func aTarawihPrayedPastMidnightStaysOnItsEvening() async throws {
        let store = try makeStore()
        let at = instant("2027-02-11T00:30:00Z")
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: today, at: at)
        #expect(try await store.day(today).seasons[.tarawih]?.at == at)
        #expect(try await store.day(today.adding(days: 1)).isEmpty)
    }

    @Test func recordsBelongToTheirDay() async throws {
        let store = try makeStore()
        try await store.logPrayer(.fajr, on: today.adding(days: -2), at: start)
        try await store.setSeasonRecord(.tarawih, place: nil, rakahs: nil, on: today, at: start)
        #expect(try await store.daysWithRecords() == [today.adding(days: -2), today])
        #expect(try await !store.day(today).isEmpty)
        #expect(try await store.days(from: today, to: today).map(\.day) == [today])
        #expect(try await store.snapshot().days(from: today, to: today).first?.seasons[.tarawih] != nil)
        #expect(try await !store.snapshot().isEmpty)
    }

    @Test func aChangeOfAnotherDayLeavesTheRecordsAlone() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        let change = try await store.logPrayer(.fajr, on: today.adding(days: -1), at: start)
        var records = try await store.snapshot()
        let before = records
        records.apply(change)
        #expect(records == before)
    }

    @Test func everyChangeMovesTheRevisionByOne() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        #expect(try await store.revision() == 1)
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 8, on: today, at: start)
        #expect(try await store.revision() == 2)
        try await store.clearSeasonRecord(.tarawih, on: today)
        #expect(try await store.revision() == 3)
    }

    @Test func erasingEverythingTakesThemToo() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        try await store.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: today, at: start)
        try await store.replaceAll(with: RecordsSnapshot())
        #expect(try await store.snapshot().isEmpty)
        #expect(try await store.daysWithRecords().isEmpty)
        #expect(try ModelContext(store.container).fetchCount(FetchDescriptor<SeasonRow>()) == 0)
        // The unique key is free again.
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: nil, on: today, at: minutes(1))
        #expect(try await store.day(today).seasons[.tarawih]?.at == minutes(1))
    }

    @Test func whatALaterVersionWroteIsSkippedNotDeleted() async throws {
        let store = try makeStore()
        let context = ModelContext(store.container)
        context.insert(SeasonRow(day: today.number, deed: "itikaf", at: start, place: nil, rakahs: nil))
        context.insert(SeasonRow(day: today.number, deed: "tarawih", at: start, place: "tent", rakahs: nil))
        try context.save()
        #expect(try await store.snapshot().seasons.isEmpty)
        #expect(try ModelContext(store.container).fetchCount(FetchDescriptor<SeasonRow>()) == 2)
    }

    @Test func recordsSurviveReopeningTheStore() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let at = start.addingTimeInterval(0.123)
        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
            try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 20, on: today, at: at)
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        #expect(try await reopened.day(today).seasons[.tarawih] == SeasonRecord(deed: .tarawih, day: today, at: at.wholeMilliseconds, place: .masjid, rakahs: 20))
    }

    @Test @MainActor func theModelShowsEachChangeAtOnce() async throws {
        let store = try makeStore()
        let model = RecordsModel(store: store)
        await model.reload()

        try await model.setSeasonRecord(.tarawih, place: .home, rakahs: 150, on: today, at: start)
        let record = SeasonRecord(deed: .tarawih, day: today, at: start, place: .home)
        #expect(model.records.seasons == [today: [.tarawih: record]])
        #expect(model.records.day(today).seasons == [.tarawih: record])

        try await model.setSeasonRecord(.tarawih, place: .masjid, rakahs: 8, on: today, at: minutes(1))
        #expect(model.records.seasons[today]?[.tarawih] == SeasonRecord(deed: .tarawih, day: today, at: start, place: .masjid, rakahs: 8))
        #expect(model.records == (try await store.snapshot()))

        // Unrelated changes keep what the model shows of the season.
        try await model.logPrayer(.fajr, on: today)
        #expect(model.records == (try await store.snapshot()))

        try await model.clearSeasonRecord(.tarawih, on: today)
        #expect(model.records.seasons.isEmpty)
        #expect(model.records == (try await store.snapshot()))
    }

    @Test @MainActor func theModelDoesNotShowWhatWasRefused() async throws {
        let store = try makeStore()
        let model = RecordsModel(store: store)
        await model.reload()
        try await model.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: today.adding(days: 1), at: start)
        #expect(model.records.seasons.isEmpty)
    }

    @Test @MainActor func theModelReadsInARecordSavedElsewhere() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let app = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let widget = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let model = RecordsModel(store: app)
        await model.reload()
        try await widget.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: today, at: start)
        try await model.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: today, at: minutes(1))
        #expect(model.records.seasons[today]?.count == 2)
        #expect(model.records == (try await app.snapshot()))
    }
}

/// The season records in backup files.
@Suite struct SeasonBackupTests {
    let today = day("2027-02-10")
    let start = instant("2027-02-10T18:00:00Z")

    /// Tarawih on two evenings, one with neither place nor rakahs, and an Eid prayer.
    func storeWithRecords() async throws -> RecordStore {
        let store = try makeStore()
        try await store.logPrayer(.fajr, on: today, at: start)
        try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 20, on: today.adding(days: -1), at: start.addingTimeInterval(1.25))
        try await store.setSeasonRecord(.tarawih, place: nil, rakahs: nil, on: today, at: start.addingTimeInterval(2))
        try await store.setSeasonRecord(.eidPrayer, place: .home, rakahs: nil, on: today, at: start.addingTimeInterval(3))
        return store
    }

    func file(_ seasons: JSONValue) throws -> Data {
        try JSONEncoder().encode(["app": "azkar", "version": 1, "exportedAt": "2027-02-11T08:00:00.000Z", "data": ["azkar:seasons": seasons]] as JSONValue)
    }

    func exported(_ records: RecordsSnapshot) throws -> Backup.Contents {
        try Backup.read(Backup.export(records: records, settings: SettingsSnapshot(), at: start), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
    }

    @Test func theRecordsRoundTrip() async throws {
        let store = try await storeWithRecords()
        let records = try await store.snapshot()
        let read = try exported(records)
        #expect(read.snapshot.records == records)
        #expect(read.snapshot.found.contains("seasons"))
        #expect(read.snapshot.ignored.isEmpty)

        let other = try makeStore()
        let report = try await Backup.restore(read, into: other, settings: makeSettings())
        #expect(try await other.snapshot() == records)
        #expect(report.seasonRecords == 3)
        #expect(report.firstDay == today.adding(days: -1), "a day with only a season record still counts")
    }

    @Test func theFileHasOneMoreStoreUnderThePrefix() async throws {
        let store = try await storeWithRecords()
        let data = Backup.export(records: try await store.snapshot(), settings: SettingsSnapshot(), at: start)
        let file = try JSONDecoder().decode(JSONValue.self, from: data)
        #expect(Backup.isBackupFile(file))
        #expect(Set(file["data"]!.object!.keys) == Set((WebStores.names + ["seasons"]).map { "azkar:\($0)" }))
        let stored = try #require(file["data"]?["azkar:seasons"])
        #expect(stored["version"] == 1)
        let records = try #require(stored["state"]?["records"]?.array)
        #expect(records.count == 3)
        #expect(records[0] == [
            "deed": "tarawih", "day": "2027-02-09", "place": "masjid", "rakahs": 20,
            "at": .number(Double(start.addingTimeInterval(1.25).epochMilliseconds)),
        ])
        // What was not given is left out.
        #expect(records[1]["deed"] == "eidPrayer" && records[1]["place"] == "home" && records[1]["rakahs"] == nil)
        #expect(records[2]["deed"] == "tarawih" && records[2]["place"] == nil && records[2]["rakahs"] == nil)
    }

    @Test func nothingToKeepWritesNoStore() throws {
        let data = Backup.export(records: RecordsSnapshot(), settings: SettingsSnapshot(), at: start)
        let file = try JSONDecoder().decode(JSONValue.self, from: data)
        #expect(Set(file["data"]!.object!.keys) == Set(WebStores.names.map { "azkar:\($0)" }))

        var empty = RecordsSnapshot()
        empty.seasons = [today: [:]]
        let again = try JSONDecoder().decode(JSONValue.self, from: Backup.export(records: empty, settings: SettingsSnapshot(), at: start))
        #expect(again["data"]?["azkar:seasons"] == nil)
    }

    @Test func aBackupWithoutTheSeasonsReadsAsBefore() throws {
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(contents.snapshot.records.seasons.isEmpty)
        #expect(!contents.snapshot.found.contains("seasons"))
        #expect(contents.snapshot.ignored.isEmpty)
    }

    @Test func whatCannotBeReadIsSkippedOneByOne() throws {
        let good: JSONValue = ["deed": "tarawih", "day": "2027-02-10", "at": 1_802_000_000_000, "place": "home", "rakahs": 8]
        func with(_ field: String, _ value: JSONValue) -> JSONValue {
            var record = good.object!
            record[field] = value
            return .object(record)
        }
        let state: JSONValue = [
            "records": .array([
                good, with("place", "masjid"), // the same deed on the same day: the first stands
                with("deed", "itikaf"), with("deed", 1),
                with("day", "2027-02-31"), with("day", "soon"), with("at", -1), with("at", "soon"),
                with("place", "tent"), with("place", 1),
                with("rakahs", 0), with("rakahs", 101), with("rakahs", 1.5), with("rakahs", "eight"),
                "not a record",
                ["deed": "eidPrayer", "day": "2027-03-09", "at": 1_802_000_000_000, "place": .null, "rakahs": .null],
            ]),
        ]
        let read = try Backup.read(try file(["state": state, "version": 1]), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        let seasons = read.snapshot.records.seasons
        #expect(seasons.count == 2)
        #expect(seasons[today]?[.tarawih]?.place == .home && seasons[today]?[.tarawih]?.rakahs == 8)
        #expect(seasons[day("2027-03-09")]?[.eidPrayer]?.place == nil)
    }

    @Test func aDamagedStoreCostsOnlyItself() throws {
        for damaged: JSONValue in [["state": "records", "version": 1], ["state": ["records": "none"], "version": 1], ["version": 1], "not a store"] {
            let read = try Backup.read(try file(damaged), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
            #expect(read.snapshot.records.seasons.isEmpty)
        }
    }

    @Test func aLaterVersionsStoreIsReadForWhatItHolds() throws {
        let record: JSONValue = ["deed": "eidPrayer", "day": "2027-03-09", "at": 1_802_000_000_000, "note": "a later field"]
        let read = try Backup.read(try file(["state": ["records": [record]], "version": 2]), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records.seasons[day("2027-03-09")]?[.eidPrayer] != nil)
    }

    @Test func replacingReplacesThem() async throws {
        let source = try await storeWithRecords()
        let records = try await source.snapshot()
        let contents = try exported(records)

        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: day("2020-05-01"), at: start)
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot() == records)
        // And the same again: the keys are unique, so the second time must not trip on the first.
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot() == records)
    }

    @Test func replacingWithABackupWithoutTheSeasonsLeavesNone() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: nil, on: today, at: start)
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .replace)
        #expect(try await store.snapshot().seasons.isEmpty)
    }

    @Test func mergingABackupWithoutTheSeasonsKeepsThem() async throws {
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        let report = try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .merge)
        #expect(try await store.day(today).seasons[.tarawih] == SeasonRecord(deed: .tarawih, day: today, at: start, place: .home, rakahs: 8))
        #expect(report.seasonRecords == 0)
    }

    @Test func mergingKeepsTheRecordHereAndAddsTheNewOnes() async throws {
        let mine = SeasonRecord(deed: .tarawih, day: today, at: start, place: .home, rakahs: 8)
        let store = try makeStore()
        try await store.setSeasonRecord(.tarawih, place: .home, rakahs: 8, on: today, at: start)

        var incoming = RecordsSnapshot()
        incoming.seasons = [
            today: [
                .tarawih: SeasonRecord(deed: .tarawih, day: today, at: start.addingTimeInterval(9), place: .masjid, rakahs: 20),
                .eidPrayer: SeasonRecord(deed: .eidPrayer, day: today, at: start),
            ],
            today.adding(days: 1): [.tarawih: SeasonRecord(deed: .tarawih, day: today.adding(days: 1), at: start)],
        ]
        let contents = try exported(incoming)
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .merge)
        var seasons = try await store.snapshot().seasons
        #expect(seasons[today]?[.tarawih] == mine)
        #expect(seasons[today]?[.eidPrayer] != nil)
        #expect(seasons[today.adding(days: 1)]?[.tarawih] != nil)

        // Merging again adds nothing: every day and deed is here now.
        try await Backup.restore(contents, into: store, settings: makeSettings(), mode: .merge)
        seasons = try await store.snapshot().seasons
        #expect(seasons.values.reduce(0) { $0 + $1.count } == 3)
        #expect(try ModelContext(store.container).fetchCount(FetchDescriptor<SeasonRow>()) == 3)
    }

    @Test func aReportFromBeforeTheSeasonsStillReads() throws {
        let report = ImportReport(source: ImportReport.webApp, at: start, snapshot: WebSnapshot(), settings: [])
        #expect(report.seasonRecords == 0)
        var fields = try JSONSerialization.jsonObject(with: JSONEncoder().encode(report)) as! [String: Any]
        fields["seasonRecords"] = nil
        let old = try JSONDecoder().decode(ImportReport.self, from: JSONSerialization.data(withJSONObject: fields))
        #expect(old.seasonRecords == nil)
        #expect(old.source == ImportReport.webApp)
    }
}
