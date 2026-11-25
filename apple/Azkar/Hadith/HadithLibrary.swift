import AzkarKit
import Observation
import SwiftUI

/// The Riyad as-Salihin library, read once off the main actor and shared by Today, the Azkar tab
/// and the Tracker. Views read `collection`, which is `nil` for the moment it takes to load.
@MainActor
@Observable
final class HadithLibrary {
    static let shared = HadithLibrary()

    private(set) var collection: HadithCollection?
    @ObservationIgnored private var loading: Task<HadithCollection, Never>?

    /// The library, loading it the first time.
    @discardableResult
    func load() async -> HadithCollection {
        if let collection { return collection }
        let task = loading ?? Task.detached(priority: .userInitiated) { HadithCollection.bundled }
        loading = task
        let loaded = await task.value
        collection = loaded
        return loaded
    }
}

extension Int {
    /// A hadith's number as a reference, without grouping ("1178", not "1,178"), in the locale's digits.
    func hadithNumber(_ locale: Locale) -> String {
        formatted(.number.grouping(.never).locale(locale))
    }
}

/// The hadith views' strings, in `Hadith.xcstrings`.
nonisolated func H(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Hadith")
}

extension Hadith {
    /// The text, its source note and where it is from, for sharing.
    func shareText(locale: Locale) -> String {
        var parts = [text]
        if let source { parts.append("((\(source)))") }
        var reference = H("Riyad as-Salihin \(number.hadithNumber(locale))")
        reference.locale = locale
        parts.append(String(localized: reference))
        return parts.joined(separator: "\n\n")
    }
}

extension HadithBook {
    /// Where a hadith is in the book, as "Introduction, hadith 12" or "Book 9, hadith 1".
    static func position(book: Int, inBook: Int) -> LocalizedStringResource {
        book == 0 ? H("Introduction, hadith \(inBook)") : H("Book \(book), hadith \(inBook)")
    }

    /// "Introduction" or "Book 9".
    var label: LocalizedStringResource {
        number == 0 ? H("Introduction") : H("Book \(number)")
    }

}
