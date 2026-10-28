import Foundation

/// The five obligatory prayers, in order. Raw values match the website's stored data.
public enum Prayer: String, CaseIterable, Codable, Sendable, Identifiable {
    case fajr, dhuhr, asr, maghrib, isha

    public var id: String { rawValue }
}

/// Everything in a day's timetable: the five prayers plus sunrise.
public enum TimeSlot: String, CaseIterable, Codable, Sendable, Identifiable {
    case fajr, sunrise, dhuhr, asr, maghrib, isha

    public var id: String { rawValue }

    /// The obligatory prayer this slot is, or `nil` for sunrise.
    public var prayer: Prayer? { Prayer(rawValue: rawValue) }
}

/// Text the data carries in both languages, such as a reference or a virtue.
public struct BilingualText: Codable, Hashable, Sendable {
    public var en: String
    public var ar: String

    public init(en: String, ar: String) {
        self.en = en
        self.ar = ar
    }

    /// The side for `languageCode` ("ar" or anything else for English), falling back to the other side when empty.
    public func text(for languageCode: String) -> String {
        let wantArabic = languageCode.hasPrefix("ar")
        let primary = (wantArabic ? ar : en).trimmingCharacters(in: .whitespacesAndNewlines)
        return primary.isEmpty ? (wantArabic ? en : ar).trimmingCharacters(in: .whitespacesAndNewlines) : primary
    }
}
