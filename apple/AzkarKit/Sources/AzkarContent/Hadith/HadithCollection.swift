import AzkarCore
import Foundation

/// One hadith of Riyad as-Salihin, as `scripts/hadith/build.mjs` copied it: the Arabic exactly as
/// the source gives it (vowelled or not), with the source note that ended it split off.
public struct Hadith: Hashable, Sendable, Identifiable, Decodable {
    /// 1 to 1896, as on sunnah.com.
    public let number: Int
    /// 0 for the Introduction, then 1 to 19.
    public let book: Int
    /// Its number within its book.
    public let inBook: Int
    public let text: String
    /// Who narrated it, as an-Nawawi notes it ("agreed upon", "narrated by Muslim"…); `nil` where
    /// the note is not at the end of the text and stays in it.
    public let source: String?

    public var id: Int { number }

    public init(number: Int, book: Int, inBook: Int, text: String, source: String?) {
        self.number = number
        self.book = book
        self.inBook = inBook
        self.text = text
        self.source = source
    }
}

/// One of the twenty books: the Introduction and the nineteen that follow it.
public struct HadithBook: Hashable, Sendable, Identifiable, Decodable {
    public let number: Int
    /// The Arabic title, as the source gives it.
    public let title: String
    /// A short English name, written for this project.
    public let english: String
    public let count: Int

    public var id: Int { number }
}

/// The Riyad as-Salihin library: the hadith in order, their books, a search that ignores vowel
/// marks, and the hadith of the day.
public final class HadithCollection: Sendable {
    public static let count = 1896

    public let version: Int
    public let sources: [AzkarSource]
    public let books: [HadithBook]
    /// By number: `hadith[n - 1]` is hadith `n`.
    public let hadith: [Hadith]
    /// Each hadith's text and source note, through `normalised`, for searching.
    private let index: [String]
    /// The hadith a day can bring forward: the shorter ones, in number order.
    private let daily: [Int]

    /// The longest text, in characters, that the hadith of the day is chosen among (about two
    /// thirds of the book): it is read on the Today screen, so a short one is preferred.
    public static let dailyLength = 300

    public struct Malformed: Error, Hashable, CustomStringConvertible {
        public var description: String
    }

    private struct Raw: Decodable {
        var version: Int
        var sources: [AzkarSource]
        var books: [HadithBook]
        var hadith: [Hadith]
    }

    public init(json: Data) throws {
        let raw = try JSONDecoder().decode(Raw.self, from: json)
        for (offset, item) in raw.hadith.enumerated() where item.number != offset + 1 {
            throw Malformed(description: "hadith \(offset + 1) is missing or out of order")
        }
        version = raw.version
        sources = raw.sources
        books = raw.books.sorted { $0.number < $1.number }
        hadith = raw.hadith
        index = raw.hadith.map { Self.normalised($0.text + " " + ($0.source ?? "")) }
        daily = raw.hadith.filter { $0.text.count <= Self.dailyLength }.map(\.number)
    }

    /// The bundled library, read on first use. Decoding takes a moment: touch it away from the main actor first.
    public static let bundled: HadithCollection = {
        do {
            guard let url = Bundle.module.url(forResource: "riyad", withExtension: "json") else {
                preconditionFailure("riyad.json is missing from the AzkarKit bundle")
            }
            return try HadithCollection(json: Data(contentsOf: url))
        } catch {
            preconditionFailure("The bundled riyad.json does not load: \(error)")
        }
    }()

    // MARK: Looking up

    public func hadith(number: Int) -> Hadith? {
        hadith.indices.contains(number - 1) ? hadith[number - 1] : nil
    }

    public func book(_ number: Int) -> HadithBook? {
        books.first { $0.number == number }
    }

    /// A book's hadith in their order in it.
    public func hadith(inBook book: Int) -> [Hadith] {
        hadith.filter { $0.book == book }.sorted { $0.inBook < $1.inBook }
    }

    // MARK: The hadith of the day

    /// The same hadith all day, a different one each day: the days walk through the shorter
    /// hadith with a fixed stride, so none comes back before every one of them has come.
    public func ofTheDay(_ day: DayKey) -> Hadith {
        let pool = daily.isEmpty ? hadith.map(\.number) : daily
        let step = Self.stride(for: pool.count)
        let index = Int((Int64(Self.dayNumber(day)) * Int64(step)).modulo(Int64(pool.count)))
        return hadith[pool[index] - 1]
    }

    /// A stride coprime with `count`, so that `day * stride mod count` visits every index.
    static func stride(for count: Int) -> Int {
        var step = 7919 // a prime: coprime with any count it does not divide
        while gcd(step, count) != 1 { step += 2 }
        return step
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int { b == 0 ? a : gcd(b, a % b) }

    /// Days since 1 January 1970 (the civil-from-days algorithm run backwards), without a calendar.
    static func dayNumber(_ day: DayKey) -> Int {
        let y = day.month <= 2 ? day.year - 1 : day.year
        let era = (y >= 0 ? y : y - 399) / 400
        let yearOfEra = y - era * 400
        let dayOfYear = (153 * (day.month + (day.month > 2 ? -3 : 9)) + 2) / 5 + day.day - 1
        let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
        return era * 146_097 + dayOfEra - 719_468
    }

    // MARK: Searching

    /// The hadith matching `query`, in number order: a number (in any digits) finds that hadith
    /// first; words find the hadith holding every one of them, whatever their vowel marks, tatweel
    /// or way of writing the hamza and alif.
    public func search(_ query: String, limit: Int = 300) -> [Hadith] {
        var results: [Hadith] = []
        let digits = Self.westernDigits(query).trimmingCharacters(in: .whitespacesAndNewlines)
        if let number = Int(digits), let found = hadith(number: number) {
            results.append(found)
        }
        let terms = Self.normalised(query).split(separator: " ").map(String.init).filter { Int($0) == nil }
        guard !terms.isEmpty else { return results }
        for (offset, text) in index.enumerated() where terms.allSatisfy(text.contains) {
            let found = hadith[offset]
            if found.number != results.first?.number { results.append(found) }
            if results.count >= limit { break }
        }
        return results
    }

    /// The hadith matching `query`, each with its text cut into matches for highlighting (starting
    /// shortly before the first match when that lies deep in a long hadith) and how many times the
    /// words occur in it.
    public func searchHits(_ query: String, limit: Int = 2000) -> [HadithSearchHit] {
        let terms = ArabicSearch.terms(query).filter { Int($0) == nil }
        return search(query, limit: limit).map { found in
            HadithSearchHit(hadith: found,
                            segments: ArabicSearch.segments(of: found.text, matching: terms, lead: 80),
                            occurrences: ArabicSearch.count(of: terms, in: found.text))
        }
    }

    /// Text as the search compares it (`ArabicSearch.normalised`).
    public static func normalised(_ text: String) -> String {
        ArabicSearch.normalised(text)
    }

    /// Arabic-Indic and Persian digits as 0-9; anything else unchanged.
    static func westernDigits(_ text: String) -> String {
        ArabicSearch.westernDigits(text)
    }
}

/// A hadith found by a search.
public struct HadithSearchHit: Hashable, Sendable, Identifiable {
    public let hadith: Hadith
    /// Its text cut into the words found and what lies between them.
    public let segments: [ArabicSearch.Segment]
    /// How many times the words typed occur in its text (0 when only its number was typed).
    public let occurrences: Int

    public var id: Int { hadith.number }
}

private extension Int64 {
    func modulo(_ divisor: Int64) -> Int64 {
        let remainder = self % divisor
        return remainder < 0 ? remainder + divisor : remainder
    }
}
