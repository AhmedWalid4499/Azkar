import AzkarCore
import Foundation

/// The interface language of text built here (Hijri dates, export headers).
public enum DisplayLanguage: String, CaseIterable, Codable, Sendable {
    case en, ar

    public var code: String { rawValue }
}

/// The language text is written in, and for Arabic whether numbers are written in Arabic-Indic
/// digits (the website's `ar-u-nu-arab`) or Western ones (`ar-u-nu-latn`). English always
/// writes Western digits.
public struct DisplayLocale: Hashable, Sendable {
    public var language: DisplayLanguage
    /// Only read when `language` is Arabic.
    public var arabicIndicDigits: Bool

    public init(language: DisplayLanguage, arabicIndicDigits: Bool = true) {
        self.language = language
        self.arabicIndicDigits = arabicIndicDigits
    }

    public static let english = DisplayLocale(language: .en)
    public static let arabic = DisplayLocale(language: .ar, arabicIndicDigits: true)
    public static let arabicWesternDigits = DisplayLocale(language: .ar, arabicIndicDigits: false)

    /// Whether numbers are written in Arabic-Indic digits.
    public var writesArabicIndicDigits: Bool { language == .ar && arabicIndicDigits }

    /// A whole number in this locale's digits, without grouping.
    public func number(_ value: Int) -> String {
        let text = String(value)
        return writesArabicIndicDigits ? ProseText.arabicIndicDigits(text) : text
    }
}

/// Helpers for the prose shown around a recitation (references, virtues, notes).
public enum ProseText {
    /// Western digits rewritten as Arabic-Indic ones. For prose, never for a recitation.
    public static func arabicIndicDigits(_ text: String) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.map { scalar in
            guard (0x30...0x39).contains(scalar.value) else { return scalar }
            return Unicode.Scalar(0x0660 + scalar.value - 0x30)!
        }))
    }
}

extension BilingualText {
    /// The side for `language`, falling back to the other side when it is empty.
    public func text(for language: DisplayLanguage) -> String { text(for: language.code) }

    /// A field of prose for display. The dataset writes its numbers in Western digits; with
    /// Arabic-Indic digits on, the Arabic side shows them like every other number on the page.
    /// An English fallback keeps its own digits. As `localizedProse` on the website.
    public func prose(for locale: DisplayLocale) -> String {
        let shown = text(for: locale.language)
        let isArabicSide = shown == ar.trimmingCharacters(in: .whitespacesAndNewlines)
        return locale.writesArabicIndicDigits && isArabicSide ? ProseText.arabicIndicDigits(shown) : shown
    }
}
