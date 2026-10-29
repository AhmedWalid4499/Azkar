#if DEBUG
import AzkarKit
import Foundation

/// Sample settings for screenshots and manual checks, from launch arguments, written through
/// the app's own settings model (DEBUG builds only):
///
///     -AzkarDemoPlace cairo|london|makkah|tromso|none
///     -AzkarDemoLanguage system|en|ar
///     -AzkarDemoTheme system|light|dark
///     -AzkarDemoName Ahmed
///     -AzkarDemoRecords YES      (logs a few prayers and a morning session)
@MainActor
enum SettingsDemo {
    private static var applied = false

    static func applyOnce(to app: AppEnvironment) {
        guard !applied else { return }
        applied = true
        let arguments = UserDefaults.standard
        if let place = arguments.string(forKey: "AzkarDemoPlace") {
            app.settings.update { $0.location = Self.place(place) }
        }
        if let raw = arguments.string(forKey: "AzkarDemoLanguage"), let language = AppSettings.Language(rawValue: raw) {
            app.settings.update { $0.app.language = language }
        }
        if let raw = arguments.string(forKey: "AzkarDemoTheme"), let theme = AppSettings.Theme(rawValue: raw) {
            app.settings.update { $0.app.theme = theme }
        }
        if let name = arguments.string(forKey: "AzkarDemoName") {
            app.settings.update { $0.app.name = name }
        }
        if arguments.bool(forKey: "AzkarDemoRecords") {
            Task { await logSamples(app) }
        }
    }

    /// `-AzkarDemoPage calculation|adjustments|reminders|reader|imported|about` opens that page of Settings.
    static func openPage() -> [SettingsPage]? {
        switch UserDefaults.standard.string(forKey: "AzkarDemoPage") {
        case "calculation": [.calculation]
        case "adjustments": [.calculation, .adjustments]
        case "reminders": [.reminders]
        case "reader": [.reader]
        case "imported": [.imported]
        case "about": [.about]
        default: nil
        }
    }

    /// `-AzkarDemoScroll <section>` scrolls the main Settings form: "data", "general", "about".
    static var scrollTarget: String? { UserDefaults.standard.string(forKey: "AzkarDemoScroll") }

    /// `-AzkarDemoSearch Cairo` opens the city search with that text.
    static var searchQuery: String? { UserDefaults.standard.string(forKey: "AzkarDemoSearch") }
    static var searchShown = false
    /// `-AzkarDemoLocate YES` runs "Use my location" when Settings opens.
    static var locateOnOpen: Bool { UserDefaults.standard.bool(forKey: "AzkarDemoLocate") }
    static var locateDone = false

    private static func place(_ name: String) -> SavedLocation? {
        let now = (Date.now.timeIntervalSince1970 * 1000).rounded()
        switch name {
        case "cairo":
            return SavedLocation(latitude: 30.044, longitude: 31.236, timeZone: "Africa/Cairo", label: "Cairo, Egypt", countryCode: "EG", source: .gps, updatedAt: now)
        case "london":
            return SavedLocation(latitude: 51.507, longitude: -0.128, timeZone: "Europe/London", label: "London, United Kingdom", countryCode: "GB", source: .manual, updatedAt: now)
        case "makkah":
            return SavedLocation(latitude: 21.4225, longitude: 39.8262, timeZone: "Asia/Riyadh", label: "Makkah, Saudi Arabia", countryCode: "SA", source: .gps, updatedAt: now)
        case "tromso":
            return SavedLocation(latitude: 69.649, longitude: 18.956, timeZone: "Europe/Oslo", label: "Tromsø, Norway", countryCode: "NO", source: .manual, updatedAt: now)
        default:
            return nil
        }
    }

    private static func logSamples(_ app: AppEnvironment) async {
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        for offset in 0..<3 {
            let day = today.adding(days: -offset)
            for prayer in Prayer.allCases.prefix(offset == 0 ? 2 : 5) {
                _ = try? await app.records.setPrayer(prayer, .ontime, on: day)
            }
        }
        if let first = app.dataset.azkar(for: .morning).first {
            _ = try? await app.records.count(.complete, dhikr: first.id, in: .morning, on: today)
        }
    }
}
#endif
