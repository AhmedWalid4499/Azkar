import AzkarKit
import Foundation

/// A string of the Quran table (`Quran.xcstrings`).
nonisolated func QL(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Quran")
}

/// What saving a place in the Qur'an would mean, so the unusual cases can be confirmed first.
enum QuranLogCheck: Equatable {
    /// Already the saved place.
    case nothing
    case save
    /// Earlier than the saved place: it would move back and add no pages.
    case movesBack(from: Int)
    /// Further than a sitting usually covers, as when browsing ahead.
    case manyPages(Int)

    private static let usualSitting = 40

    init(page: Int, progress: QuranProgress) {
        let position = progress.position
        if page == position {
            self = .nothing
        } else if page < position {
            self = .movesBack(from: position)
        } else if page - position > Self.usualSitting {
            self = .manyPages(page - position)
        } else {
            self = .save
        }
    }
}

/// A page to open the reader at.
struct QuranReaderRequest: Identifiable, Hashable {
    let id = UUID()
    let page: Int
}
