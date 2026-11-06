import Foundation

/// The duas the companion can show, by topic: whole chapters of Hisn al-Muslim on worry, fear,
/// distress and the like, copied by `scripts/azkar/build-comfort.mjs` from the source the azkar
/// dataset takes its text from. Never edit the file by hand; rebuild it with the script.
public struct ComfortDuas: Sendable {
    public struct Topic: Codable, Hashable, Sendable, Identifiable {
        /// A stable key, such as `worry_and_grief`.
        public var id: String
        /// The chapter's title in the book.
        public var titleAr: String
        /// The app's own heading for it.
        public var titleEn: String
        public var items: [Dua]
    }

    public struct Dua: Codable, Hashable, Sendable, Identifiable {
        /// The topic's key and its place in the chapter, such as `distress-3`.
        public var id: String
        /// Exactly as the source has it: the supplication, or what to do and say.
        public var text: String
        public var count: Int
        /// The book's citation.
        public var reference: String
    }

    public struct Source: Codable, Hashable, Sendable {
        public var name: String
        public var url: String
        public var license: String
    }

    public let topics: [Topic]
    public let source: Source
    private let byID: [String: Dua]

    public init(json data: Data) throws {
        struct File: Decodable {
            var source: Source
            var topics: [Topic]
        }
        let file = try JSONDecoder().decode(File.self, from: data)
        topics = file.topics
        source = file.source
        byID = Dictionary(file.topics.flatMap(\.items).map { ($0.id, $0) }) { first, _ in first }
    }

    public static let bundled: ComfortDuas = {
        do {
            guard let url = Bundle.module.url(forResource: "comfort-duas", withExtension: "json") else {
                preconditionFailure("comfort-duas.json is missing from the AzkarKit bundle")
            }
            return try ComfortDuas(json: Data(contentsOf: url))
        } catch {
            preconditionFailure("The bundled comfort duas could not be read: \(error)")
        }
    }()

    public func topic(_ id: String) -> Topic? { topics.first { $0.id == id } }

    public func dua(id: String) -> Dua? { byID[id] }

    /// The topic a dua belongs to.
    public func topic(ofDua id: String) -> Topic? { topics.first { $0.items.contains { $0.id == id } } }
}
