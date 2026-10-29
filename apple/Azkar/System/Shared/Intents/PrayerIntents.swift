import AppIntents
import AzkarKit
import Foundation

// Logging prayers and asking for the next one, from Siri, Shortcuts, Spotlight, widgets and
// controls. Each works on the App Group's stores, so it runs in whichever process the system picks.
// Shared by the app and the widget extension.

/// "Log Asr as jamaah in Azkar": sets a prayer's status, replacing any.
struct LogPrayerIntent: AppIntent {
    static let title = LocalizedStringResource("Log a Prayer", table: "System")
    static let description = IntentDescription(LocalizedStringResource("Records how you prayed one of the five prayers.", table: "System"))

    @Parameter(title: LocalizedStringResource("Prayer", table: "System"))
    var prayer: PrayerChoice

    @Parameter(title: LocalizedStringResource("Status", table: "System"), default: .ontime)
    var status: PrayerStatusChoice

    init() {}

    init(prayer: PrayerChoice, status: PrayerStatusChoice = .ontime) {
        self.prayer = prayer
        self.status = status
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let (settings, board) = await SharedRecords.board()
        let language = SystemLanguage(settings.app)
        let day = board?.day(for: prayer.prayer) ?? DayKey(.now, in: settings.timeZone)
        let outcome = try await PrayerLogging.set(prayer.prayer, status.status, on: day)
        return .result(dialog: "\(IntentReply.logged(prayer.prayer, status.status, outcome, language))")
    }
}

/// A tap on a prayer in a widget: prayed on time, if it is not logged yet. Not offered in Shortcuts.
struct TickPrayerIntent: AppIntent {
    static let title = LocalizedStringResource("Mark as Prayed", table: "System")
    static let isDiscoverable = false

    @Parameter(title: LocalizedStringResource("Prayer", table: "System"))
    var prayer: PrayerChoice

    /// The calendar day, YYYY-MM-DD.
    @Parameter(title: LocalizedStringResource("Day", table: "System"))
    var day: String

    init() {}

    init(prayer: Prayer, day: DayKey) {
        self.prayer = PrayerChoice(prayer)
        self.day = day.description
    }

    func perform() async throws -> some IntentResult {
        guard let key = DayKey(day) else { return .result() }
        try await PrayerLogging.tick(prayer.prayer, on: key)
        return .result()
    }
}

/// The control's "Log prayer": the current prayer, or the latest one whose time has come and is
/// not logged. On time while its time lasts, late (made up) after.
struct LogCurrentPrayerIntent: AppIntent {
    static let title = LocalizedStringResource("Log Current Prayer", table: "System")
    static let description = IntentDescription(LocalizedStringResource("Marks the prayer whose time it is as prayed.", table: "System"))

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let (settings, board) = await SharedRecords.board()
        let language = SystemLanguage(settings.app)
        guard let board else { return .result(dialog: "\(SystemText.string("Choose your location in Azkar first.", language))") }
        guard let entry = board.latestUnlogged else {
            return .result(dialog: "\(SystemText.string("Every prayer so far is logged.", language))")
        }
        let status: PrayerStatus = board.hasEnded(entry) ? .late : .ontime
        let outcome = try await PrayerLogging.set(entry.prayer, status, on: entry.day)
        return .result(dialog: "\(IntentReply.logged(entry.prayer, status, outcome, language))")
    }
}

/// "When is the next prayer?"
struct NextPrayerIntent: AppIntent {
    static let title = LocalizedStringResource("Next Prayer", table: "System")
    static let description = IntentDescription(LocalizedStringResource("Tells you which prayer comes next and when.", table: "System"))

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        let (settings, board) = await SharedRecords.board()
        let language = SystemLanguage(settings.app)
        guard let board, let next = board.next else {
            let text = SystemText.string("Choose your location in Azkar first.", language)
            return .result(value: text, dialog: "\(text)")
        }
        let text = IntentReply.next(next, board: board, language)
        return .result(value: text, dialog: "\(text)")
    }
}

/// What the intents say back.
nonisolated enum IntentReply {
    static func logged(_ prayer: Prayer, _ status: PrayerStatus, _ outcome: PrayerLogging.Outcome, _ language: SystemLanguage) -> String {
        let name = SystemText.prayer(prayer, language)
        switch outcome {
        case .logged: return SystemText.format("Logged %1$@: %2$@.", language, name, SystemText.status(status, language))
        case .alreadyLogged: return SystemText.format("%@ is already logged.", language, name)
        case .refused: return SystemText.string("That day hasn’t begun yet.", language)
        }
    }

    static func next(_ next: UpcomingPrayer, board: SystemPrayerBoard, _ language: SystemLanguage) -> String {
        let name = SystemText.prayer(next.prayer, language)
        let time = SystemText.time(next.at, in: board.place.timeZone, language)
        let duration = SystemText.duration(minutes: SystemText.minutes(from: board.now, to: next.at), language)
        let key = board.nextIsTomorrow ? "%1$@ tomorrow at %2$@, in %3$@." : "%1$@ at %2$@, in %3$@."
        return SystemText.format(key, language, name, time, duration)
    }
}
