import AzkarCore
import Foundation

/// One dhikr of a session as the records need it: its id and how many times it is recited.
public struct DhikrTarget: Hashable, Sendable {
    public let id: String
    /// At least 1: a malformed repeat count counts once, as the website's `targetOf`.
    public let target: Int

    public init(id: String, target: Int) {
        self.id = id
        self.target = target > 0 ? target : 1
    }
}

/// What each session holds, in order, so the records can tell when a reading is complete.
/// The app builds one from the azkar dataset (AzkarContent); this module never reads it.
public protocol SessionCatalog: Sendable {
    /// The session's azkar in reading order, with the counts for that session (after-prayer
    /// counts differ by prayer). Empty when the dataset has none.
    func items(for session: AzkarSession) -> [DhikrTarget]
    /// The dhikr ids the tasbih counter offers as presets.
    var tasbihPresets: [String] { get }
}

/// A catalog held in memory.
public struct StaticSessionCatalog: SessionCatalog, Hashable {
    public var sessions: [AzkarSession: [DhikrTarget]]
    public var tasbihPresets: [String]

    public init(sessions: [AzkarSession: [DhikrTarget]], tasbihPresets: [String] = []) {
        self.sessions = sessions
        self.tasbihPresets = tasbihPresets
    }

    public func items(for session: AzkarSession) -> [DhikrTarget] { sessions[session] ?? [] }

    /// No azkar and no presets: enough for a process that only logs prayers or fasts (a widget's App Intent).
    public static let empty = StaticSessionCatalog(sessions: [:])
}

/// The tasbih counter of one preset (or the free count) on one day.
public struct TasbihCount: Hashable, Sendable, Codable {
    /// The first count of the day.
    public var startedAt: Date?
    /// The latest count, or count taken back.
    public var lastAt: Date?
    /// Counted that day, every round together. A count taken back is subtracted; "Reset" is not.
    public var count: Int
    /// What the counter shows now: back to 0 after "Reset". Never more than `count`.
    public var current: Int

    public init(startedAt: Date? = nil, lastAt: Date? = nil, count: Int, current: Int) {
        self.startedAt = startedAt
        self.lastAt = lastAt
        self.count = count
        self.current = current
    }

    public func record(preset: String) -> TasbihRecord {
        TasbihRecord(preset: preset, count: count, lastAt: lastAt)
    }
}

/// Lifetime totals. Never pruned, never lowered except by a count taken back.
public struct LifetimeTotals: Hashable, Sendable, Codable {
    /// Repetitions per dhikr id in the reader, every session (after-prayer ones included).
    public var dhikr: [String: Int] = [:]
    /// Repetitions of all azkar together in the reader. Never less than `dhikr` adds up to.
    public var recitations = 0
    /// Repetitions per dhikr id after the prayers only (also counted in `dhikr`).
    public var afterPrayer: [String: Int] = [:]
    /// The tasbih counter per preset.
    public var tasbih: [String: Int] = [:]
    /// The tasbih counter's free count.
    public var tasbihFree = 0

    public init(dhikr: [String: Int] = [:], recitations: Int = 0, afterPrayer: [String: Int] = [:], tasbih: [String: Int] = [:], tasbihFree: Int = 0) {
        self.dhikr = dhikr
        self.recitations = recitations
        self.afterPrayer = afterPrayer
        self.tasbih = tasbih
        self.tasbihFree = tasbihFree
    }

    /// Everything counted on the tasbih counter.
    public var tasbihCount: Int { tasbih.values.reduce(tasbihFree, +) }
}

/// Everything recorded on one day.
public struct DayRecords: Hashable, Sendable, Identifiable {
    public let day: DayKey
    public var prayer = DayPrayerRecord()
    /// What was read in each session.
    public var sessions: [AzkarSession: SessionRecord] = [:]
    /// Per-dhikr counts of the current reading of each session, to resume it. Kept 30 days.
    public var counts: [AzkarSession: [String: Int]] = [:]
    /// By preset id, or `TasbihRecord.freeCount` for the free count.
    public var tasbih: [String: TasbihCount] = [:]
    public var fast: FastRecord?
    /// What was recorded about reading the Quran that day, in order.
    public var quran: [QuranEntry] = []
    /// The tarawih of the night falling on this evening, or the Eid prayer of this day.
    public var seasons: [SeasonDeed: SeasonRecord] = [:]

    public init(day: DayKey) { self.day = day }

    public var id: DayKey { day }

    public var isEmpty: Bool {
        prayer.isEmpty && sessions.isEmpty && counts.isEmpty && tasbih.isEmpty && fast == nil && quran.isEmpty && seasons.isEmpty
    }

    /// The day's tasbih in the shape the statistics read.
    public var tasbihRecords: [TasbihRecord] {
        tasbih.sorted { $0.key < $1.key }.map { $0.value.record(preset: $0.key) }
    }
}

/// Everything the records hold, as plain values: what a backup carries and an import brings in.
public struct RecordsSnapshot: Hashable, Sendable {
    public var prayers: [DayKey: DayPrayerRecord] = [:]
    public var sessions: [DayKey: [AzkarSession: SessionRecord]] = [:]
    public var counts: [DayKey: [AzkarSession: [String: Int]]] = [:]
    public var totals = LifetimeTotals()
    public var tasbih: [DayKey: [String: TasbihCount]] = [:]
    public var fasts: [DayKey: FastRecord] = [:]
    /// Days of Ramadan owed from before the log began, as the user counts them.
    public var owedFastsBefore = 0
    /// The Quran log, the only source of truth for `QuranProgress`, ordered by `at`.
    public var quran: [QuranEntry] = []
    /// Bookmarked pages of the mushaf, and when each was bookmarked.
    public var quranBookmarks: [Int: Date] = [:]
    /// The deeds of Ramadan and the Eids, by the day each counts for.
    public var seasons: [DayKey: [SeasonDeed: SeasonRecord]] = [:]

    public init() {}

    public var isEmpty: Bool { self == RecordsSnapshot() }

    /// Every day with any record, oldest first.
    public var days: [DayKey] {
        Set(prayers.keys).union(sessions.keys).union(counts.keys).union(tasbih.keys).union(fasts.keys).union(quran.map(\.day)).union(seasons.keys).sorted()
    }
}

extension [QuranEntry] {
    /// By time; entries of the same instant by id, so that every read gives the same order.
    var inLogOrder: [QuranEntry] {
        sorted { ($0.at, $0.id.uuidString) < ($1.at, $1.id.uuidString) }
    }
}

/// What a change did.
public enum ChangeResult: Hashable, Sendable {
    case changed
    /// Nothing to change: the value was already so, or the dhikr or preset is not in the catalog.
    case unchanged
    /// The day has not begun where the user is: it can be cleared, not logged.
    case refusedFutureDay
}

/// The limits the website puts on stored counts (src/features/azkar/progressData.ts).
public enum RecordLimits {
    /// Per-dhikr counts are kept this many days after the day counted, to resume a reading.
    public static let detailDays = 30
    /// A stored count far beyond any real repeat count is not a count.
    public static let maxStoredCount = 10_000
    public static let maxSessionSize = 1_000
    /// Repetitions in one session (or on one tasbih counter) on one day.
    public static let maxSessionRecitations = 1_000_000
    public static let maxLifetimeRecitations = 1_000_000_000_000
    /// Days owed from before the fasting log began: a hundred Ramadans.
    public static let maxOwedFastsBefore = 3000
}
