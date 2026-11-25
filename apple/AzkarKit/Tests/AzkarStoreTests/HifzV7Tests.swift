import AzkarCore
import Foundation
import SwiftData
import Testing
@testable import AzkarStore

/// The plan as it shipped with `AzkarSchemaV6` last: what the owner's phone has now.
private enum ShippedV6Plan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [AzkarSchemaV1.self, AzkarSchemaV2.self, AzkarSchemaV3.self, AzkarSchemaV4.self, AzkarSchemaV5.self, AzkarSchemaV6.self] }
    static var stages: [MigrationStage] {
        [
            .lightweight(fromVersion: AzkarSchemaV1.self, toVersion: AzkarSchemaV2.self),
            .lightweight(fromVersion: AzkarSchemaV2.self, toVersion: AzkarSchemaV3.self),
            .lightweight(fromVersion: AzkarSchemaV3.self, toVersion: AzkarSchemaV4.self),
            .lightweight(fromVersion: AzkarSchemaV4.self, toVersion: AzkarSchemaV5.self),
            .lightweight(fromVersion: AzkarSchemaV5.self, toVersion: AzkarSchemaV6.self),
        ]
    }
}

/// The seventh version: ranges and strength on the memorisation log, and its plans.
@Suite struct HifzV7MigrationTests {
    /// A copy of a store the shipped app (1.0.2 build 8, schema V6) wrote on an iPhone simulator:
    /// its seeded Quran reading and memorisation, a few prayers and a morning session.
    func copyOfShippedV6Store() throws -> URL {
        let fixture = try #require(Bundle.module.url(forResource: "Fixtures", withExtension: nil))
            .appending(path: "V6Store/\(StoreContainer.fileName)")
        let directory = StorageTests.temporaryDirectory()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: fixture, to: directory.appending(path: StoreContainer.fileName))
        return directory
    }

    @Test func theShippedV6StoreOpensWithEveryRowAndTakesRangesStrengthAndPlans() async throws {
        let directory = try copyOfShippedV6Store()
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let records = try await store.snapshot()
        #expect(try await store.revision() == 37)
        #expect(records.prayers.values.reduce(0) { $0 + $1.prayers.count } == 12)
        #expect(records.prayers[day("2026-11-15")]?.prayers.count == 5)
        #expect(records.sessions[day("2026-11-16")]?[.morning]?.recitations == 1)
        #expect(records.totals.recitations == 1)
        #expect(records.quran.count == 12)
        #expect(records.quranBookmarks.keys.sorted() == [50])
        #expect(records.hifz.count == 10)
        #expect(records.hifz.allSatisfy { $0.isWholeSura && $0.strength == nil })
        #expect(Set(records.hifz.map(\.sura)) == [67, 112, 113, 114])
        #expect(records.hifzPlans.isEmpty)
        let before = HifzProgress(entries: records.hifz)
        #expect(before.memorisedCount == 4)
        #expect(before.suras[114]?.lastReviewedOn == day("2026-11-16"))

        // Half of al-Baqarah memorised, reviewed weakly, and a plan for the rest.
        let half = AyahSpan(sura: 2, from: 1, to: 143)
        try await store.logHifz(.memorised, spans: [half], on: day("2026-11-10"), at: instant("2026-11-10T06:00:00Z"))
        try await store.logHifz(.reviewed, spans: [half], strength: .weak, on: day("2026-11-14"), at: instant("2026-11-14T06:00:00Z"))
        try await store.startHifzPlan(.sura(2), from: day("2026-11-16"), to: day("2026-12-31"), dailyAyat: 4, at: instant("2026-11-16T06:00:00Z"))

        // Reopened, as the next launch does.
        let again = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let reopened = try await again.snapshot()
        #expect(reopened.prayers == records.prayers)
        #expect(reopened.quran == records.quran)
        #expect(reopened.hifz.count == 12)
        let ranged = reopened.hifz.filter { $0.sura == 2 }
        #expect(ranged.map(\.fromAyah) == [1, 1] && ranged.map(\.toAyah) == [143, 143])
        #expect(ranged.map(\.strength) == [nil, .weak])
        #expect(reopened.hifzPlans.map(\.target) == [.sura(2)])
        let progress = HifzProgress(entries: reopened.hifz)
        #expect(progress.memorisedCount == 4)
        #expect(progress.suras[2]?.heldAyat == 143)
        let due = progress.due(on: day("2026-11-16"))
        // Due the day after the weak review, with the surahs memorised weeks ago and never reviewed.
        #expect(due.contains { $0.span == half && $0.strength == .weak && $0.dueOn == day("2026-11-15") })
        #expect(Set(due.map(\.span.sura)) == [2, 67, 112, 113])
        #expect(try await again.revision() == 40)

        // Row by row: the old lines have no range, the table of plans is there.
        let context = ModelContext(again.container)
        let rows = try context.fetch(FetchDescriptor<HifzEntryRow>())
        #expect(rows.filter { $0.sura != 2 }.allSatisfy { $0.fromAyah == nil && $0.toAyah == nil && $0.strength == nil })
        #expect(try context.fetchCount(FetchDescriptor<HifzPlanRow>()) == 1)
        #expect(try context.fetchCount(FetchDescriptor<QuranBookmarkRow>()) == 1)
    }

    /// The same move from rows written with the sixth version's own models, every table touched.
    @Test func aStoreWrittenByTheSixthVersionKeepsItAll() async throws {
        typealias V6 = AzkarSchemaV6
        let directory = StorageTests.temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let first = day("2026-11-01")
        let at = instant("2026-11-01T05:00:00.125Z")
        let entry = UUID()
        do {
            let schema = Schema(versionedSchema: V6.self)
            let configuration = ModelConfiguration(schema: schema, url: directory.appending(path: StoreContainer.fileName), cloudKitDatabase: .none)
            let container = try ModelContainer(for: schema, migrationPlan: ShippedV6Plan.self, configurations: configuration)
            let context = ModelContext(container)
            context.insert(V6.PrayerRow(day: first.number, prayer: "fajr", status: "jamaah", loggedAt: at))
            context.insert(V6.HifzEntryRow(id: entry, sura: 67, day: first.number, at: at, kind: "memorised"))
            context.insert(V6.DuaRow(id: UUID(), text: "Guide me", addedAt: at))
            context.insert(V6.GivingRow(id: UUID(), kind: "sadaqah", day: first.number, at: at, amount: "5", currency: "EGP", note: nil))
            context.insert(V6.TallyRow(kind: TallyKind.counter, key: TallyKind.Counter.revision, value: 41))
            try context.save()
        }

        let store = try RecordStore.open(.directory(directory), catalog: AzkarRecordTests.catalog, timeZone: { StorageTests.utc })
        let records = try await store.snapshot()
        #expect(records.prayers[first]?.prayers[.fajr]?.status == .jamaah)
        #expect(records.hifz == [HifzEntry(id: entry, sura: 67, day: first, at: at, kind: .memorised)])
        #expect(records.duas.map(\.text) == ["Guide me"])
        #expect(records.giving.count == 1)
        #expect(try await store.revision() == 41)
    }
}

