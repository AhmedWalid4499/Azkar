import Foundation

/// What the iPhone shows the Watch: its prayers and today's tasbih. The records stay on the iPhone;
/// the Watch keeps the latest board to work from while the two are apart, so it carries the days
/// ahead as well.
public struct WatchBoard: Codable, Hashable, Sendable {
    /// One of a day's five prayers.
    public struct Row: Codable, Hashable, Sendable, Identifiable {
        public var prayer: Prayer
        /// `nil` when the time does not exist that day (polar day or night).
        public var at: Date?
        public var status: PrayerStatus?

        public var id: Prayer { prayer }

        public init(prayer: Prayer, at: Date?, status: PrayerStatus?) {
            self.prayer = prayer
            self.at = at
            self.status = status
        }
    }

    public struct Day: Codable, Hashable, Sendable, Identifiable {
        public var day: DayKey
        public var rows: [Row]

        public var id: DayKey { day }

        public init(day: DayKey, rows: [Row]) {
            self.day = day
            self.rows = rows
        }
    }

    /// The next prayer on the board.
    public struct Upcoming: Hashable, Sendable {
        public var prayer: Prayer
        public var at: Date
    }

    public var generatedAt: Date
    /// "en" or "ar".
    public var languageCode: String
    public var arabicDigits: Bool
    public var uses24Hour: Bool
    /// The saved place's zone, which "today" follows.
    public var timeZone: String
    public var placeName: String
    /// Consecutive days, oldest first.
    public var days: [Day]
    public var tasbihDay: DayKey
    /// All of that day's tasbih counters together.
    public var tasbihCount: Int
    /// The latest actions carried out for the Watch, so it can stop sending them again.
    public var appliedActions: [UUID]

    public init(generatedAt: Date, languageCode: String, arabicDigits: Bool, uses24Hour: Bool, timeZone: String, placeName: String,
                days: [Day], tasbihDay: DayKey, tasbihCount: Int, appliedActions: [UUID]) {
        self.generatedAt = generatedAt
        self.languageCode = languageCode
        self.arabicDigits = arabicDigits
        self.uses24Hour = uses24Hour
        self.timeZone = timeZone
        self.placeName = placeName
        self.days = days
        self.tasbihDay = tasbihDay
        self.tasbihCount = tasbihCount
        self.appliedActions = appliedActions
    }

    public var zone: TimeZone { TimeZone(identifier: timeZone) ?? .current }

    public func today(at now: Date) -> DayKey { DayKey(now, in: zone) }

    /// Today's prayers; `nil` once the board has run out of days.
    public func day(at now: Date) -> Day? {
        let today = today(at: now)
        return days.first { $0.day == today }
    }

    public func next(after now: Date) -> Upcoming? {
        for day in days {
            for row in day.rows {
                if let at = row.at, at > now { return Upcoming(prayer: row.prayer, at: at) }
            }
        }
        return nil
    }

    /// Whether a row of today can be ticked off now: its time has come and it is not logged.
    public func canTick(_ row: Row, at now: Date) -> Bool {
        row.status == nil && (row.at.map { $0 <= now } ?? false)
    }
}

/// What the Watch asks of the iPhone. The Watch sends an action again until a board lists its `id`,
/// and the iPhone carries out each `id` once, so nothing is lost and nothing is counted twice.
public enum WatchAction: Codable, Hashable, Sendable {
    /// Send the board again.
    case refresh
    /// A prayer prayed on time, if it is not logged yet.
    case tick(id: UUID, prayer: Prayer, day: DayKey)
    /// Counts on the free tasbih.
    case tasbih(id: UUID, count: Int, day: DayKey)

    /// `nil` for what need not be confirmed.
    public var id: UUID? {
        switch self {
        case .refresh: nil
        case let .tick(id, _, _), let .tasbih(id, _, _): id
        }
    }
}

/// How the two sides wrap their messages.
public enum WatchLink {
    /// The application context's key for a `WatchBoard`, and a message's for a `WatchAction`.
    public static let boardKey = "board"
    public static let actionKey = "action"

    public static func encode(_ value: some Encodable) -> Data? {
        try? JSONEncoder().encode(value)
    }

    public static func decode<Value: Decodable>(_ type: Value.Type, from data: Data?) -> Value? {
        data.flatMap { try? JSONDecoder().decode(type, from: $0) }
    }
}
