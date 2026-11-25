import AzkarCore
import Foundation

/// How a word typed is matched against the Qur'an's words.
public enum QuranSearchMode: String, Hashable, Sendable, CaseIterable {
    /// Anywhere in a word: "رحم" finds الرحمن, رحمة and يرحمكم.
    case anywhere
    /// Only a whole word: "قال" finds قال, not قالوا or فقال.
    case wholeWord
}

/// An ayah found by a search.
public struct QuranSearchHit: Hashable, Sendable, Identifiable {
    public let sura: Int
    public let ayah: Int
    public let page: Int
    /// Its Uthmani text as the mushaf shows it (the basmala of a first ayah left out), cut into
    /// the words found and what lies between them.
    public let segments: [ArabicSearch.Segment]
    /// How many times what was typed occurs in it.
    public let occurrences: Int

    public var id: Int { sura * 1000 + ayah }
    public var ref: AyahRef { AyahRef(sura: sura, ayah: ayah) }
}

/// What a search found: the surahs whose name or number was typed, an ayah given by its
/// reference ("2:255"), and every ayah holding what was typed, in mushaf order.
public struct QuranSearchResults: Sendable {
    public var suras: [QuranSura] = []
    public var reference: QuranSearchHit?
    public var hits: [QuranSearchHit] = []
    /// How many times what was typed occurs in all the ayat found.
    public var occurrences = 0

    public var isEmpty: Bool { suras.isEmpty && reference == nil && hits.isEmpty }

    /// The ayat found, by surah, in mushaf order.
    public var hitsBySura: [(sura: Int, hits: [QuranSearchHit])] {
        var groups: [(sura: Int, hits: [QuranSearchHit])] = []
        for hit in hits {
            if groups.last?.sura == hit.sura {
                groups[groups.count - 1].hits.append(hit)
            } else {
                groups.append((hit.sura, [hit]))
            }
        }
        return groups
    }
}

/// Searches the Qur'an by word, by surah name or number, or by reference.
///
/// Words are matched against Tanzil's Simple Clean text (everyday spelling, no marks), so that
/// "الصلاة" typed as usual finds the Uthmani "ٱلصَّلَوٰةَ"; results are shown in the Uthmani text,
/// with the words found highlighted by their place in the ayah. The Simple Clean text is never shown.
public final class QuranSearch: Sendable {
    private let mushaf: QuranMushaf
    /// Each ayah's Simple Clean words, the basmala in front of a first ayah left out.
    private let words: [[String]]
    /// The same, folded for searching (`ArabicSearch.fold`), words one space apart.
    private let folded: [[Unicode.Scalar]]

    public struct Malformed: Error, Hashable, CustomStringConvertible {
        public var description: String
    }

    /// The bundled search text. Reading it takes a moment: touch it away from the main actor first.
    public static let bundled: QuranSearch = {
        do {
            let text = try String(contentsOf: QuranResources.searchTextURL, encoding: .utf8)
            return try QuranSearch(mushaf: .bundled, searchText: text)
        } catch {
            preconditionFailure("The bundled Qur'an search text could not be read: \(error)")
        }
    }()

    /// Reads Tanzil's Simple Clean `sura|aya|text` lines, which must hold the same ayat as `mushaf`.
    public init(mushaf: QuranMushaf, searchText: String) throws {
        var words: [[String]] = []
        words.reserveCapacity(mushaf.ayat.count)
        for line in searchText.split(separator: "\n") where !line.hasPrefix("#") {
            let parts = line.split(separator: "|", maxSplits: 2)
            guard parts.count == 3, let sura = Int(parts[0]), let number = Int(parts[1]) else { continue }
            guard words.count < mushaf.ayat.count, mushaf.ayat[words.count].sura == sura, mushaf.ayat[words.count].number == number else {
                throw Malformed(description: "\(sura):\(number) is not where the Uthmani text has it")
            }
            var ayahWords = parts[2].split(separator: " ").map(String.init)
            if Self.hasBasmala(sura: sura, ayah: number), ayahWords.count > 4 { ayahWords.removeFirst(4) }
            words.append(ayahWords)
        }
        guard words.count == mushaf.ayat.count else { throw Malformed(description: "\(words.count) ayat") }
        self.mushaf = mushaf
        self.words = words
        folded = words.map { ArabicSearch.fold($0.joined(separator: " ")).scalars }
    }

    /// A first ayah carries the basmala in front, except in al-Fatiha (where it is the ayah) and At-Tawba.
    static func hasBasmala(sura: Int, ayah: Int) -> Bool { ayah == 1 && sura != 1 && sura != 9 }

    // MARK: Searching

    public func search(_ query: String, mode: QuranSearchMode = .anywhere) -> QuranSearchResults {
        var results = QuranSearchResults()
        let typed = ArabicSearch.westernDigits(query).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typed.isEmpty else { return results }

        if let ref = Self.reference(typed), let index = mushaf.ayat.firstIndex(where: { $0.sura == ref.sura && $0.number == ref.ayah }) {
            results.reference = hit(index, matches: [])
            return results
        }
        results.suras = suras(matching: typed)
        if Int(typed) != nil { return results }

        let phrase = ArabicSearch.normalised(typed)
        // "سورة البقرة" looks for the surah, not for the words.
        if phrase.hasPrefix("سوره ") { return results }
        guard phrase.unicodeScalars.contains(where: { (0x0600...0x06FF).contains($0.value) }) else { return results }
        for index in folded.indices {
            let matches = ArabicSearch.matches(of: [phrase], in: folded[index], wholeWords: mode == .wholeWord)
            guard !matches.isEmpty else { continue }
            results.hits.append(hit(index, matches: matches))
            results.occurrences += matches.count
        }
        return results
    }

