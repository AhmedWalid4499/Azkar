import Foundation

/// Searching Arabic text as it is typed: vowel marks, Qur'anic marks and tatweel ignored, the ways
/// of writing the hamza and alif taken as one, and every match traced back to the original text so
/// it can be highlighted there. Shared by the Qur'an and the hadith search.
public enum ArabicSearch {
    /// A piece of a text shown in a result: either a match or what lies between matches.
    public struct Segment: Hashable, Sendable {
        public var text: String
        public var isMatch: Bool

        public init(text: String, isMatch: Bool) {
            self.text = text
            self.isMatch = isMatch
        }
    }

    /// Text as the search compares it: vowel marks, Qur'anic annotation marks and tatweel removed;
    /// every hamza or madda on an alif and the wasla written as a bare alif, hamza on waw or ya as the
    /// letter alone, alif maqsura as ya and ta marbuta as ha; anything not a letter or digit a single
    /// space; Latin letters folded to lower case.
    public static func normalised(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in fold(text).scalars { out.append(scalar) }
        return String(out)
    }

    /// The query's words, normalised, in the order typed.
    public static func terms(_ query: String) -> [String] {
        normalised(query).split(separator: " ").map(String.init)
    }

    /// Whether a scalar is dropped by the search (and so belongs to the letter before it).
    static func isIgnored(_ value: UInt32) -> Bool {
        switch value {
        case 0x064B...0x065F, 0x0670, 0x06D6...0x06ED, 0x0640: true
        default: false
        }
    }

    /// The folded scalars of `text`, each with the offset of the scalar of `text` it came from.
    static func fold(_ text: String) -> (scalars: [Unicode.Scalar], origins: [Int]) {
        var scalars: [Unicode.Scalar] = []
        var origins: [Int] = []
        scalars.reserveCapacity(text.unicodeScalars.count)
        origins.reserveCapacity(text.unicodeScalars.count)
        var pendingSpace: Int?
        for (offset, scalar) in text.unicodeScalars.enumerated() {
            let value = scalar.value
            if isIgnored(value) { continue }
            let mapped: Unicode.Scalar
            switch value {
            case 0x0622, 0x0623, 0x0625, 0x0671, 0x0672, 0x0673: mapped = "\u{0627}"
            case 0x0624: mapped = "\u{0648}"
            case 0x0626, 0x0649, 0x06CC: mapped = "\u{064A}"
            case 0x0629: mapped = "\u{0647}"
            case 0x0660...0x0669: mapped = Unicode.Scalar(value - 0x0660 + 0x30)!
            case 0x06F0...0x06F9: mapped = Unicode.Scalar(value - 0x06F0 + 0x30)!
            default: mapped = scalar
            }
            guard mapped.properties.isAlphabetic || ("0"..."9").contains(mapped) else {
                if pendingSpace == nil { pendingSpace = offset }
                continue
            }
            if let space = pendingSpace, !scalars.isEmpty {
                scalars.append(" ")
                origins.append(space)
            }
            pendingSpace = nil
            for lower in mapped.properties.lowercaseMapping.unicodeScalars {
                scalars.append(lower)
                origins.append(offset)
            }
        }
        return (scalars, origins)
    }

    /// Where `terms` occur in folded scalars, as half-open ranges of them, in order and not
    /// overlapping. With `wholeWords`, a match must begin and end at a word's edges.
    static func matches(of terms: [String], in folded: [Unicode.Scalar], wholeWords: Bool) -> [Range<Int>] {
        var found: [Range<Int>] = []
        for term in terms {
            let needle = Array(term.unicodeScalars)
            guard !needle.isEmpty, needle.count <= folded.count else { continue }
            var start = 0
            while start + needle.count <= folded.count {
                var hit = true
                for offset in 0..<needle.count where folded[start + offset] != needle[offset] {
                    hit = false
                    break
                }
                let end = start + needle.count
                if hit, wholeWords {
                    hit = (start == 0 || folded[start - 1] == " ") && (end == folded.count || folded[end] == " ")
                }
                if hit {
                    found.append(start..<end)
                    start = end
                } else {
                    start += 1
                }
            }
        }
        found.sort { $0.lowerBound < $1.lowerBound }
        var merged: [Range<Int>] = []
        for range in found {
            if let last = merged.last, range.lowerBound < last.upperBound {
                merged[merged.count - 1] = last.lowerBound..<max(last.upperBound, range.upperBound)
            } else {
                merged.append(range)
            }
        }
        return merged
    }

    /// How many times `terms` occur in `text`.
    public static func count(of terms: [String], in text: String, wholeWords: Bool = false) -> Int {
        matches(of: terms, in: fold(text).scalars, wholeWords: wholeWords).count
    }

    /// `text` cut into its matches of `terms` and what lies between, each match taking the vowel
    /// marks of its last letter with it. With `lead`, a text whose first match lies further in than
    /// that many letters starts shortly before it, after an ellipsis.
    public static func segments(of text: String, matching terms: [String], wholeWords: Bool = false, lead: Int? = nil) -> [Segment] {
        let (folded, origins) = fold(text)
        let ranges = matches(of: terms, in: folded, wholeWords: wholeWords)
        let scalars = Array(text.unicodeScalars)
        func string(_ range: Range<Int>) -> String {
            var view = String.UnicodeScalarView()
            view.append(contentsOf: scalars[range])
            return String(view)
        }
        var segments: [Segment] = []
        var cursor = 0
        if let lead, let first = ranges.first, origins[first.lowerBound] > lead {
            // Back up about `lead / 2` letters, to the start of a word.
            var start = max(0, origins[first.lowerBound] - lead / 2)
            while start > 0, scalars[start - 1] != " " { start -= 1 }
            if start > 0 {
                cursor = start
                segments.append(Segment(text: "… ", isMatch: false))
            }
        }
        for range in ranges {
            let start = origins[range.lowerBound]
            var end = origins[range.upperBound - 1] + 1
            while end < scalars.count, isIgnored(scalars[end].value) { end += 1 }
            guard start >= cursor else { continue }
            if start > cursor { segments.append(Segment(text: string(cursor..<start), isMatch: false)) }
            segments.append(Segment(text: string(start..<end), isMatch: true))
            cursor = end
        }
        if cursor < scalars.count { segments.append(Segment(text: string(cursor..<scalars.count), isMatch: false)) }
        return segments
    }

    /// Arabic-Indic and Persian digits as 0-9; anything else unchanged.
    public static func westernDigits(_ text: String) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.map { scalar in
            switch scalar.value {
            case 0x0660...0x0669: Unicode.Scalar(scalar.value - 0x0660 + 0x30)!
            case 0x06F0...0x06F9: Unicode.Scalar(scalar.value - 0x06F0 + 0x30)!
            default: scalar
            }
        }))
    }
}
