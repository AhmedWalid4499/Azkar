import AzkarCore
import Foundation

/// The duas for occasions: the chapters of Hisn al-Muslim that are not read as a daily session,
/// grouped by theme. Built by `scripts/azkar/build-occasions.mjs` into `occasions.json`; its
/// Arabic is copied from the book's pinned digital text, never typed by hand.
///
/// An entry with `repeat` 0 is guidance (what to do, or a narration of what was done): it is
/// shown, not counted. The others are counted with the tasbih counter's records, under their id
/// (`TasbihRecord.isOccasion`).
public struct OccasionsBook: Hashable, Sendable {
    public struct Theme: Codable, Hashable, Sendable, Identifiable {
        public var id: String
        /// English; the app has the Arabic in its string table, by `id`.
        public var title: String
        public var chapters: [Int]
    }

    public struct Chapter: Codable, Hashable, Sendable, Identifiable {
        /// Its number in the book, from 1.
        public var number: Int
        public var theme: String
        public var title: BilingualText
        public var items: [String]

        public var id: Int { number }
    }

    public var version: Int
    public var sources: [AzkarSource]
    public var themes: [Theme]
    public var chapters: [Chapter]
    public var items: [String: Dhikr]

    public init(json data: Data) throws {
        let raw = try JSONDecoder().decode(Raw.self, from: data)
        version = raw.version
        sources = raw.sources
        themes = raw.themes
        chapters = raw.chapters
        items = raw.items
        for chapter in chapters {
            for id in chapter.items where items[id] == nil {
                throw AzkarDataset.UnknownDhikr(list: "Occasion chapter \(chapter.number)", id: id)
            }
        }
    }

    private struct Raw: Decodable {
        var version: Int
        var sources: [AzkarSource]
        var themes: [Theme]
        var chapters: [Chapter]
        var items: [String: Dhikr]
    }

    /// The book bundled with the app. A broken bundle is a build error, which the tests catch.
    public static let bundled: OccasionsBook = {
        do {
            return try OccasionsBook(json: Data(contentsOf: AzkarResources.occasionsURL))
        } catch {
            preconditionFailure("The bundled occasions.json does not load: \(error)")
        }
    }()

    // MARK: - Reading

    public func chapter(_ number: Int) -> Chapter? { chapters.first { $0.number == number } }

    public func chapters(in theme: Theme) -> [Chapter] { theme.chapters.compactMap(chapter) }

    public func entries(of chapter: Chapter) -> [Dhikr] { chapter.items.compactMap { items[$0] } }

    /// The chapter an entry belongs to.
    public func chapter(ofItem id: String) -> Chapter? { chapters.first { $0.items.contains(id) } }

    /// Whether the entry is words to say, which are counted.
    public static func isRecited(_ dhikr: Dhikr) -> Bool { dhikr.repeat > 0 }

    /// Chapters whose title, or any of whose entries, matches `query`: Arabic is compared without
    /// its vowel marks, English and transliteration without case or diacritics. In book order.
    public func search(_ query: String) -> [Chapter] {
        let needle = Self.searchKey(query)
        guard !needle.isEmpty else { return [] }
        return chapters
            .filter { chapter in
                let texts = [chapter.title.en, chapter.title.ar] + entries(of: chapter).flatMap { [$0.arabic, $0.translation, $0.transliteration ?? ""] }
                return texts.contains { Self.searchKey($0).contains(needle) }
            }
            .sorted { $0.number < $1.number }
    }

    /// Text reduced for matching: Arabic marks, tatweel and the shapes of alef, ya and ta marbuta
    /// unified; Latin folded to plain lower case.
    public static func searchKey(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil).unicodeScalars {
            switch scalar.value {
            case 0x064B...0x065F, 0x0670, 0x06D6...0x06ED, 0x0640: continue
            case 0x0622, 0x0623, 0x0625, 0x0671: out.append("\u{0627}")
            case 0x0649: out.append("\u{064A}")
            case 0x0629: out.append("\u{0647}")
            case 0x02BE, 0x02BF, 0x2018, 0x2019, 0x0027, 0x002D: continue
            default: out.append(scalar)
            }
        }
        return String(out).split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
