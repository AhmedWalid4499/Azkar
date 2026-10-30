import AzkarCore
import Foundation

/// What an import brought in, kept with the records so the app can always say where the
/// history it shows came from.
public struct ImportReport: Codable, Hashable, Sendable {
    /// Where the data came from: `ImportReport.webApp` or `ImportReport.backup`.
    public var source: String
    public var at: Date
    /// The website's stores that held something readable ("prayer-log", "azkar-progress"…).
    public var storesFound: [String]
    /// `azkar:` keys that were present but are no store this app reads.
    public var ignoredKeys: [String]
    /// The settings groups taken over ("app", "location", "calculation", "reminders", "reader").
    public var settings: [String]
    public var firstDay: DayKey?
    public var lastDay: DayKey?
    /// Days with any prayer logged, and the prayers logged in all.
    public var prayerDays: Int
    public var prayers: Int
    public var sunnahPrayers: Int
    /// Azkar session records, and how many of them were completed.
    public var sessions: Int
    public var completedSessions: Int
    public var fasts: Int
    /// Lifetime repetitions in the reader, and on the tasbih counter.
    public var recitations: Int
    public var tasbih: Int
    /// Entries of the Quran log. `nil` in a report saved before the Quran was tracked: reports
    /// are kept as JSON with the records, so what is added here must read the older ones.
    public var quranEntries: Int?
    /// Records of Ramadan and the Eids. `nil` in a report saved before they were tracked.
    public var seasonRecords: Int?

    public static let webApp = "web-app"
    public static let backup = "backup"

    public init(source: String, at: Date, snapshot: WebSnapshot, settings: [String]) {
        let records = snapshot.records
        self.source = source
        self.at = at
        storesFound = snapshot.found.sorted()
        ignoredKeys = snapshot.ignored.sorted()
        self.settings = settings
        firstDay = records.days.first
        lastDay = records.days.last
        prayerDays = records.prayers.values.filter { !$0.prayers.isEmpty }.count
        prayers = records.prayers.values.reduce(0) { $0 + $1.prayers.count }
        sunnahPrayers = records.prayers.values.reduce(0) { $0 + $1.sunnah.count }
        sessions = records.sessions.values.reduce(0) { $0 + $1.count }
        completedSessions = records.sessions.values.reduce(0) { $0 + $1.values.filter(\.completed).count }
        fasts = records.fasts.count
        recitations = records.totals.recitations
        tasbih = records.totals.tasbihCount
        quranEntries = records.quran.count
        seasonRecords = records.seasons.values.reduce(0) { $0 + $1.count }
    }

    /// Nothing was found to import.
    public var isEmpty: Bool { storesFound.isEmpty }
}
