import Foundation

/// One thing recorded about memorising a surah. The log is the only source of truth and only ever
/// grows, so what was memorised and reviewed, and when, is kept even after a surah slips away.
public struct HifzEntry: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case memorised
        case reviewed
        /// No longer held by heart: it goes back to not memorised, its history stays.
        case forgotten
    }

    public var id: UUID
    /// 1...114.
    public var sura: Int
    public var day: DayKey
    public var at: Date
    public var kind: Kind

    public init(id: UUID = UUID(), sura: Int, day: DayKey, at: Date, kind: Kind) {
        self.id = id
        self.sura = sura
        self.day = day
        self.at = at
        self.kind = kind
    }
}

/// Everything derived from the memorisation log.
public struct HifzProgress: Hashable, Sendable {
    public static let suraCount = 114

    /// A surah held by heart now.
    public struct Sura: Hashable, Sendable, Identifiable {
        public var number: Int
        public var memorisedOn: DayKey
        /// The day of the latest review; the day it was memorised until there is one.
        public var lastReviewedOn: DayKey
        public var reviews: Int

        public var id: Int { number }
    }

    /// By surah number.
    public private(set) var suras: [Int: Sura] = [:]
    /// Reviews ever logged, of surahs forgotten since included.
    public private(set) var totalReviews = 0

    /// `entries` in any order: they are sorted by `at`, and those of one instant keep their order.
    public init(entries: [HifzEntry]) {
        let ordered = entries.enumerated().sorted { ($0.element.at, $0.offset) < ($1.element.at, $1.offset) }
        for (_, entry) in ordered {
            switch entry.kind {
            case .memorised:
                suras[entry.sura] = Sura(number: entry.sura, memorisedOn: entry.day, lastReviewedOn: entry.day, reviews: 0)
            case .reviewed:
                totalReviews += 1
                suras[entry.sura]?.lastReviewedOn = entry.day
                suras[entry.sura]?.reviews += 1
            case .forgotten:
                suras[entry.sura] = nil
            }
        }
    }

    public var memorisedCount: Int { suras.count }

    /// The surahs held by heart, the one reviewed longest ago first.
    public var byLastReview: [Sura] {
        suras.values.sorted { ($0.lastReviewedOn, $0.number) < ($1.lastReviewedOn, $1.number) }
    }
}
