import Foundation

// Plain values for everything the user does and the app records. The storage layer
// persists them and the statistics layer reads them; neither depends on the other.
// Raw values match the website's stored data.

/// How an obligatory prayer was prayed.
public enum PrayerStatus: String, CaseIterable, Codable, Sendable {
    /// Prayed within its time.
    case ontime
    /// Prayed in congregation.
    case jamaah
    /// Made up after its time (qada).
    case late
    /// Not prayed.
    case missed
    /// Not required that day (for example during menstruation); never counts against the user.
    case excused

    /// Counts as prayed for streaks and rates.
    public var isPrayed: Bool { self == .ontime || self == .jamaah || self == .late }
}

/// One obligatory prayer's record on a day.
public struct PrayerEntry: Codable, Hashable, Sendable {
    public var status: PrayerStatus
    /// When the status was last set; `nil` for entries imported from data that did not keep it.
    public var loggedAt: Date?

    public init(status: PrayerStatus, loggedAt: Date?) {
        self.status = status
        self.loggedAt = loggedAt
    }
}

/// The sunnah prayers the app tracks: the twelve confirmed rak'ahs, Duha, Witr and the night prayer.
public enum SunnahPrayer: String, CaseIterable, Codable, Sendable {
    case beforeFajr, duha, beforeDhuhr, afterDhuhr, afterMaghrib, afterIsha, qiyam, witr

    /// The rawatib: twelve rak'ahs a day with the obligatory prayers.
    public static let rawatib: [SunnahPrayer] = [.beforeFajr, .beforeDhuhr, .afterDhuhr, .afterMaghrib, .afterIsha]

    /// Prayed at night, so before Fajr they belong to the previous day.
    public var isNightPrayer: Bool { self == .afterIsha || self == .qiyam || self == .witr }
}

/// Everything recorded about prayer on one day.
public struct DayPrayerRecord: Codable, Hashable, Sendable {
    public var prayers: [Prayer: PrayerEntry]
    /// Done sunnah prayers and when each was ticked.
    public var sunnah: [SunnahPrayer: Date]

    public init(prayers: [Prayer: PrayerEntry] = [:], sunnah: [SunnahPrayer: Date] = [:]) {
        self.prayers = prayers
        self.sunnah = sunnah
    }

    public var isEmpty: Bool { prayers.isEmpty && sunnah.isEmpty }
}

/// A reading session of azkar. The night sessions (evening, sleep) belong before Fajr to the previous day.
public enum AzkarSession: Hashable, Sendable, CustomStringConvertible {
    case morning
    case evening
    case sleep
    case afterPrayer(Prayer)

    /// Stable key used in storage and exports: "morning", "evening", "sleep", "afterPrayer:fajr".
    public var description: String {
        switch self {
        case .morning: "morning"
        case .evening: "evening"
        case .sleep: "sleep"
        case let .afterPrayer(prayer): "afterPrayer:\(prayer.rawValue)"
        }
    }

    public init?(_ key: String) {
        switch key {
        case "morning": self = .morning
        case "evening": self = .evening
        case "sleep": self = .sleep
        default:
            let parts = key.split(separator: ":")
            guard parts.count == 2, parts[0] == "afterPrayer", let prayer = Prayer(rawValue: String(parts[1])) else { return nil }
            self = .afterPrayer(prayer)
        }
    }

    public static let regular: [AzkarSession] = [.morning, .evening, .sleep]
    public static let all: [AzkarSession] = regular + Prayer.allCases.map(AzkarSession.afterPrayer)
}

extension AzkarSession: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let key = try container.decode(String.self)
        guard let session = AzkarSession(key) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown azkar session \(key)")
        }
        self = session
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }
}

/// What was read in one session on one day.
public struct SessionRecord: Codable, Hashable, Sendable {
    /// The first count of the day's session.
    public var startedAt: Date?
    /// The latest count, or count taken back.
    public var lastAt: Date?
    /// When every dhikr reached its count, when known.
    public var completedAt: Date?
    /// Every dhikr reached its count that day ("Start over" keeps it).
    public var completed: Bool
    /// Azkar at their count in the current reading.
    public var done: Int
    /// Azkar in the session when it was last counted.
    public var total: Int
    /// Repetitions counted that day, all readings together.
    public var recitations: Int

    public init(startedAt: Date? = nil, lastAt: Date? = nil, completedAt: Date? = nil, completed: Bool = false, done: Int = 0, total: Int = 0, recitations: Int = 0) {
        self.startedAt = startedAt
        self.lastAt = lastAt
        self.completedAt = completedAt
        self.completed = completed
        self.done = done
        self.total = total
        self.recitations = recitations
    }
}

/// Free tasbih counting on one day for one preset (a dhikr id) or the free counter (`TasbihRecord.freeCount`).
public struct TasbihRecord: Codable, Hashable, Sendable {
    public static let freeCount = "free"

    public var preset: String
    public var count: Int
    public var lastAt: Date?

    public init(preset: String, count: Int, lastAt: Date?) {
        self.preset = preset
        self.count = count
        self.lastAt = lastAt
    }
}

/// Why a fast is kept.
public enum FastKind: String, CaseIterable, Codable, Sendable {
    /// A day of Ramadan.
    case ramadan
    /// Making up a missed day of Ramadan.
    case qada
    /// A voluntary fast (Mondays and Thursdays, the white days, Arafah, Ashura, six of Shawwal…).
    case voluntary
}

public enum FastStatus: String, CaseIterable, Codable, Sendable {
    case fasted
    /// Not fasted without an excuse (a Ramadan day then is owed).
    case missed
    /// Not fasted with an excuse (travel, illness, menstruation): a Ramadan day is owed, without blame.
    case excused
    /// Started and broken.
    case broken
}

public struct FastRecord: Codable, Hashable, Sendable {
    public var kind: FastKind
    public var status: FastStatus
    public var loggedAt: Date?

    public init(kind: FastKind, status: FastStatus, loggedAt: Date?) {
        self.kind = kind
        self.status = status
        self.loggedAt = loggedAt
    }
}
