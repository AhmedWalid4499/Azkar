import Foundation

/// A run of recitation text for display: plain text, or a word with the Qur'anic pause mark or the
/// sajdah sign that follows it, to be kept on one line.
public enum RecitationSegment: Hashable, Sendable {
    case text(String)
    /// `mark` is the space and the combining pause sign (U+06D6–U+06DC) exactly as written.
    case pauseGroup(word: String, mark: String)
    /// `sign` is the space and the sajdah sign (U+06E9) that Tanzil prints after the last word of an
    /// ayah of prostration. It is a symbol of its own, not a pause mark: shown as it is, not lowered.
    case signGroup(word: String, sign: String)

    /// The characters this segment stands for.
    public var source: String {
        switch self {
        case let .text(text): text
        case let .pauseGroup(word, mark): word + mark
        case let .signGroup(word, sign): word + sign
        }
    }
}

/// Helpers for showing a dhikr's Arabic text. They never change the text itself.
public enum RecitationText {
    /// Splits recitation text so each Qur'anic pause mark, and the sajdah sign, stays with its word.
    /// The canonical text writes each mark as a space plus a combining sign, and the sajdah sign as a
    /// space plus a symbol, which left alone can wrap onto the next line. The rub' al-hizb sign
    /// (U+06DE) that opens an ayah is left in the plain text. Joining the segments' `source` gives
    /// back the text, scalar for scalar. As `Recitation.tsx`.
    public static func segments(_ text: String) -> [RecitationSegment] {
        let scalars = Array(text.unicodeScalars)
        var segments: [RecitationSegment] = []
        var cursor = 0
        var index = 0
        while index + 1 < scalars.count {
            let sign = scalars[index + 1]
            guard scalars[index] == " ", isPauseMark(sign) || isSajdahSign(sign) else {
                index += 1
                continue
            }
            var start = index
            while start > cursor, !isJavaScriptWhitespace(scalars[start - 1]) { start -= 1 }
            if start < index {
                if start > cursor { segments.append(.text(string(scalars[cursor..<start]))) }
                let word = string(scalars[start..<index])
                let mark = string(scalars[index...index + 1])
                segments.append(isSajdahSign(sign) ? .signGroup(word: word, sign: mark) : .pauseGroup(word: word, mark: mark))
                cursor = index + 2
            }
            index += 2
        }
        if cursor < scalars.count { segments.append(.text(string(scalars[cursor...]))) }
        return segments
    }

    static let snippetWords = 6
    static let shortPassageLetters = 48

    /// The opening words of a dhikr, for lists: six words, then " …".
    public static func snippet(_ arabic: String) -> String {
        let words = splitOnWhitespace(trimJavaScript(arabic))
        return words.count > snippetWords ? words.prefix(snippetWords).joined(separator: " ") + " …" : words.joined(separator: " ")
    }

    /// A dhikr short enough to sit on a line or two, which reads well centred.
    public static func isShortPassage(_ arabic: String) -> Bool {
        let text = trimJavaScript(arabic)
        guard !text.unicodeScalars.contains("\n") else { return false }
        // Harakat, Qur'anic annotation marks and tatweel add no width; JavaScript counts UTF-16 units.
        let letters = text.unicodeScalars.filter { !isNonSpacing($0) }.reduce(0) { $0 + UTF16.width($1) }
        return letters <= shortPassageLetters
    }

    // MARK: - Characters, as JavaScript's regular expressions see them

    static func isPauseMark(_ scalar: Unicode.Scalar) -> Bool {
        (0x06D6...0x06DC).contains(scalar.value)
    }

    /// The sign of a prostration of recitation, U+06E9.
    static func isSajdahSign(_ scalar: Unicode.Scalar) -> Bool {
        scalar.value == 0x06E9
    }

    static func isNonSpacing(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x0610...0x061A, 0x0640, 0x064B...0x065F, 0x0670, 0x06D6...0x06ED: true
        default: false
        }
    }

    /// `\s` in JavaScript.
    static func isJavaScriptWhitespace(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: true
        default: false
        }
    }

    static func trimJavaScript(_ text: String) -> String {
        let scalars = Array(text.unicodeScalars)
        guard let first = scalars.firstIndex(where: { !isJavaScriptWhitespace($0) }),
              let last = scalars.lastIndex(where: { !isJavaScriptWhitespace($0) }) else { return "" }
        return string(scalars[first...last])
    }

    static func splitOnWhitespace(_ text: String) -> [String] {
        var words: [String] = []
        var current = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if isJavaScriptWhitespace(scalar) {
                if !current.isEmpty { words.append(String(current)) }
                current = String.UnicodeScalarView()
            } else {
                current.append(scalar)
            }
        }
        if !current.isEmpty || words.isEmpty { words.append(String(current)) }
        return words
    }

    private static func string(_ scalars: ArraySlice<Unicode.Scalar>) -> String {
        var view = String.UnicodeScalarView()
        view.append(contentsOf: scalars)
        return String(view)
    }
}
