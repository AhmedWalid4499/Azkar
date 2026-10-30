import AzkarCore
import Foundation
import SwiftData
import Testing
@testable import AzkarStore

/// A store written before a schema change opens with everything in it.
@Suite struct SchemaMigrationTests {
    /// The plan as it shipped with `AzkarSchemaV1` alone: what the app on the phone opened its store with.
    enum ShippedV1Plan: SchemaMigrationPlan {
        static var schemas: [any VersionedSchema.Type] { [AzkarSchemaV1.self] }
        static var stages: [MigrationStage] { [] }
    }

    /// The plan as it shipped with `AzkarSchemaV2` last: what the owner's phone has now.
    enum ShippedV2Plan: SchemaMigrationPlan {
        static var schemas: [any VersionedSchema.Type] { [AzkarSchemaV1.self, AzkarSchemaV2.self] }
        static var stages: [MigrationStage] { [.lightweight(fromVersion: AzkarSchemaV1.self, toVersion: AzkarSchemaV2.self)] }
    }

    let first = day("2026-09-01")
    let second = day("2026-09-02")
    let at = instant("2026-09-01T05:00:00.125Z")
    let later = instant("2026-09-01T05:10:00.500Z")

    /// A report as the first version saved it, with none of the fields added since.
    var reportJSON: String {
        let report = ImportReport(source: ImportReport.webApp, at: at, snapshot: WebSnapshot(), settings: ["app"])
        var fields = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(report)) as! [String: Any]
        fields["quranEntries"] = nil
        fields["seasonRecords"] = nil
        return String(decoding: try! JSONSerialization.data(withJSONObject: fields), as: UTF8.self)
    }

    /// Writes a row of every table with the first version's own models, on disk, and closes it.
    func writeV1Store(in directory: URL) throws {
        typealias V1 = AzkarSchemaV1
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let schema = Schema(versionedSchema: V1.self)
        let configuration = ModelConfiguration(schema: schema, url: directory.appending(path: StoreContainer.fileName), cloudKitDatabase: .none)
        let container = try ModelContainer(for: schema, migrationPlan: ShippedV1Plan.self, configurations: configuration)
        let context = ModelContext(container)
        context.autosaveEnabled = false

        context.insert(V1.PrayerRow(day: first.number, prayer: "fajr", status: "jamaah", loggedAt: at))
        context.insert(V1.PrayerRow(day: second.number, prayer: "isha", status: "late", loggedAt: nil))
        context.insert(V1.SunnahRow(day: first.number, sunnah: "duha", at: at))
        let session = V1.SessionRow(day: first.number, session: "morning")
        session.startedAt = at
        session.lastAt = later
        session.completedAt = later
        session.completed = true
        session.done = 2
        session.total = 2
        session.recitations = 7
        context.insert(session)
        context.insert(V1.DhikrCountRow(day: first.number, session: "afterPrayer:fajr", dhikr: "kursi", count: 3))
        context.insert(V1.TallyRow(kind: TallyKind.dhikr, key: "kursi", value: 3))
        context.insert(V1.TallyRow(kind: TallyKind.afterPrayer, key: "kursi", value: 1))
        context.insert(V1.TallyRow(kind: TallyKind.tasbih, key: "subhanallah", value: 33))
        context.insert(V1.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.recitations, value: 10))
        context.insert(V1.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.tasbihFree, value: 4))
        context.insert(V1.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.owedFastsBefore, value: 6))
        context.insert(V1.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.revision, value: 41))
        let tasbih = V1.TasbihRow(day: second.number, preset: "subhanallah", count: 33, current: 0)
        tasbih.startedAt = at
        tasbih.lastAt = later
        context.insert(tasbih)
        context.insert(V1.FastRow(day: first.number, kind: "voluntary", status: "fasted", loggedAt: at))
        context.insert(V1.ImportRow(source: ImportReport.webApp, at: at, report: reportJSON))
        try context.save()
    }

    let quranID = UUID(uuidString: "E621E1F8-C36C-495A-93FC-0C247A3E6E5F")!
    let khatmahID = UUID(uuidString: "0F8FAD5B-D9CB-469F-A165-70867728950E")!

    /// Writes a row of every table with the second version's own models, on disk, and closes it.
    func writeV2Store(in directory: URL) throws {
        typealias V2 = AzkarSchemaV2
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let schema = Schema(versionedSchema: V2.self)
        let configuration = ModelConfiguration(schema: schema, url: directory.appending(path: StoreContainer.fileName), cloudKitDatabase: .none)
        let container = try ModelContainer(for: schema, migrationPlan: ShippedV2Plan.self, configurations: configuration)
        let context = ModelContext(container)
        context.autosaveEnabled = false

        context.insert(V2.PrayerRow(day: first.number, prayer: "fajr", status: "jamaah", loggedAt: at))
        context.insert(V2.PrayerRow(day: second.number, prayer: "isha", status: "late", loggedAt: nil))
        context.insert(V2.SunnahRow(day: first.number, sunnah: "duha", at: at))
        let session = V2.SessionRow(day: first.number, session: "morning")
        session.startedAt = at
        session.lastAt = later
        session.completedAt = later
        session.completed = true
        session.done = 2
        session.total = 2
        session.recitations = 7
        context.insert(session)
        context.insert(V2.DhikrCountRow(day: first.number, session: "afterPrayer:fajr", dhikr: "kursi", count: 3))
        context.insert(V2.TallyRow(kind: TallyKind.dhikr, key: "kursi", value: 3))
        context.insert(V2.TallyRow(kind: TallyKind.afterPrayer, key: "kursi", value: 1))
        context.insert(V2.TallyRow(kind: TallyKind.tasbih, key: "subhanallah", value: 33))
        context.insert(V2.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.recitations, value: 10))
        context.insert(V2.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.tasbihFree, value: 4))
        context.insert(V2.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.owedFastsBefore, value: 6))
        context.insert(V2.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.revision, value: 41))
        let tasbih = V2.TasbihRow(day: second.number, preset: "subhanallah", count: 33, current: 0)
        tasbih.startedAt = at
        tasbih.lastAt = later
        context.insert(tasbih)
        context.insert(V2.FastRow(day: first.number, kind: "voluntary", status: "fasted", loggedAt: at))
        context.insert(V2.ImportRow(source: ImportReport.webApp, at: at, report: reportJSON))
        context.insert(V2.QuranEntryRow(id: quranID, day: first.number, at: at, kind: "read", fromPage: 0, toPage: 42))
        context.insert(V2.QuranEntryRow(id: khatmahID, day: second.number, at: later, kind: "khatmah", fromPage: 42, toPage: 0))
        context.insert(V2.QuranBookmarkRow(page: 42, at: later))
        try context.save()
    }

    /// The Quran rows of `writeV2Store`, on top of what both versions hold.
    var expectedV2: RecordsSnapshot {
        var records = expected
        records.quran = [
            QuranEntry(id: quranID, day: first, at: at, kind: .read, fromPage: 0, toPage: 42),
            QuranEntry(id: khatmahID, day: second, at: later, kind: .khatmah, fromPage: 42, toPage: 0),
        ]
        records.quranBookmarks = [42: later]
        return records
    }

    /// All of `writeV1Store`, as the current schema must read it.
    var expected: RecordsSnapshot {
        var records = RecordsSnapshot()
        records.prayers[first] = DayPrayerRecord(prayers: [.fajr: PrayerEntry(status: .jamaah, loggedAt: at)], sunnah: [.duha: at])
        records.prayers[second] = DayPrayerRecord(prayers: [.isha: PrayerEntry(status: .late, loggedAt: nil)])
        records.sessions[first] = [.morning: SessionRecord(startedAt: at, lastAt: later, completedAt: later, completed: true, done: 2, total: 2, recitations: 7)]
        records.counts[first] = [.afterPrayer(.fajr): ["kursi": 3]]
        records.totals = LifetimeTotals(dhikr: ["kursi": 3], recitations: 10, afterPrayer: ["kursi": 1], tasbih: ["subhanallah": 33], tasbihFree: 4)
        records.tasbih[second] = ["subhanallah": TasbihCount(startedAt: at, lastAt: later, count: 33, current: 0)]
        records.fasts[first] = FastRecord(kind: .voluntary, status: .fasted, loggedAt: at)
        records.owedFastsBefore = 6
        return records
    }

    @Test func aStoreWrittenByTheFirstVersionOpensWithEveryRow() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV1Store(in: directory)

        let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        #expect(try await store.snapshot() == expected)
        #expect(try await store.revision() == 41)
        #expect(try await store.hasImported(ImportReport.webApp))
        #expect(try await store.importReports().map(\.settings) == [["app"]])

        // Row by row too, so nothing the snapshot does not read goes unchecked.
        let context = ModelContext(store.container)
        #expect(try context.fetchCount(FetchDescriptor<PrayerRow>()) == 2)
        #expect(try context.fetchCount(FetchDescriptor<SunnahRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<SessionRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<DhikrCountRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<TallyRow>()) == 7)
        #expect(try context.fetchCount(FetchDescriptor<TasbihRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<FastRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<ImportRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<QuranEntryRow>()) == 0)
        #expect(try context.fetchCount(FetchDescriptor<QuranBookmarkRow>()) == 0)
        #expect(try context.fetchCount(FetchDescriptor<SeasonRow>()) == 0)
    }

    @Test func aStoreWrittenByTheSecondVersionOpensWithEveryRow() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV2Store(in: directory)

        let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        #expect(try await store.snapshot() == expectedV2)
        #expect(try await store.revision() == 41)
        #expect(try await store.hasImported(ImportReport.webApp))
        #expect(try await store.importReports().map(\.settings) == [["app"]])

        let context = ModelContext(store.container)
        #expect(try context.fetchCount(FetchDescriptor<PrayerRow>()) == 2)
        #expect(try context.fetchCount(FetchDescriptor<SunnahRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<SessionRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<DhikrCountRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<TallyRow>()) == 7)
        #expect(try context.fetchCount(FetchDescriptor<TasbihRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<FastRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<ImportRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<QuranEntryRow>()) == 2)
        #expect(try context.fetchCount(FetchDescriptor<QuranBookmarkRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<SeasonRow>()) == 0)
    }

    @Test func theSecondVersionsLogGoesOnAndTheMigratedStoreTakesSeasonRecords() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV2Store(in: directory)

        let entry: QuranEntry
        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
            entry = try await store.logQuranReading(toPage: 50, on: second, at: later.addingTimeInterval(1))
            try await store.setSeasonRecord(.tarawih, place: .masjid, rakahs: 8, on: first, at: at)
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        var records = expectedV2
        records.quran.append(entry)
        records.seasons = [first: [.tarawih: SeasonRecord(deed: .tarawih, day: first, at: at, place: .masjid, rakahs: 8)]]
        #expect(try await reopened.snapshot() == records)
        #expect(try await reopened.revision() == 43)
        #expect(entry.fromPage == 42, "the position read from the V2 log")
    }

    /// Built on a phone that had V1, took V2 in one update and takes V3 in the next.
    @Test func aStoreThatTookEachVersionInTurnKeepsItAll() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV1Store(in: directory)
        do {
            typealias V2 = AzkarSchemaV2
            let schema = Schema(versionedSchema: V2.self)
            let configuration = ModelConfiguration(schema: schema, url: directory.appending(path: StoreContainer.fileName), cloudKitDatabase: .none)
            let container = try ModelContainer(for: schema, migrationPlan: ShippedV2Plan.self, configurations: configuration)
            let context = ModelContext(container)
            context.autosaveEnabled = false
            context.insert(V2.QuranEntryRow(id: quranID, day: first.number, at: at, kind: "read", fromPage: 0, toPage: 42))
            context.insert(V2.QuranBookmarkRow(page: 42, at: later))
            try context.save()
        }
        let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        var records = expected
        records.quran = [QuranEntry(id: quranID, day: first, at: at, kind: .read, fromPage: 0, toPage: 42)]
        records.quranBookmarks = [42: later]
        #expect(try await store.snapshot() == records)
        #expect(try await store.revision() == 41)
    }

    @Test func theMigratedStoreTakesTheQuranAndKeepsItAll() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV1Store(in: directory)

        let entry: QuranEntry
        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
            entry = try await store.logQuranReading(toPage: 10, on: first, at: at)
            try await store.setQuranBookmark(page: 10, on: true, at: at)
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        var records = expected
        records.quran = [entry]
        records.quranBookmarks = [10: at]
        #expect(try await reopened.snapshot() == records)
        #expect(try await reopened.revision() == 43)
    }

    @Test func aStoreOfTheFirstVersionTakesSeasonRecords() async throws {
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try writeV1Store(in: directory)

        do {
            let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
            try await store.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: first, at: at)
        }
        let reopened = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        var records = expected
        records.seasons = [first: [.eidPrayer: SeasonRecord(deed: .eidPrayer, day: first, at: at)]]
        #expect(try await reopened.snapshot() == records)
    }

    @Test func theMigrationPlanGoesThroughEveryVersionInOrder() {
        #expect(AzkarSchemaV2.versionIdentifier == Schema.Version(2, 0, 0))
        #expect(AzkarSchemaV3.versionIdentifier == Schema.Version(3, 0, 0))
        #expect(AzkarMigrationPlan.schemas.map { $0.versionIdentifier } == [Schema.Version(1, 0, 0), Schema.Version(2, 0, 0), Schema.Version(3, 0, 0)])
        #expect(AzkarMigrationPlan.stages.count == 2)
        #expect(AzkarSchemaV2.models.count == AzkarSchemaV1.models.count + 2)
        #expect(AzkarSchemaV3.models.count == AzkarSchemaV2.models.count + 1)
    }
}
