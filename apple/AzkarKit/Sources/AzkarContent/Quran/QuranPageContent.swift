import Foundation

/// What one mushaf page holds, in reading order. Only how the text is set differs from Tanzil's:
/// the basmala stands on its own line and each ayah ends in its numbered sign.
public enum QuranPageBlock: Hashable, Sendable {
    case suraHeader(QuranSura)
    case basmala(String)
    case ayat([QuranPageAyah])
}

public struct QuranPageAyah: Hashable, Sendable {
    public var sura: Int
    public var number: Int
    /// The ayah's text, without the basmala when that stands on its own line.
    public var text: String
}

public extension QuranMushaf {
    func content(ofPage page: Int) -> [QuranPageBlock] {
        var blocks: [QuranPageBlock] = []
        var run: [QuranPageAyah] = []
        func closeRun() {
            if !run.isEmpty { blocks.append(.ayat(run)) }
            run = []
        }
        for ayah in ayat(onPage: page) {
            var text = ayah.text
            if ayah.number == 1 {
                closeRun()
                blocks.append(.suraHeader(suras[ayah.sura - 1]))
                if let parts = Self.splitBasmala(ayah) {
                    blocks.append(.basmala(parts.basmala))
                    text = parts.rest
                }
            }
            run.append(QuranPageAyah(sura: ayah.sura, number: ayah.number, text: text))
        }
        closeRun()
        return blocks
    }

    /// The basmala in front of a surah's first ayah: its first four words. Al-Fatiha's is an ayah
    /// itself, and At-Tawba has none. (Tanzil writes it with a shadda in surahs 95 and 97.)
    static func splitBasmala(_ ayah: QuranAyah) -> (basmala: String, rest: String)? {
        guard ayah.number == 1, ayah.sura != 1, ayah.sura != 9 else { return nil }
        let words = ayah.text.split(separator: " ", omittingEmptySubsequences: false)
        guard words.count > 4 else { return nil }
        return (words.prefix(4).joined(separator: " "), words.dropFirst(4).joined(separator: " "))
    }
}

/// How an ayah is set on the page.
public enum QuranTypesetting {
    /// The pause marks (U+06D6 to U+06DC).
    public static func isPauseMark(_ scalar: UInt32) -> Bool { (0x06D6...0x06DC).contains(scalar) }

    /// Tanzil leaves a space before each pause mark. Dropped for display, so the mark sits on its
    /// word as in the printed mushaf. The stored text is never changed.
    public static func displayText(_ text: String) -> String {
        let scalars = Array(text.unicodeScalars)
        var shown = String.UnicodeScalarView()
        for (index, scalar) in scalars.enumerated() {
            if scalar == " ", index + 1 < scalars.count, isPauseMark(scalars[index + 1].value) { continue }
            shown.append(scalar)
        }
        return String(shown)
    }

    /// The ayah sign with its number in Arabic-Indic digits, which the font sets inside it.
    public static func ayahEnd(_ number: Int) -> String {
        let digits = String(number).unicodeScalars.map { String(UnicodeScalar(0x0660 + $0.value - 0x30)!) }.joined()
        return "\u{00A0}\u{06DD}\(digits)"
    }

    /// A run of ayat as one paragraph.
    public static func paragraph(_ ayat: [QuranPageAyah]) -> String {
        ayat.map { displayText($0.text) + ayahEnd($0.number) }.joined(separator: " ")
    }
}