@Suite struct HifzRangeStoreTests {
    let today = day("2026-11-01")
    let start = instant("2026-11-01T05:00:00Z")

    @Test func spansOutsideTheQuranAreLeftOutAndAWholeSurahIsStoredAsOne() async throws {
        let store = try makeStore()
        #expect(try await store.logHifz(.memorised, spans: [AyahSpan(sura: 2, from: 280, to: 290), AyahSpan(sura: 115, from: 1, to: 1)], on: today, at: start).result == .unchanged)
        let change = try await store.logHifz(.memorised, spans: [AyahSpan(sura: 112, from: 1, to: 4), AyahSpan(sura: 2, from: 5, to: 1)], on: today, at: start)
        #expect(change.day.hifz.map(\.isWholeSura) == [true])
    }

    @Test func aStrengthIsKeptOnReviewsOnly() async throws {
        let store = try makeStore()
        try await store.logHifz(.memorised, spans: [AyahSpan(sura: 2, from: 1, to: 5)], strength: .strong, on: today, at: start)
        try await store.logHifz(.reviewed, spans: [AyahSpan(sura: 2, from: 1, to: 5)], strength: .strong, on: today, at: start.addingTimeInterval(60))
        #expect(try await store.snapshot().hifz.map(\.strength) == [nil, .strong])
    }

    @Test func aNewPlanEndsTheOneRunningAndEndedPlansStay() async throws {
        let store = try makeStore()
        try await store.startHifzPlan(.juz(30), from: today, to: today.adding(days: 60), dailyAyat: 10, at: start)
        try await store.startHifzPlan(.range(from: AyahRef(sura: 2, ayah: 1), to: AyahRef(sura: 2, ayah: 141)), from: today, to: today.adding(days: 30), dailyAyat: 5, at: start.addingTimeInterval(60))
        var plans = try await store.snapshot().hifzPlans
        #expect(plans.map(\.isActive) == [false, true])
        #expect(try await store.startHifzPlan(.sura(115), from: today, to: today, dailyAyat: 1, at: start).result == .unchanged)
        #expect(try await store.startHifzPlan(.sura(1), from: today, to: today.adding(days: -1), dailyAyat: 1, at: start).result == .unchanged)
        try await store.endHifzPlan(plans[1].id, at: start.addingTimeInterval(120))
        plans = try await store.snapshot().hifzPlans
        #expect(plans.allSatisfy { !$0.isActive })
        #expect(plans.count == 2)
        #expect(try await store.endHifzPlan(plans[1].id, at: start).result == .unchanged)
    }

