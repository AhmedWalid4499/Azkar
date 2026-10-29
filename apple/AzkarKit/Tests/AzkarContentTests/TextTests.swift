import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite("Display text")
struct TextTests {
    struct Segment: Decodable {
        var text: String?
        var word: String?
        var mark: String?
        var sign: String?

        var segment: RecitationSegment {
            if let text { return .text(text) }
            if let sign { return .signGroup(word: word!, sign: sign) }
            return .pauseGroup(word: word!, mark: mark!)
        }
    }

    struct Recitation: Decodable {
        var text: String
        var snippet: String
        var short: Bool
        var segments: [Segment]
    }

    struct Prose: Decodable {
        var field: BilingualText
        var en: String
        var ar: String
        var arWestern: String
    }

    struct Fixture: Decodable {
        var recitations: [Recitation]
        var prose: [Prose]
        var digits: [String]
    }

    static func load() throws -> Fixture { try Fixtures.load(Fixture.self, "text.json") }

    /// Strings compared scalar for scalar: Swift's `==` would equate canonically equivalent text.
    static func scalars(_ text: String) -> [UInt32] { text.unicodeScalars.map(\.value) }

    @Test("Each pause mark stays with its word exactly as the website's Recitation splits the text")
    func recitationSegments() throws {
        let fixture = try Self.load()
        #expect(fixture.recitations.count > 50)
        for expected in fixture.recitations {
            let segments = RecitationText.segments(expected.text)
            #expect(segments == expected.segments.map(\.segment), "\(expected.text.prefix(30))")
            #expect(Self.scalars(segments.map(\.source).joined()) == Self.scalars(expected.text), "the text is unchanged")
        }
    }

    @Test("The bundled dataset's Qur'anic passages keep every pause mark with a word")
    func bundledPauseMarks() {
        let marks = AzkarDataset.bundled.items.values.flatMap { RecitationText.segments($0.arabic) }.filter {
            if case .pauseGroup = $0 { true } else { false }
        }
        #expect(!marks.isEmpty)
    }

    @Test("The sajdah sign stays with its word and the rub' al-hizb sign stays in the text, neither taken for a pause mark")
    func bundledQuranSigns() throws {
        let lines = try #require(AzkarDataset.bundled.items["surah-as-sajdah"]).arabic.components(separatedBy: "\n")
        let prostration = RecitationText.segments(lines[15])
        guard case let .signGroup(_, sign)? = prostration.last else {
            Issue.record("32:15 does not end in a sign group: \(prostration)")
            return
        }
        #expect(Self.scalars(sign) == [0x20, 0x06E9])
        let quarter = RecitationText.segments(lines[11])
        guard case let .text(opening)? = quarter.first else {
            Issue.record("32:11 does not open with plain text: \(quarter)")
            return
        }
        #expect(Array(Self.scalars(opening).prefix(2)) == [0x06DE, 0x20])
        for segment in AzkarDataset.bundled.items.values.flatMap({ RecitationText.segments($0.arabic) }) {
            if case let .pauseGroup(_, mark) = segment {
                #expect(!mark.unicodeScalars.contains { $0.value == 0x06DE || $0.value == 0x06E9 })
            }
        }
    }

    @Test("Snippets and short passages match the website's")
    func snippetsAndShortPassages() throws {
        for expected in try Self.load().recitations {
            #expect(Self.scalars(RecitationText.snippet(expected.text)) == Self.scalars(expected.snippet), "\(expected.text.prefix(30))")
            #expect(RecitationText.isShortPassage(expected.text) == expected.short, "\(expected.text.prefix(30))")
        }
    }

    @Test("Prose shows the interface language's side, in Arabic with Arabic-Indic digits when asked")
    func prose() throws {
        let fixture = try Self.load()
        for expected in fixture.prose {
            #expect(expected.field.prose(for: .english) == expected.en)
            #expect(expected.field.prose(for: .arabic) == expected.ar, "\(expected.field)")
            #expect(expected.field.prose(for: .arabicWesternDigits) == expected.arWestern)
        }
        #expect(ProseText.arabicIndicDigits(fixture.digits[0]) == fixture.digits[1])
        #expect(BilingualText(en: "No. 3", ar: " ").prose(for: .arabic) == "No. 3", "an English fallback keeps its digits")
    }

    @Test("Numbers are written in the locale's digits")
    func numbers() {
        #expect(DisplayLocale.arabic.number(1448) == ProseText.arabicIndicDigits("1448"))
        #expect(DisplayLocale.arabicWesternDigits.number(1448) == "1448")
        #expect(DisplayLocale(language: .en, arabicIndicDigits: true).number(-12) == "-12")
    }
}