    /// A reference typed as "2:255" (or with a dot, dash, slash or space between).
    static func reference(_ typed: String) -> AyahRef? {
        let parts = typed.split(whereSeparator: { ":.-/ ،".contains($0) })
        guard parts.count == 2, let sura = Int(parts[0]), let ayah = Int(parts[1]) else { return nil }
        guard (1...114).contains(sura), ayah >= 1 else { return nil }
        return AyahRef(sura: sura, ayah: ayah)
    }

    /// The surahs whose number, Arabic name, name in Latin letters or English meaning was typed.
    func suras(matching typed: String) -> [QuranSura] {
        if let number = Int(typed) {
            return (1...114).contains(number) ? [mushaf.suras[number - 1]] : []
        }
        var arabic = ArabicSearch.normalised(typed)
        if arabic.hasPrefix("سوره ") { arabic.removeFirst(5) }
        let latin = Self.latinKey(typed)
        return mushaf.suras.filter { sura in
            if !arabic.isEmpty, arabic.unicodeScalars.contains(where: { (0x0600...0x06FF).contains($0.value) }) {
                let name = ArabicSearch.normalised(sura.name)
                return name.contains(arabic) || name.replacingOccurrences(of: "ال", with: "").contains(arabic.replacingOccurrences(of: "ال", with: ""))
            }
            guard latin.count >= 2 else { return false }
            return Self.latinKey(sura.transliteration).contains(latin) || Self.latinKey(sura.english).contains(latin)
        }
    }

    /// Latin letters only, lower case, each run of one letter as one: "Al-Faatiha" and "al fatiha"
    /// both read "alfatiha".
    static func latinKey(_ text: String) -> String {
        var out = ""
        for character in text.lowercased() where character.isASCII && character.isLetter {
            if out.last != character { out.append(character) }
        }
        return out
    }

    // MARK: Showing a hit

    private func hit(_ index: Int, matches: [Range<Int>]) -> QuranSearchHit {
        let ayah = mushaf.ayat[index]
        var text = ayah.text
        if Self.hasBasmala(sura: ayah.sura, ayah: ayah.number), let parts = QuranMushaf.splitBasmala(ayah) { text = parts.rest }
        let tokens = QuranTypesetting.displayText(text).split(separator: " ").map(String.init)
        // The number of each token that is a word; signs standing alone (۞, ۩) are none.
        var wordOfToken: [Int?] = []
        var displayWords: [String] = []
        for token in tokens {
            if token.unicodeScalars.contains(where: { $0.properties.isAlphabetic && !ArabicSearch.isIgnored($0.value) }) {
                wordOfToken.append(displayWords.count)
                displayWords.append(token)
            } else {
                wordOfToken.append(nil)
            }
        }
        var found = Set<Int>()
        if !matches.isEmpty, let map = Self.align(clean: words[index], display: displayWords) {
            let scalars = folded[index]
            func word(at position: Int) -> Int { scalars[..<position].reduce(0) { $1 == " " ? $0 + 1 : $0 } }
            for match in matches {
                for cleanWord in word(at: match.lowerBound)...word(at: match.upperBound - 1) where cleanWord < map.count {
                    found.insert(map[cleanWord])
                }
            }
        }
        var segments: [ArabicSearch.Segment] = []
        for (offset, token) in tokens.enumerated() {
            let isMatch = wordOfToken[offset].map(found.contains) ?? false
            if let last = segments.last, last.isMatch == isMatch {
                segments[segments.count - 1].text += " " + token
            } else if let last = segments.last {
                // The space between goes with the text that is not highlighted.
                if last.isMatch {
                    segments.append(ArabicSearch.Segment(text: " " + token, isMatch: false))
                } else {
                    segments[segments.count - 1].text += " "
                    segments.append(ArabicSearch.Segment(text: token, isMatch: true))
                }
            } else {
                segments.append(ArabicSearch.Segment(text: token, isMatch: isMatch))
            }
        }
        return QuranSearchHit(sura: ayah.sura, ayah: ayah.number, page: mushaf.page(of: AyahRef(sura: ayah.sura, ayah: ayah.number)),
                              segments: segments, occurrences: matches.count)
    }

    /// Which Uthmani word each Simple Clean word is part of. Mostly one for one; but the Uthmani
    /// script joins the vocative and the "ha" of attention to their word ("يَٰٓأَيُّهَا" for "يا أيها",
    /// "هَٰٓأَنتُمْ" for "ها أنتم"). `nil` where the two still do not line up (as in 20:94 and 72:16):
    /// such an ayah is found but shown without highlighting.
    static func align(clean: [String], display: [String]) -> [Int]? {
        if clean.count == display.count { return Array(clean.indices) }
        let joined: Set<String> = ["يا", "ويا", "ها"]
        var map: [Int] = []
        var i = 0, j = 0
        while i < clean.count {
            guard j < display.count else { return nil }
            if joined.contains(clean[i]), i + 1 < clean.count, clean.count - i > display.count - j,
               !joined.contains(ArabicSearch.normalised(display[j])) {
                map += [j, j]
                i += 2
            } else {
                map.append(j)
                i += 1
            }
            j += 1
        }
        return j == display.count ? map : nil
    }
}
