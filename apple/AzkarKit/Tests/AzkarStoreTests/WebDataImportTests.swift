import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The one-time import of the web-based app's data from where `@capacitor/preferences` mirrored it.
@Suite struct WebDataImportTests {
    /// What the Capacitor app left in the standard defaults: realistic-storage.json is the
    /// `localStorage` of a real install made by the website's own stores.
    static func capacitorDefaults(_ storage: [String: String]? = nil) throws -> UserDefaults {
        let defaults = UserDefaults(suiteName: "AzkarStoreTests.capacitor.\(UUID().uuidString)")!
        let storage = try storage ?? Fixtures.json("realistic-storage.json").object!.mapValues { $0.string! }
        for (key, value) in storage { defaults.set(value, forKey: WebDataImport.keyPrefix + key) }
        defaults.set("unrelated", forKey: "CapacitorStorage.other-app-key")
        defaults.set(5, forKey: "SomethingElse")
        return defaults
    }

    static func expected() throws -> WebSnapshot {
        let raw = try Fixtures.json("realistic-storage.json")
        return WebStores.read(Fixtures.entries(raw), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
    }

    @Test func everythingTheWebAppKeptIsImported() async throws {
        let defaults = try Self.capacitorDefaults()
        let store = try makeStore()
        let settings = makeSettings()
        let report = try await WebDataImport.runIfNeeded(from: defaults, into: store, settings: settings, deviceTimeZone: "UTC", now: instant("2026-10-29T08:00:00Z"))
        let expected = try Self.expected()

        #expect(try await store.snapshot() == expected.records)
        #expect(settings.load() == expected.settings)
        #expect(report.storesFound == ["azkar-progress", "azkar-settings", "location", "prayer-log", "prayer-times", "settings"])
        #expect(report.settings == ["app", "calculation", "location", "reader", "reminders"])
        #expect(report.prayers == 5 && report.sunnahPrayers == 3 && report.sessions == 3)
        #expect(report.firstDay == day("2026-08-31") && report.lastDay == day("2026-10-13"))
        #expect(try await store.importReports() == [report])
    }

    @Test func theImportRunsOnceAndNeverTouchesTheSourceKeys() async throws {
        let defaults = try Self.capacitorDefaults()
        let before = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("CapacitorStorage.") }.mapValues { "\($0)" }
        let store = try makeStore()
        let settings = makeSettings()
        let first = try await WebDataImport.runIfNeeded(from: defaults, into: store, settings: settings, deviceTimeZone: "UTC")
        let afterFirst = try await store.snapshot()
        let second = try await WebDataImport.runIfNeeded(from: defaults, into: store, settings: settings, deviceTimeZone: "UTC")
        #expect(second == first)
        #expect(try await store.snapshot() == afterFirst, "nothing counted twice")
        #expect(try await store.importReports().count == 1)
        let after = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("CapacitorStorage.") }.mapValues { "\($0)" }
        #expect(after == before)
    }

    @Test func nothingStoredIsRecordedAsAnEmptyImport() async throws {
        let store = try makeStore()
        let settings = makeSettings()
        let report = try await WebDataImport.runIfNeeded(from: try Self.capacitorDefaults([:]), into: store, settings: settings)
        #expect(report.isEmpty)
        #expect(try await store.snapshot().isEmpty)
        #expect(!SettingsStore.Group.allCases.contains(where: settings.has))
        #expect(try await store.hasImported(ImportReport.webApp))
    }

    @Test func recordsAndSettingsMadeHereBeforeTheImportStay() async throws {
        let store = try makeStore(zone: "Asia/Tokyo")
        let settings = makeSettings()
        settings.update { $0.app.name = "Native" }
        // The web app logged Fajr of 1 September on time; the native app had it with the congregation.
        try await store.setPrayer(.fajr, .jamaah, on: day("2026-09-01"), at: instant("2026-09-01T00:00:00Z"))
        try await store.count(.increment, dhikr: "ayat-al-kursi", in: .evening, on: day("2026-10-20"), at: instant("2026-10-20T09:00:00Z"))

        try await WebDataImport.runIfNeeded(from: try Self.capacitorDefaults(), into: store, settings: settings, deviceTimeZone: "UTC")
        let expected = try Self.expected()
        let records = try await store.snapshot()
        #expect(records.prayers[day("2026-09-01")]?.prayers[.fajr]?.status == .jamaah)
        #expect(records.prayers[day("2026-09-01")]?.prayers[.dhuhr] == expected.records.prayers[day("2026-09-01")]?.prayers[.dhuhr])
        #expect(records.sessions[day("2026-10-20")]?[.evening]?.recitations == 1)
        #expect(records.totals.recitations == expected.records.totals.recitations + 1)
        #expect(records.totals.dhikr["ayat-al-kursi"] == (expected.records.totals.dhikr["ayat-al-kursi"] ?? 0) + 1)
        #expect(settings.load().app.name == "Native")
        #expect(settings.load().location == expected.settings.location)
    }

    @Test func aPlaceWithoutCalculationSettingsKeepsTheStandardAsr() async throws {
        let raw = try Fixtures.json("hydration.json").array!.first { $0["name"]!.string!.hasPrefix("a location but no calculation") }!["raw"]!
        let settings = makeSettings()
        try await WebDataImport.runIfNeeded(from: try Self.capacitorDefaults(raw.object!.mapValues { $0.string! }), into: try makeStore(), settings: settings)
        #expect(settings.load().calculation.madhab == .fixed(.shafi))
        #expect(!settings.has(.reminders))
    }

    @Test func aValueThatIsNotTextIsUnreadableNotFatal() async throws {
        let defaults = try Self.capacitorDefaults([:])
        defaults.set(42, forKey: "CapacitorStorage.azkar:prayer-log")
        defaults.set(#"{"state":{"theme":"dark"},"version":1}"#, forKey: "CapacitorStorage.azkar:settings")
        let settings = makeSettings()
        let report = try await WebDataImport.runIfNeeded(from: defaults, into: try makeStore(), settings: settings)
        #expect(report.storesFound == ["settings"])
        #expect(settings.load().app.theme == .dark)
    }

    // MARK: Data of the WIP branch's build

    static let wipStorage: [String: String] = [
        "azkar:azkar-progress": ([
            "state": [
                "days": [:], "sessions": [:], "totals": ["quls": 4], "totalRecitations": 4, "history": [:],
                "afterPrayer": [
                    "days": ["2026-09-01": ["fajr": ["quls": 3], "noon": ["quls": 1]]],
                    "sessions": ["2026-09-01": ["fajr": ["completed": false, "done": 1, "total": 2, "recitations": 3, "startedAt": 1_788_210_000_000, "lastAt": 1_788_210_060_000]]],
                    "totals": ["quls": 3],
                ],
                "tasbih": [
                    "days": ["2026-09-01": ["presets": ["subhanallah": ["count": 40, "current": 7, "startedAt": 1_788_210_000_000, "lastAt": 1_788_211_000_000], "bad": ["count": 0, "current": 0]], "free": ["count": 5, "current": 5]]],
                    "totals": ["subhanallah": 140], "free": 5,
                ],
            ],
            "version": 3,
        ] as JSONValue).text,
        "azkar:fasting": ([
            "state": [
                "days": ["2026-03-01": ["kind": "ramadan", "status": "excused", "at": 1_772_330_000_000], "2026-03-02": ["kind": "ramadan", "status": "fasted"], "2026-03-03": ["kind": "fun", "status": "fasted"]],
                "owedBefore": 4,
            ],
            "version": 1,
        ] as JSONValue).text,
    ]

    @Test func afterPrayerTasbihAndFastsOfTheWIPBuildAreImported() async throws {
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        try await WebDataImport.runIfNeeded(from: try Self.capacitorDefaults(Self.wipStorage), into: store, settings: makeSettings())
        let records = try await store.snapshot()
        let first = try #require(records.sessions[day("2026-09-01")]?[.afterPrayer(.fajr)])
        #expect(first.recitations == 3 && first.startedAt == Date(epochMilliseconds: 1_788_210_000_000))
        #expect(records.counts[day("2026-09-01")] == [.afterPrayer(.fajr): ["quls": 3]])
        #expect(records.totals.afterPrayer == ["quls": 3] && records.totals.dhikr == ["quls": 4])
        #expect(records.tasbih[day("2026-09-01")]?["subhanallah"] == TasbihCount(startedAt: Date(epochMilliseconds: 1_788_210_000_000), lastAt: Date(epochMilliseconds: 1_788_211_000_000), count: 40, current: 7))
        #expect(records.tasbih[day("2026-09-01")]?[TasbihRecord.freeCount]?.count == 5)
        #expect(records.tasbih[day("2026-09-01")]?["bad"] == nil)
        #expect(records.totals.tasbih == ["subhanallah": 140] && records.totals.tasbihFree == 5)
        #expect(records.fasts == [
            day("2026-03-01"): FastRecord(kind: .ramadan, status: .excused, loggedAt: Date(epochMilliseconds: 1_772_330_000_000)),
            day("2026-03-02"): FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil),
        ])
        #expect(records.owedFastsBefore == 4)
    }

    @Test func recordsAnOlderBuildSavedOverAreTakenFromTheSpareCopy() async throws {
        // A version 2 build saved the store without the version 3 fields; the spare kept them.
        let full = JSONValue(parsing: Self.wipStorage["azkar:azkar-progress"]!)!
        var state = full["state"]!.object!
        let spare: JSONValue = ["afterPrayer": state["afterPrayer"]!, "tasbih": state["tasbih"]!]
        state["afterPrayer"] = nil
        state["tasbih"] = nil
        let storage = [
            "azkar:azkar-progress": (["state": .object(state), "version": 2] as JSONValue).text,
            "azkar:azkar-progress-spare": spare.text,
        ]
        let store = try makeStore(catalog: AzkarRecordTests.catalog)
        let report = try await WebDataImport.runIfNeeded(from: try Self.capacitorDefaults(storage), into: store, settings: makeSettings())
        let records = try await store.snapshot()
        #expect(records.totals.tasbih == ["subhanallah": 140])
        #expect(records.sessions[day("2026-09-01")]?[.afterPrayer(.fajr)] != nil)
        #expect(report.ignoredKeys.isEmpty)
    }
}
