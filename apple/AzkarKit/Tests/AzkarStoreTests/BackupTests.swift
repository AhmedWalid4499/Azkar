import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// Backup files in the website's format, both ways.
@Suite struct BackupTests {
    /// The real dataset's sessions, plus after-prayer azkar and tasbih presets to fill every part of a backup.
    static let catalog: StaticSessionCatalog = {
        var catalog = Fixtures.catalog
        catalog.sessions[.afterPrayer(.fajr)] = [DhikrTarget(id: "ayat-al-kursi", target: 1), DhikrTarget(id: "al-ikhlas-al-falaq-an-nas", target: 3)]
        catalog.sessions[.afterPrayer(.isha)] = [DhikrTarget(id: "ayat-al-kursi", target: 1)]
        catalog.tasbihPresets = ["subhanallah", "alhamdulillah"]
        return catalog
    }()

    static let exportedAt = instant("2026-10-29T08:00:00.250Z")

    /// A store holding a bit of everything: the website's operations scenario, after-prayer azkar,
    /// tasbih, fasts and the days owed.
    static func fullStore() async throws -> RecordStore {
        let store = try makeStore(catalog: catalog, zone: "Asia/Tokyo")
        _ = try await OperationsParityTests.replay(into: store)
        let at = instant("2026-10-20T21:00:00.125Z")
        try await store.count(.increment, dhikr: "ayat-al-kursi", in: .afterPrayer(.fajr), on: day("2026-10-21"), at: at)
        try await store.count(.complete, dhikr: "al-ikhlas-al-falaq-an-nas", in: .afterPrayer(.fajr), on: day("2026-10-21"), at: at.addingTimeInterval(30))
        try await store.count(.increment, dhikr: "ayat-al-kursi", in: .afterPrayer(.isha), on: day("2026-10-21"), at: at.addingTimeInterval(60))
        for second in 0..<33 { try await store.countTasbih("subhanallah", on: day("2026-10-21"), at: at.addingTimeInterval(Double(100 + second))) }
        try await store.resetTasbih("subhanallah", on: day("2026-10-21"))
        try await store.countTasbih("subhanallah", on: day("2026-10-21"), at: at.addingTimeInterval(200))
        try await store.countTasbih(nil, on: day("2026-10-22"), at: at.addingTimeInterval(86_400))
        try await store.setFast(.voluntary, .fasted, on: day("2026-10-19"), at: at)
        try await store.setFast(.qada, .broken, on: day("2026-10-20"), at: at)
        try await store.setOwedFastsBefore(6, at: at)
        return store
    }

    static let fullSettings: SettingsSnapshot = {
        var settings = SettingsSnapshot()
        settings.app = AppSettings(language: .ar, theme: .dark, timeFormat: .twentyFourHour, arabicDigits: false, hijriOffset: 1, name: "Ahmed Walid")
        settings.location = SavedLocation(latitude: 35.6762, longitude: 139.6503, timeZone: "Asia/Tokyo", label: "Tokyo, Japan", countryCode: "JP", source: .gps, updatedAt: 1_788_084_000_000)
        settings.calculation = CalculationConfig(method: .fixed(.egyptian), madhab: .fixed(.hanafi), polar: .nearestLatitude, adjustments: Adjustments(fajr: -2, isha: 3))
        settings.reminders.prayers = true
        settings.reminders.morningAzkar = true
        settings.reminders.morningAt = .sunrise
        settings.reminders.unloggedLeadMinutes = 30
        settings.reminders.adhan = [.fajr, .maghrib]
        settings.reader.arabicScale = 4
        settings.reader.showTranslation = false
        settings.reader.tasbihPreset = "subhanallah"
        settings.reader.tasbihTarget = 99
        return settings
    }()

    @Test func aNativeBackupReadsBackWithNothingLost() async throws {
        let store = try await Self.fullStore()
        let records = try await store.snapshot()
        #expect(!records.tasbih.isEmpty && !records.fasts.isEmpty && records.totals.afterPrayer.count == 2)
        let file = Backup.export(records: records, settings: Self.fullSettings, at: Self.exportedAt)
        let read = try Backup.read(file, catalog: Self.catalog, deviceTimeZone: "UTC")
        #expect(read.snapshot.records == records)
        #expect(read.snapshot.settings == Self.fullSettings)
        #expect(read.exportedAt == Self.exportedAt)
        #expect(read.snapshot.ignored.isEmpty)

        // And restored into another store: the same records again.
        let other = try makeStore(catalog: Self.catalog)
        try await Backup.restore(read, into: other, settings: makeSettings())
        #expect(try await other.snapshot() == records)
    }

    @Test func theFileHasTheWebsitesShape() async throws {
        let file = try JSONDecoder().decode(JSONValue.self, from: Backup.export(records: RecordsSnapshot(), settings: SettingsSnapshot(), at: Self.exportedAt))
        #expect(file["app"] == "azkar" && file["version"] == 1)
        #expect(file["exportedAt"] == "2026-10-29T08:00:00.250Z")
        #expect(Set(file["data"]!.object!.keys) == Set(WebStores.names.map { "azkar:\($0)" }))
        #expect(Backup.isBackupFile(file))
        #expect(Backup.fileName(at: instant("2026-10-29T20:00:00Z"), in: TimeZone(identifier: "Asia/Tokyo")!) == "azkar-backup-2026-10-30.json")
    }

