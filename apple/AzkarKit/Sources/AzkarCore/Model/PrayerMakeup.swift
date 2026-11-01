import Foundation

/// One prayer made up from before the log began. A prayer logged as missed is made up on its own
/// day instead (`PrayerStatus.late`). The log only grows, undo apart, so the count left is always
/// worked out from it.
public struct PrayerMakeup: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var prayer: Prayer
    /// The day it was made up on.
    public var day: DayKey
    public var at: Date

    public init(id: UUID = UUID(), prayer: Prayer, day: DayKey, at: Date) {
        self.id = id
        self.prayer = prayer
        self.day = day
        self.at = at
    }
}

/// What is left of the prayers owed from before the log began.
public struct PrayerBacklog: Hashable, Sendable {
    /// What the user counted when they started, by prayer.
    public var owedBefore: [Prayer: Int]
    /// Those made up since, by prayer.
    public var madeUp: [Prayer: Int] = [:]

    public init(owedBefore: [Prayer: Int], makeups: [PrayerMakeup]) {
        self.owedBefore = owedBefore
        for makeup in makeups { madeUp[makeup.prayer, default: 0] += 1 }
    }

    public func remaining(_ prayer: Prayer) -> Int {
        max(0, (owedBefore[prayer] ?? 0) - (madeUp[prayer] ?? 0))
    }

    public var remaining: Int { Prayer.allCases.reduce(0) { $0 + remaining($1) } }
    public var madeUpCount: Int { madeUp.values.reduce(0, +) }
    /// The user has said what they owe, or has made some up.
    public var isSet: Bool { owedBefore.values.contains { $0 > 0 } || madeUpCount > 0 }
}