    @Test func aBackupCarriesRangesStrengthAndPlansAndAMergeEndsWhatEndedElsewhere() async throws {
        let store = try makeStore()
        try await store.logHifz(.memorised, spans: [AyahSpan(sura: 2, from: 1, to: 143)], on: today, at: start)
        try await store.logHifz(.reviewed, spans: [AyahSpan(sura: 2, from: 1, to: 143)], strength: .weak, on: today, at: start.addingTimeInterval(60))
        try await store.startHifzPlan(.sura(2), from: today, to: today.adding(days: 40), dailyAyat: 4, at: start)
        let running = try await store.snapshot()
        let data = Backup.export(records: running, settings: SettingsSnapshot(), at: start)
        #expect(String(decoding: data, as: UTF8.self).contains("strength"))
        let read = try Backup.read(data, catalog: Fixtures.catalog)
        #expect(read.snapshot.records.hifz == running.hifz)
        #expect(read.snapshot.records.hifzPlans == running.hifzPlans)

        let other = try makeStore()
        try await other.replaceAll(with: read.snapshot.records)
        #expect(try await other.snapshot().hifzPlans == running.hifzPlans)

        // Ended here later: merging the older backup in keeps it ended, merging the ended one ends it there.
        try await store.endHifzPlan(running.hifzPlans[0].id, at: start.addingTimeInterval(600))
        try await store.merge(read.snapshot.records)
        #expect(try await store.snapshot().hifzPlans.map(\.isActive) == [false])
        try await other.merge(try await store.snapshot())
        #expect(try await other.snapshot().hifzPlans.map(\.isActive) == [false])
        #expect(try await other.snapshot().hifz.count == 2)
    }

    @Test func aVersionOneBackupStillRestores() throws {
        let id = UUID()
        let stored: JSONValue = [
            "state": ["entries": [["id": .string(id.uuidString), "sura": 67, "day": "2026-11-01", "at": 1_793_000_000_000, "kind": "memorised"]]],
            "version": 1,
        ]
        let snapshot = WebStores.read([WebStores.prefix + WebStores.hifz: .json(stored)], catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(snapshot.records.hifz.map(\.id) == [id])
        #expect(snapshot.records.hifz.first?.isWholeSura == true)
        #expect(snapshot.records.hifzPlans.isEmpty)
    }

    @Test func unreadableRangesAndPlansAreSkipped() {
        let read = WebHifz.read([
            "entries": [
                ["id": .string(UUID().uuidString), "sura": 2, "day": "2026-11-01", "at": 1, "kind": "memorised", "from": 5],
                ["id": .string(UUID().uuidString), "sura": 2, "day": "2026-11-01", "at": 1, "kind": "memorised", "from": 5, "to": 300],
                ["id": .string(UUID().uuidString), "sura": 2, "day": "2026-11-01", "at": 1, "kind": "memorised", "from": "a", "to": 6],
                ["id": .string(UUID().uuidString), "sura": 2, "day": "2026-11-01", "at": 2, "kind": "reviewed", "from": 1, "to": 6, "strength": 9],
            ],
            "plans": [
                ["id": .string(UUID().uuidString), "createdAt": 1, "start": "2026-11-01", "target": "juz:31", "targetDay": "2026-12-01", "dailyAyat": 3],
                ["id": .string(UUID().uuidString), "createdAt": 1, "start": "2026-11-01", "target": "sura:2", "targetDay": "2026-10-01", "dailyAyat": 3],
                ["id": .string(UUID().uuidString), "createdAt": 1, "start": "2026-11-01", "target": "range:2:1-2:141", "targetDay": "2026-12-01", "dailyAyat": 3],
            ],
        ])
        #expect(read.entries.count == 1)
        #expect(read.entries.first?.strength == nil, "a strength it cannot read is left out, the review kept")
        #expect(read.plans.map(\.target) == [.range(from: AyahRef(sura: 2, ayah: 1), to: AyahRef(sura: 2, ayah: 141))])
    }
}
