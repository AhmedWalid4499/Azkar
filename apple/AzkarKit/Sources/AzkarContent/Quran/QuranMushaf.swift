import Foundation

/// One ayah as Tanzil publishes it. The first ayah of most surahs carries the basmala in front.
public struct QuranAyah: Hashable, Sendable {
    public var sura: Int
    public var number: Int
    public var text: String
}

public struct QuranSura: Hashable, Sendable, Identifiable {
    public var number: Int
    /// In Arabic: "البقرة".
    public var name: String
    /// In Latin letters: "Al-Baqara".
    public var transliteration: String
    public var ayahCount: Int
    /// The page it begins on.
    public var page: Int

    public var id: Int { number }
}

public struct QuranJuz: Hashable, Sendable, Identifiable {
    public var number: Int
    public var page: Int
    public var sura: Int
    public var ayah: Int

    public var id: Int { number }
}

/// The Qur'an as the Medina Mushaf pages it: Tanzil's Uthmani text and metadata, both bundled
/// exactly as published (see `scripts/quran/fetch.mjs`).
public struct QuranMushaf: Sendable {
    public static let pageCount = 604
    public static let pages = 1...pageCount

    public let ayat: [QuranAyah]
    public let suras: [QuranSura]
    public let juz: [QuranJuz]
    /// Where each page starts in `ayat`, page 1 first.
    private let pageStarts: [Int]

    public struct Malformed: Error, Hashable, CustomStringConvertible {
        public var description: String
    }

    /// The bundled text. Parsing takes a few milliseconds: touch it away from the main actor first.
    public static let bundled: QuranMushaf = {
        do {
            let text = try String(contentsOf: QuranResources.textURL, encoding: .utf8)
            return try QuranMushaf(text: text, metadata: Data(contentsOf: QuranResources.metadataURL))
        } catch {
            preconditionFailure("The bundled Qur'an could not be read: \(error)")
        }
    }()

    /// Reads Tanzil's `sura|aya|text` lines and `quran-data.xml`.
    public init(text: String, metadata: Data) throws {
        var ayat: [QuranAyah] = []
        ayat.reserveCapacity(6236)
        var indexes: [Int: Int] = [:]
        for line in text.split(separator: "\n") where !line.hasPrefix("#") {
            let parts = line.split(separator: "|", maxSplits: 2)
            guard parts.count == 3, let sura = Int(parts[0]), let number = Int(parts[1]) else { continue }
            indexes[sura * 1000 + number] = ayat.count
            ayat.append(QuranAyah(sura: sura, number: number, text: String(parts[2]).trimmingCharacters(in: .whitespaces)))
        }
        let reader = QuranMetadataReader()
        let parser = XMLParser(data: metadata)
        parser.delegate = reader
        guard parser.parse() else { throw Malformed(description: "quran-data.xml cannot be read") }

        func index(_ sura: Int, _ ayah: Int) throws -> Int {
            guard let index = indexes[sura * 1000 + ayah] else { throw Malformed(description: "no ayah \(sura):\(ayah)") }
            return index
        }
        let pageStarts = try reader.pages.map { try index($0.sura, $0.ayah) }
        guard pageStarts.count == Self.pageCount else { throw Malformed(description: "\(pageStarts.count) pages") }
        func page(of index: Int) -> Int {
            var low = 0, high = pageStarts.count - 1
            while low < high {
                let middle = (low + high + 1) / 2
                if pageStarts[middle] <= index { low = middle } else { high = middle - 1 }
            }
            return low + 1
        }
        self.ayat = ayat
        self.pageStarts = pageStarts
        suras = try reader.suras.map {
            QuranSura(number: $0.number, name: $0.name, transliteration: $0.transliteration, ayahCount: $0.ayahCount, page: page(of: try index($0.number, 1)))
        }
        juz = try reader.juz.map { QuranJuz(number: $0.number, page: page(of: try index($0.sura, $0.ayah)), sura: $0.sura, ayah: $0.ayah) }
    }

    /// The ayat that begin on a page.
    public func ayat(onPage page: Int) -> ArraySlice<QuranAyah> {
        let start = pageStarts[page - 1]
        return ayat[start..<(page < Self.pageCount ? pageStarts[page] : ayat.count)]
    }

    /// The juz a page is in: the last that begins on it or before it.
    public func juz(ofPage page: Int) -> QuranJuz {
        juz.last { $0.page <= page } ?? juz[0]
    }

    /// The surah whose text a page opens with.
    public func sura(ofPage page: Int) -> QuranSura {
        suras[ayat[pageStarts[page - 1]].sura - 1]
    }
}

public enum QuranResources {
    static var textURL: URL { url("quran-uthmani", "txt") }
    static var metadataURL: URL { url("quran-data", "xml") }

    private static func url(_ name: String, _ type: String) -> URL {
        guard let url = Bundle.module.url(forResource: name, withExtension: type) else {
            preconditionFailure("\(name).\(type) is missing from the AzkarKit bundle")
        }
        return url
    }
}

/// Reads the suras, juz and page starts of `quran-data.xml`.
private final class QuranMetadataReader: NSObject, XMLParserDelegate {
    struct Sura {
        var number: Int
        var name: String
        var transliteration: String
        var ayahCount: Int
    }

    struct Start {
        var number: Int
        var sura: Int
        var ayah: Int
    }

    var suras: [Sura] = []
    var juz: [Start] = []
    var pages: [Start] = []

    func parser(_ parser: XMLParser, didStartElement element: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
        switch element {
        case "sura":
            guard let number = attributes["index"].flatMap(Int.init), let ayahCount = attributes["ayas"].flatMap(Int.init),
                  let name = attributes["name"], let transliteration = attributes["tname"] else { return }
            suras.append(Sura(number: number, name: name, transliteration: transliteration, ayahCount: ayahCount))
        case "juz":
            if let start = start(attributes) { juz.append(start) }
        case "page":
            if let start = start(attributes) { pages.append(start) }
        default:
            break
        }
    }

    private func start(_ attributes: [String: String]) -> Start? {
        guard let number = attributes["index"].flatMap(Int.init), let sura = attributes["sura"].flatMap(Int.init),
              let ayah = attributes["aya"].flatMap(Int.init) else { return nil }
        return Start(number: number, sura: sura, ayah: ayah)
    }
}