    /// The committed native-backup.json is what this exports; scripts/native/store/verify-native-backup.test.ts
    /// checks that the website opens it. Set AZKAR_WRITE_FIXTURES=1 to write it again.
    @Test func theNativeBackupFixtureIsCurrent() async throws {
        let store = try await Self.fullStore()
        let file = Backup.export(records: try await store.snapshot(), settings: Self.fullSettings, at: Self.exportedAt)
        let url = Fixtures.directory.appending(path: "native-backup.json")
        if ProcessInfo.processInfo.environment["AZKAR_WRITE_FIXTURES"] == "1" { try file.write(to: url) }
        let committed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        expectSameJSON(try JSONDecoder().decode(JSONValue.self, from: file), committed, "native-backup")
    }

    @Test func theWebsitesBackupRestoresAsTheWebsiteRestoresIt() async throws {
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        let store = try makeStore()
        let settings = makeSettings()
        try await Backup.restore(contents, into: store, settings: settings)

        // What the website itself loaded after importing that backup.
        let afterImport = try Fixtures.json("hydration.json").array!.first { $0["name"] == "after importing a backup" }!
        let loaded = WebStores.read(Fixtures.entries(afterImport["raw"]), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(try await store.snapshot() == loaded.records)
        #expect(settings.load() == loaded.settings)
        #expect(contents.exportedAt == instant("2026-10-12T16:10:00.123Z"))
    }

    @Test func aWebsiteBackupExportedHereKeepsEveryStoreTheWebsiteWrote() async throws {
        let original = try Fixtures.json("realistic-backup.json")
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        let exported = try JSONDecoder().decode(JSONValue.self, from: Backup.export(records: contents.snapshot.records, settings: contents.snapshot.settings))
        let fields: [String: [String]] = [
            "azkar:prayer-times": WebHydrationParityTests.prayerTimesFields,
            "azkar:azkar-progress": WebHydrationParityTests.progressFields,
            "azkar:azkar-settings": Array(ReaderSettings.mainBranchFields),
        ]
        for (key, stored) in original["data"]!.object! {
            let state = exported["data"]?[key]?["state"]
            expectSameJSON(fields[key].map { state?.only($0) } ?? state, stored["state"], key)
        }
    }

    @Test func extraKeysAreLeftOutAndReported() throws {
        let contents = try Backup.read(try Fixtures.data("backup-with-extras.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(contents.snapshot.ignored == ["azkar:today-layout", "azkar:from-a-newer-build"])
        let plain = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(contents.snapshot.records == plain.snapshot.records && contents.snapshot.settings == plain.snapshot.settings)
    }

    @Test func whatIsNotABackupIsRefusedAndChangesNothing() async throws {
        let store = try makeStore()
        try await store.logPrayer(.fajr, on: day("2026-09-01"), at: instant("2026-09-01T05:00:00Z"))
        let before = try await store.snapshot()
        for file in try Fixtures.json("not-backups.json").array! {
            let data = try JSONEncoder().encode(file)
            #expect(throws: Backup.Failure.notABackup) { try Backup.read(data, catalog: Fixtures.catalog) }
        }
        #expect(throws: Backup.Failure.notJSON) { try Backup.read(Data("{\"app\":".utf8), catalog: Fixtures.catalog) }
        #expect(throws: Backup.Failure.notABackup) { try Backup.read(Data("[]".utf8), catalog: Fixtures.catalog) }
        #expect(try await store.snapshot() == before)
    }

    @Test func restoringReplacesEverythingAsTheWebsiteDoes() async throws {
        let store = try makeStore()
        let settings = makeSettings()
        try await store.logPrayer(.asr, on: day("2020-01-01"), at: instant("2020-01-01T15:00:00Z"))
        settings.update { $0.reader.haptics = false }
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        let report = try await Backup.restore(contents, into: store, settings: settings, mode: .replace)
        #expect(try await store.day(day("2020-01-01")).isEmpty)
        #expect(settings.load().reader == contents.snapshot.settings.reader)
        #expect(report.source == ImportReport.backup)
        #expect(try await store.importReports().map(\.source) == [ImportReport.backup])
    }

    @Test func restoringTheSameBackupTwiceGivesTheSameRecordsNotTwice() async throws {
        let store = try makeStore()
        let settings = makeSettings()
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        try await Backup.restore(contents, into: store, settings: settings)
        try await Backup.restore(contents, into: store, settings: settings)
        #expect(try await store.snapshot() == contents.snapshot.records)
    }

    @Test func mergingKeepsWhatIsHereAndAddsTheRest() async throws {
        let store = try makeStore()
        let settings = makeSettings()
        try await store.logPrayer(.asr, on: day("2020-01-01"), at: instant("2020-01-01T15:00:00Z"))
        settings.update { $0.reader.haptics = false }
        let contents = try Backup.read(try Fixtures.data("realistic-backup.json"), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        try await Backup.restore(contents, into: store, settings: settings, mode: .merge)
        let records = try await store.snapshot()
        #expect(records.prayers[day("2020-01-01")]?.prayers[.asr]?.status == .ontime)
        #expect(records.prayers[day("2026-09-01")] == contents.snapshot.records.prayers[day("2026-09-01")])
        #expect(!settings.load().reader.haptics)
        #expect(settings.load().location == contents.snapshot.settings.location)
    }
}
