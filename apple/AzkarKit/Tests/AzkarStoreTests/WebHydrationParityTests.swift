import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// Every kind of stored data the website can hold (every store version, bad values, unreadable
/// text, unexpected stamps, a restored backup) reads here exactly as a page load of the website
/// read it: hydration.json holds what the website's own stores loaded.
@Suite struct WebHydrationParityTests {
    struct Case: CustomTestStringConvertible, Sendable {
        let name: String
        let raw: JSONValue
        let expected: JSONValue
        let deviceTimeZone: String
        var testDescription: String { name }
    }

    static let cases: [Case] = {
        (try! Fixtures.json("hydration.json")).array!.map {
            Case(name: $0["name"]!.string!, raw: $0["raw"]!, expected: $0["expected"]!, deviceTimeZone: $0["deviceTimeZone"]!.string!)
        }
    }()

    /// The fields the main branch's stores save (what the website loaded is in that shape).
    static let progressFields = ["days", "sessions", "totals", "totalRecitations", "history"]
    static let prayerTimesFields = ["method", "madhab", "highLatitudeRule", "polar", "adjustments", "notifications", "azkarReminders"]

    @Test("Each store reads as the website reads it", arguments: cases)
    func readsLikeTheWebsite(_ fixture: Case) {
        let read = WebStores.read(Fixtures.entries(fixture.raw), catalog: Fixtures.catalog, deviceTimeZone: fixture.deviceTimeZone)
        let written = WebStores.write(records: read.records, settings: read.settings).mapValues { $0["state"]! }
        let expected = fixture.expected

        expectSameJSON(written["azkar:location"], expected["location"], "location")
        expectSameJSON(written["azkar:settings"], expected["settings"], "settings")
        expectSameJSON(written["azkar:prayer-times"]?.only(Self.prayerTimesFields), expected["prayer-times"], "prayer-times")
        expectSameJSON(written["azkar:prayer-log"], expected["prayer-log"], "prayer-log")
        expectSameJSON(written["azkar:azkar-progress"]?.only(Self.progressFields), expected["azkar-progress"], "azkar-progress")
        expectSameJSON(written["azkar:azkar-settings"]?.only(Array(ReaderSettings.mainBranchFields)), expected["azkar-settings"], "azkar-settings")
    }

    @Test func dataOfTheMainBranchHasNoAfterPrayerTasbihOrFastingRecords() {
        for fixture in Self.cases {
            let read = WebStores.read(Fixtures.entries(fixture.raw), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
            #expect(read.records.tasbih.isEmpty, "\(fixture.name)")
            #expect(read.records.fasts.isEmpty, "\(fixture.name)")
            #expect(read.records.sessions.values.allSatisfy { $0.keys.allSatisfy { !$0.isAfterPrayer } }, "\(fixture.name)")
        }
    }

    @Test func storesFoundAndKeysIgnoredAreReported() throws {
        let realistic = Self.cases.first { $0.name == "a realistic install" }!
        var raw = realistic.raw.object!
        raw["azkar:today-layout"] = .string(#"{"state":{"sunnahCollapsed":true},"version":1}"#)
        let read = WebStores.read(Fixtures.entries(.object(raw)), catalog: Fixtures.catalog, deviceTimeZone: "UTC")
        #expect(read.found == ["location", "settings", "prayer-times", "prayer-log", "azkar-progress", "azkar-settings"])
        #expect(read.ignored == ["azkar:today-layout"])
    }
}
