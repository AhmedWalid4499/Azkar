import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("The azkar dataset")
struct DatasetTests {
    @Test("The bundled dataset decodes with every list it has, each id resolved")
    func bundledDecodes() throws {
        let dataset = AzkarDataset.bundled
        let raw = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: AzkarResources.datasetURL)) as? [String: Any])
        let items = try #require(raw["items"] as? [String: Any])
        let collections = try #require(raw["collections"] as? [String: [String]])
        #expect(dataset.items.count == items.count)
        #expect(dataset.version == raw["version"] as? Int)
        #expect(dataset.sources.count == (raw["sources"] as? [Any])?.count)
        for session in AzkarSession.regular {
            #expect(dataset.azkar(for: session).map(\.id) == (collections[session.description] ?? []))
        }
        #expect(dataset.afterPrayerIDs == (raw["afterPrayer"] as? [String] ?? []))
        #expect(dataset.tasbihPresets.map(\.id) == (raw["tasbih"] as? [String] ?? []))
        #expect(dataset.azkar(for: .morning).count >= 20)
        #expect(dataset.availableCollections.starts(with: [.morning, .evening]))
    }

    @Test("Accessors give what the website's give, on the web branch's fuller dataset")
    func parityWithWebAccessors() throws {
        struct Expected: Decodable {
            var availableCollections: [String]
            var collections: [String: [String]]
            var afterPrayer: [String: [[AnyCodable]]]
            var tasbih: [String]
        }
        let dataset = try AzkarDataset(json: Data(contentsOf: Fixtures.url("web-branch-azkar.json")))
        let expected = try Fixtures.load(Expected.self, "dataset.json")
        #expect(dataset.availableCollections.map(\.description) == expected.availableCollections)
        for session in AzkarSession.regular {
            #expect(dataset.azkar(for: session).map(\.id) == expected.collections[session.description])
        }
        for prayer in Prayer.allCases {
            let azkar = dataset.afterPrayerAzkar(for: prayer)
            let rows = try #require(expected.afterPrayer[prayer.rawValue])
            #expect(azkar.map(\.id) == rows.map { $0[0].string ?? "" }, "\(prayer)")
            #expect(azkar.map(\.repeat) == rows.map { $0[1].int ?? -1 }, "\(prayer)")
            #expect(dataset.azkar(for: .afterPrayer(prayer)) == azkar)
        }
        #expect(dataset.tasbihPresets.map(\.id) == expected.tasbih)
        #expect(dataset.availableAfterPrayers == Prayer.allCases.filter { !(expected.afterPrayer[$0.rawValue] ?? []).isEmpty })
    }

    @Test("After a prayer, a dhikr appears only after its prayers, with its count for that prayer")
    func afterPrayerRules() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        #expect(dataset.afterPrayerAzkar(for: .fajr).map(\.id) == ["kursi", "tahlil-ten", "muawwidhat"])
        #expect(dataset.afterPrayerAzkar(for: .dhuhr).map(\.id) == ["kursi", "muawwidhat"])
        #expect(dataset.afterPrayerAzkar(for: .maghrib).map(\.repeat) == [1, 10, 3])
        #expect(dataset.afterPrayerAzkar(for: .isha).map(\.repeat) == [1, 1])
        // A name that is not a prayer is ignored, in the list of prayers and in the counts.
        #expect(dataset.dhikr(id: "tahlil-ten")?.afterPrayer?.prayers == [.fajr, .maghrib])
        #expect(dataset.dhikr(id: "muawwidhat")?.afterPrayer?.repeatCounts == [.fajr: 3, .maghrib: 3])
        #expect(dataset.availableAfterPrayers == Prayer.allCases)
    }

    @Test("After a prayer a dhikr carries the narration of that place; elsewhere its own")
    func afterPrayerNarration() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        let after = try #require(dataset.afterPrayerAzkar(for: .asr).first)
        #expect(after.reference.en == "After-prayer reference 100")
        #expect(after.virtue?.en == "Morning virtue")
        #expect(dataset.azkar(for: .morning).first?.reference.en == "Morning reference 1")
    }

    @Test("Sessions without content are not offered, and unknown lists and fields are ignored")
    func availability() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        #expect(dataset.availableCollections == [.morning, .sleep])
        #expect(dataset.azkar(for: .evening).isEmpty)
        #expect(dataset.collections.count == 3)
        #expect(dataset.tasbihPresets.map(\.id) == ["subhanallah", "alhamdulillah"])
        #expect(dataset.dhikr(id: "kursi")?.quran == [QuranRef(surah: 2, from: 255, to: 255)])
    }

    @Test("A dataset without the after-prayer, bedtime or tasbih lists has them empty")
    func missingListsAreEmpty() throws {
        let json = Data("""
        { "version": 1, "sources": [], "items": { "a": { "id": "a", "arabic": "x", "translation": "t", "repeat": 1,
          "reference": { "en": "", "ar": "" } } }, "collections": { "morning": ["a"] } }
        """.utf8)
        let dataset = try AzkarDataset(json: json)
        #expect(dataset.availableCollections == [.morning])
        #expect(dataset.availableAfterPrayers.isEmpty)
        for prayer in Prayer.allCases { #expect(dataset.afterPrayerAzkar(for: prayer).isEmpty) }
        #expect(dataset.tasbihPresets.isEmpty)
        #expect(dataset.azkar(for: .sleep).isEmpty)
    }

    @Test("A list naming a dhikr the dataset does not have is an error, as on the website")
    func unknownDhikr() {
        let json = Data("""
        { "version": 1, "sources": [], "items": {}, "collections": {}, "tasbih": ["missing"] }
        """.utf8)
        #expect(throws: AzkarDataset.UnknownDhikr(list: "The tasbih list", id: "missing")) { try AzkarDataset(json: json) }
        let session = Data(#"{ "version": 1, "sources": [], "items": {}, "collections": { "evening": ["x"] } }"#.utf8)
        #expect(throws: AzkarDataset.UnknownDhikr(list: "Collection \"evening\"", id: "x")) { try AzkarDataset(json: session) }
    }

    @Test("Snippets come from the dataset's text, and an id it no longer has gives none")
    func snippets() throws {
        let dataset = try AzkarDataset(json: DatasetFixture.json)
        #expect(dataset.snippet(id: "subhanallah") == "subhanallah-text one two three four five …")
        #expect(dataset.snippet(id: "gone") == nil)
    }
}

/// A JSON value of a heterogeneous array, as the website's `[id, repeat]` pairs.
struct AnyCodable: Decodable {
    var string: String?
    var int: Int?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        string = try? container.decode(String.self)
        int = try? container.decode(Int.self)
    }
}
