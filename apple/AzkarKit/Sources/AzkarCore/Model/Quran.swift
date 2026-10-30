import Foundation

/// One thing recorded about reading the Quran.
public struct QuranEntry: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        /// "Stopped here": moved from `fromPage` to `toPage`.
        case read
        /// A khatmah added by hand (for instance, read from a paper mushaf).
        case khatmah
    }

    public var id: UUID
    /// The day it counts for, which is not always the date of `at`: reading past midnight
    /// belongs to the day the reader passes.
    public var day: DayKey
    public var at: Date
    public var kind: Kind
    /// The position before this entry, 0...603 (0 = nothing read yet in this khatmah).
    public var fromPage: Int
    /// The page reached, 1...604 (0 for `.khatmah` entries).
    public var toPage: Int

    public init(id: UUID = UUID(), day: DayKey, at: Date, kind: Kind, fromPage: Int, toPage: Int) {
        self.id = id
        self.day = day
        self.at = at
        self.kind = kind
        self.fromPage = fromPage
        self.toPage = toPage
    }

    /// Pages this entry adds: none for a correction backwards, nor for a khatmah added by hand.
    public var pages: Int { kind == .read ? max(0, toPage - fromPage) : 0 }
}

/// Everything derived from the log. Entries are the only source of truth.
public struct QuranProgress: Hashable, Sendable {
    public static let pageCount = 604

    /// The last page reached in the current khatmah, 0...603. Reaching 604 finishes it and
    /// resets to 0. A khatmah added by hand was read elsewhere and leaves this as it is.
    public private(set) var position = 0
    public private(set) var totalPages = 0
    /// Pages read per day, on the days any were.
    public private(set) var pagesByDay: [DayKey: Int] = [:]
    /// The latest `.read` entry, a correction included. A khatmah added by hand says when it was
    /// added, not when it was read.
    public private(set) var lastReadAt: Date?
    /// The day of the first `.read` entry since `position` last reset, so the khatmah `position`
    /// is in. A khatmah added by hand does not begin a new one.
    public private(set) var currentKhatmahStart: DayKey?
    /// The day each khatmah was finished, in order.
    public private(set) var khatmahDates: [DayKey] = []

    /// `entries` in any order: they are sorted by `at`, and those of one instant keep their order.
    public init(entries: [QuranEntry]) {
        let ordered = entries.enumerated().sorted { ($0.element.at, $0.offset) < ($1.element.at, $1.offset) }
        for (_, entry) in ordered {
            switch entry.kind {
            case .khatmah:
                khatmahDates.append(entry.day)
            case .read:
                lastReadAt = entry.at
                currentKhatmahStart = currentKhatmahStart ?? entry.day
                totalPages += entry.pages
                if entry.pages > 0 { pagesByDay[entry.day, default: 0] += entry.pages }
                position = entry.toPage
                if entry.toPage == Self.pageCount {
                    if entry.fromPage < Self.pageCount { khatmahDates.append(entry.day) }
                    position = 0
                    currentKhatmahStart = nil
                }
            }
        }
    }

    /// `.read` entries with `toPage` 604 and `fromPage` below it, plus `.khatmah` entries.
    public var khatmahs: Int { khatmahDates.count }

    public func pages(on day: DayKey) -> Int { pagesByDay[day] ?? 0 }
}
