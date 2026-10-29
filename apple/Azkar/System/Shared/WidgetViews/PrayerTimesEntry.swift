import AzkarKit
import Foundation
import WidgetKit

/// What the prayer widgets show at one moment.
nonisolated struct PrayerTimesEntry: TimelineEntry {
    enum Content {
        /// No place saved yet.
        case noLocation
        case ready(SystemPrayerBoard)
    }

    /// A session's reading today, for the large widget.
    struct SessionProgress: Hashable, Identifiable {
        let session: AzkarSession
        let done: Int
        let total: Int
        let completed: Bool

        var id: String { session.description }
        var fraction: Double { total > 0 ? min(1, Double(done) / Double(total)) : (completed ? 1 : 0) }
    }

    let date: Date
    let language: SystemLanguage
    let name: String
    let content: Content
    let azkar: [SessionProgress]

    var board: SystemPrayerBoard? {
        if case let .ready(board) = content { board } else { nil }
    }
}


extension PrayerTimesEntry {
    /// A filled-in entry for the widget gallery and previews: Makkah, two prayers logged.
    nonisolated static func sample(now: Date = .now, language: SystemLanguage = SystemLanguage(code: Bundle.main.preferredLocalizations.first ?? "en")) -> PrayerTimesEntry {
        var settings = SettingsSnapshot()
        settings.location = SavedLocation(latitude: 21.4225, longitude: 39.8262, timeZone: "Asia/Riyadh", label: "Makkah", countryCode: "SA", source: .manual, updatedAt: 0)
        let today = DayKey(now, in: settings.timeZone)
        let prayers = [today: DayPrayerRecord(prayers: [.fajr: PrayerEntry(status: .ontime, loggedAt: now), .dhuhr: PrayerEntry(status: .jamaah, loggedAt: now)])]
        guard let board = SystemPrayerBoard(settings: settings, prayers: prayers, now: now) else {
            return PrayerTimesEntry(date: now, language: language, name: "", content: .noLocation, azkar: [])
        }
        let azkar: [SessionProgress] = [
            .init(session: .morning, done: 24, total: 24, completed: true),
            .init(session: .evening, done: 9, total: 24, completed: false),
            .init(session: .sleep, done: 0, total: 12, completed: false),
        ]
        return PrayerTimesEntry(date: now, language: language, name: "", content: .ready(board), azkar: azkar)
    }
}
