#if DEBUG
import AzkarKit
import Foundation
import SwiftUI

/// DEBUG-only launch arguments for looking at Today in a given state (screenshots, previews).
/// Everything is written through the app's own settings and records operations.
///
///     -TodaySeed cairo|polar|none   a place with realistic records (`none`: the first run)
///     -TodayName "Ahmed"            the name the greeting uses
///     -TodayLanguage en|ar          the in-app language
///     -TodayNow 2026-03-01T03:30:00+02:00   show the screen at another moment (the clock keeps running)
///     -TodayScroll azkar|sunnah     scroll there at launch
///     -TodayShow location|calendar          open the location sheet or the calendar at launch
///     -TodayFlip morning,evening            azkar cards turned over at launch
///     -TodayRamadanSeed                     last Ramadan logged, and a khatmah goal of 2
///     -TodayProgress morning                a card's list of azkar open at launch
enum TodayDebugLaunch {
    static var seed: String? { UserDefaults.standard.string(forKey: "TodaySeed") }
    static var name: String? { UserDefaults.standard.string(forKey: "TodayName") }
    static var language: String? { UserDefaults.standard.string(forKey: "TodayLanguage") }
    /// `-TodayScroll azkar|sunnah`: scrolled there at launch.
    static var scroll: String? { UserDefaults.standard.string(forKey: "TodayScroll") }
    /// `-TodayShow location|calendar`: open at launch.
    static var show: String? { UserDefaults.standard.string(forKey: "TodayShow") }
    /// `-TodayFlip morning,evening`: these azkar cards start turned over.
    static var flip: [String] { UserDefaults.standard.string(forKey: "TodayFlip")?.components(separatedBy: ",") ?? [] }
    /// `-TodayProgress morning`: this card's list of azkar open at launch.
    static var progress: String? { UserDefaults.standard.string(forKey: "TodayProgress") }

    static let clockOffset: TimeInterval = {
        guard let text = UserDefaults.standard.string(forKey: "TodayNow"),
              let date = try? Date(text, strategy: .iso8601) else { return 0 }
        return date.timeIntervalSinceNow
    }()

    static var now: Date { Date().addingTimeInterval(clockOffset) }
}

enum TodayDebugSeed {
    static let cairo = SavedLocation(latitude: 30.0444, longitude: 31.2357, timeZone: "Africa/Cairo", label: "Cairo",
                                     countryCode: "EG", source: .gps, updatedAt: 1_761_000_000_000)
    static let longyearbyen = SavedLocation(latitude: 78.2232, longitude: 15.6267, timeZone: "Arctic/Longyearbyen", label: "Longyearbyen",
                                            countryCode: "NO", source: .manual, updatedAt: 1_761_000_000_000)

    @MainActor
    static func runIfRequested(_ app: AppEnvironment) async {
        if let name = TodayDebugLaunch.name { app.settings.update { $0.app.name = name } }
        if let language = TodayDebugLaunch.language.flatMap(AppSettings.Language.init(rawValue:)) {
            app.settings.update { $0.app.language = language }
        }
        if UserDefaults.standard.bool(forKey: "TodayRamadanSeed") { await seedRamadan(app) }
        switch TodayDebugLaunch.seed {
        case "cairo": await seed(app, at: cairo)
        case "polar": await seed(app, at: longyearbyen)
        case "none": app.settings.update { $0.location = nil }
        default: break
        }
    }

    @MainActor
    private static func seedRamadan(_ app: AppEnvironment) async {
        app.settings.update { $0.app.ramadanKhatmahGoal = 2 }
        let records = app.records
        do {
            for night in RamadanCalendar.nights(hijriYear: 1447) {
                if night.number % 5 != 0 {
                    try await records.setSeasonRecord(.tarawih, place: night.number.isMultiple(of: 3) ? .home : .masjid, rakahs: night.isOdd ? 8 : nil, on: night.evening, at: night.evening.noonUTC)
                }
                if night.isLastTen { try await records.setSunnah(.qiyam, done: true, on: night.evening) }
                try await records.setFast(.ramadan, .fasted, on: night.evening.adding(days: 1))
            }
            for dates in IslamicOccasions.dates(hijriYear: 1447) where dates.occasion == .eidAlFitr {
                try await records.setSeasonRecord(.eidPrayer, place: nil, rakahs: nil, on: dates.first, at: dates.first.noonUTC)
            }
        } catch {
            print("Ramadan seed failed: \(error)")
        }
    }

    @MainActor
    private static func seed(_ app: AppEnvironment, at place: SavedLocation) async {
        app.settings.update { $0.location = place }
        let today = DayKey(TodayDebugLaunch.now, in: place.zone)
        let yesterday = today.adding(days: -1)
        let records = app.records
        let now = TodayDebugLaunch.now
        let schedule = PrayerPlace(place).map { PrayerSchedule(today: today, at: $0, config: app.settings.settings.calculation) }
        do {
            for prayer in Prayer.allCases where prayer != .isha {
                try await records.setPrayer(prayer, prayer == .maghrib ? .jamaah : .ontime, on: yesterday)
            }
            try await records.setSunnah(.witr, done: true, on: yesterday)
            // Today's prayers that have begun: Fajr in congregation, Dhuhr on time, later ones left to log.
            for prayer in [Prayer.fajr, .dhuhr] {
                guard let at = schedule?.todayTimes[prayer: prayer], at <= now else { continue }
                try await records.setPrayer(prayer, prayer == .fajr ? .jamaah : .ontime, on: today)
                try await records.setSunnah(prayer == .fajr ? .beforeFajr : .beforeDhuhr, done: true, on: today)
            }
            // Last night's evening azkar finished, this morning's under way.
            for dhikr in app.dataset.azkar(for: .evening) {
                try await records.count(.complete, dhikr: dhikr.id, in: .evening, on: yesterday)
            }
            for dhikr in app.dataset.azkar(for: .morning).prefix(12) {
                try await records.count(.complete, dhikr: dhikr.id, in: .morning, on: today)
            }
        } catch {
            print("Today seed failed: \(error)")
        }
    }

    /// Scrolls to, or opens, what `-TodayScroll` / `-TodayShow` ask for.
    @MainActor
    static func present(scroll proxy: ScrollViewProxy, location: Binding<Bool>, calendar: Binding<Bool>) async {
        try? await Task.sleep(for: .seconds(1.2))
        switch TodayDebugLaunch.scroll {
        case "azkar": withAnimation { proxy.scrollTo("today.azkar", anchor: .top) }
        case "sunnah": withAnimation { proxy.scrollTo("today.sunnah", anchor: .top) }
        default: break
        }
        if TodayDebugLaunch.show == "location" { location.wrappedValue = true }
        if TodayDebugLaunch.show == "calendar" { calendar.wrappedValue = true }
    }
}

/// Today with an in-memory store and Cairo saved, for Xcode previews.
struct TodayPreview: View {
    @State private var app: AppEnvironment? = {
        let defaults = UserDefaults(suiteName: "today-preview")!
        let app = try? AppEnvironment(location: .inMemory, settingsStore: SettingsStore(defaults: defaults, postsNotifications: false))
        app?.settings.update {
            $0.location = TodayDebugSeed.cairo
            $0.app.name = "Ahmed"
        }
        return app
    }()

    var body: some View {
        if let app {
            TodayScreen().environment(app)
        }
    }
}
#endif
