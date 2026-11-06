import AzkarContent
import AzkarStore
import Foundation

/// The tools the companion may call. They only read the app's own texts, so every word of the
/// Quran or of a dua the person sees is copied from those texts, never typed by Claude.
public struct CompanionTools: Sendable {
    /// Verses shown at once, at most.
    public static let maxAyat = 10

    let duas: ComfortDuas
    let mushaf: QuranMushaf

    public init(duas: ComfortDuas = .bundled, mushaf: QuranMushaf = .bundled) {
        self.duas = duas
        self.mushaf = mushaf
    }

    /// What a tool call gave: the text sent back to Claude, and the card it shows, if any.
    public struct Outcome: Hashable, Sendable {
        public var result: String
        public var isError: Bool
        public var card: CompanionCard?
    }

    /// The definitions sent with every request, in a fixed order so the cached prefix holds.
    var definitions: [JSONValue] {
        [
            [
                "name": "find_duas",
                "description": "List the verified duas the app holds on one topic, each with its id, its exact Arabic text, how many times it is said and its citation. Call this before show_dua; only the ids it returns can be shown.",
                "strict": true,
                "input_schema": [
                    "type": "object",
                    "properties": [
                        "topic": ["type": "string", "enum": .array(duas.topics.map { .string($0.id) }), "description": "The topic closest to what the person is going through."],
                    ],
                    "required": ["topic"],
                    "additionalProperties": false,
                ],
            ],
            [
                "name": "show_dua",
                "description": "Show one of the app's verified duas to the person as a card under your reply, with its exact text and citation. Use an id that find_duas returned.",
                "strict": true,
                "input_schema": [
                    "type": "object",
                    "properties": ["id": ["type": "string", "description": "The dua's id, such as distress-1."]],
                    "required": ["id"],
                    "additionalProperties": false,
                ],
            ],
            [
                "name": "show_quran",
                "description": .string("Show Quran verses to the person as a card under your reply, from the app's own copy of the Quran (the Tanzil Uthmani text). Up to \(Self.maxAyat) consecutive verses of one surah. The result gives you the exact text that was shown."),
                "strict": true,
                "input_schema": [
                    "type": "object",
                    "properties": [
                        "surah": ["type": "integer", "description": "The surah's number, 1 to 114."],
                        "from_ayah": ["type": "integer", "description": "The first verse to show."],
                        "to_ayah": ["type": "integer", "description": "The last verse to show; the same as from_ayah for one verse."],
                    ],
                    "required": ["surah", "from_ayah", "to_ayah"],
                    "additionalProperties": false,
                ],
            ],
        ]
    }

    /// Runs one tool call. Anything malformed comes back as an error Claude can correct.
    public func run(_ name: String, input: JSONValue) -> Outcome {
        switch name {
        case "find_duas":
            guard let id = input["topic"]?.string, let topic = duas.topic(id) else {
                return Outcome(result: "Unknown topic. Use one of: \(duas.topics.map(\.id).joined(separator: ", ")).", isError: true)
            }
            let lines = topic.items.map { "[\($0.id)] \($0.text) (said \($0.count) time\($0.count == 1 ? "" : "s"); \($0.reference))" }
            return Outcome(result: "\(topic.titleEn) (\(topic.titleAr)):\n" + lines.joined(separator: "\n"), isError: false)
        case "show_dua":
            guard let id = input["id"]?.string, let dua = duas.dua(id: id), let topic = duas.topic(ofDua: id) else {
                return Outcome(result: "No dua has that id. Call find_duas to see the ids.", isError: true)
            }
            return Outcome(result: "Shown to the person: \(dua.text)", isError: false, card: .dua(dua, topic: topic))
        case "show_quran":
            guard let sura = int(input["surah"]), let from = int(input["from_ayah"]), let to = int(input["to_ayah"]) else {
                return Outcome(result: "surah, from_ayah and to_ayah must be whole numbers.", isError: true)
            }
            guard to - from < Self.maxAyat else {
                return Outcome(result: "Show at most \(Self.maxAyat) verses at once.", isError: true)
            }
            guard let ayat = mushaf.ayat(sura: sura, from: from, to: to) else {
                let count = (1...mushaf.suras.count).contains(sura) ? " Surah \(sura) has \(mushaf.suras[sura - 1].ayahCount) verses." : " There are 114 surahs."
                return Outcome(result: "Those verses are not in the Quran." + count, isError: true)
            }
            let name = mushaf.suras[sura - 1].transliteration
            let text = ayat.map { "\($0.text) (\($0.number))" }.joined(separator: " ")
            return Outcome(result: "Shown to the person, Surah \(name) (\(sura)), verses \(from)–\(to): \(text)", isError: false,
                           card: .quran(sura: sura, from: from, to: to, ayat: Array(ayat)))
        default:
            return Outcome(result: "There is no tool called \(name).", isError: true)
        }
    }

    /// The card a past call showed, worked out again from its input, for the transcript.
    func card(_ name: String, input: JSONValue) -> CompanionCard? {
        guard name == "show_dua" || name == "show_quran" else { return nil }
        return run(name, input: input).card
    }

    private func int(_ value: JSONValue?) -> Int? {
        guard let number = value?.number, number.rounded() == number, abs(number) < 1_000_000 else { return nil }
        return Int(number)
    }
}
