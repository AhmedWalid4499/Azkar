import AzkarCore
import Foundation

/// What is held by heart, page by page and juz by juz: how much, how well, and whether it is due.
public struct HifzMap: Sendable {
    /// How well what is held stands, by its weakest ayah.
    public enum Standing: Int, Comparable, Sendable {
        case weak
        /// Memorised and not reviewed yet (or reviewed before strength was asked).
        case unrated
        case good
        case strong

        public static func < (lhs: Standing, rhs: Standing) -> Bool { lhs.rawValue < rhs.rawValue }

        public init(_ strength: HifzStrength?) {
            switch strength {
            case .weak: self = .weak
            case nil: self = .unrated
            case .good: self = .good
            case .strong: self = .strong
            }
        }
    }

    /// One page or one juz.
    public struct Cell: Hashable, Sendable, Identifiable {
        public var number: Int
        public var total: Int
        public var held = 0
        /// Of the ayat held, how many are due on the day the map was made for.
        public var due = 0
        /// The weakest held ayah's standing; `nil` when nothing is held.
        public var standing: Standing?

        public var id: Int { number }
        public var isComplete: Bool { held == total && total > 0 }
        public var isDue: Bool { due > 0 }
        public var fraction: Double { total == 0 ? 0 : Double(held) / Double(total) }

        init(number: Int, indexes: some Sequence<Int>, progress: HifzProgress, today: DayKey) {
            self.number = number
            var total = 0
            for index in indexes {
                total += 1
                guard let state = progress.state(at: index) else { continue }
                held += 1
                if state.dueOn <= today { due += 1 }
                let standing = Standing(state.strength)
                self.standing = self.standing.map { min($0, standing) } ?? standing
            }
            self.total = total
        }
    }

    public let pages: [Cell]
    public let juz: [Cell]
    private let juzPages: [ClosedRange<Int>]

    public init(progress: HifzProgress, index: QuranPageIndex = .bundled, today: DayKey) {
        pages = QuranMushaf.pages.map { Cell(number: $0, indexes: index.ayahIndexes(ofPage: $0), progress: progress, today: today) }
        juz = (1...QuranLayout.juzStarts.count).map { Cell(number: $0, indexes: QuranLayout.indexes(ofJuz: $0), progress: progress, today: today) }
        juzPages = (1...QuranLayout.juzStarts.count).map { index.pages(ofJuz: $0) }
    }

    /// The pages a juz spans.
    public func pages(ofJuz juz: Int) -> ArraySlice<Cell> {
        let range = juzPages[juz - 1]
        return pages[(range.lowerBound - 1)...(range.upperBound - 1)]
    }

    /// Pages held whole.
    public var pagesHeld: Int { pages.filter(\.isComplete).count }
    /// Juz held whole.
    public var juzHeld: Int { juz.filter(\.isComplete).count }
}
