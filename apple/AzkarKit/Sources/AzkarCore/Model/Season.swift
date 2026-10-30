import Foundation

/// What Ramadan and the Eids add to the days of the year.
public enum SeasonDeed: String, Codable, CaseIterable, Sendable {
    /// The night prayer of Ramadan.
    case tarawih
    /// The prayer of either Eid.
    case eidPrayer
}

/// Where a prayer was prayed.
public enum WorshipPlace: String, Codable, CaseIterable, Sendable {
    case masjid, home
}

/// One deed of the season on one day.
public struct SeasonRecord: Codable, Hashable, Sendable {
    /// A number of rakahs beyond these is not a count.
    public static let rakahsRange = 1...100

    public var deed: SeasonDeed
    /// The day it counts for. A tarawih's is the civil day whose evening the night falls on, which
    /// is not always the date of `at`: prayed past midnight, it stays with that evening.
    public var day: DayKey
    /// When it was first logged.
    public var at: Date
    public var place: WorshipPlace?
    public var rakahs: Int?

    public init(deed: SeasonDeed, day: DayKey, at: Date, place: WorshipPlace? = nil, rakahs: Int? = nil) {
        self.deed = deed
        self.day = day
        self.at = at
        self.place = place
        self.rakahs = rakahs
    }
}
