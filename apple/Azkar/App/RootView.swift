import AzkarKit
import SwiftUI

/// The app's five sections. Each tab's screen lives in its own folder.
enum AppTab: String, Hashable {
    case today, azkar, quran, qibla, tracker
}

struct RootView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var systemLocale
    @Environment(\.layoutDirection) private var systemDirection
    @State private var tab = RootView.launchTab
    @State private var todayNavigation = TodayNavigation.shared
    @State private var systemRouter = SystemRouter.shared

    var body: some View {
        let appSettings = app.settings.settings.app
        TabView(selection: $tab) {
            Tab(value: AppTab.today) { TodayScreen() } label: { label("Today", systemImage: "sunrise") }
            Tab(value: AppTab.azkar) { ReadingScreen() } label: { label("Azkar", systemImage: "book.closed") }
            Tab(value: AppTab.quran) { QuranScreen() } label: { label("Quran", systemImage: "book.pages") }
            Tab(value: AppTab.qibla) { QiblaScreen() } label: { label("Qibla", systemImage: "location.north.line") }
            Tab(value: AppTab.tracker) { TrackerScreen() } label: { label("Tracker", systemImage: "calendar") }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .preferredColorScheme(appSettings.theme.colorScheme)
        // No branches here: changing the language must not rebuild the tabs and lose where the user is.
        .environment(\.locale, appSettings.language.locale ?? systemLocale)
        .environment(\.layoutDirection, appSettings.language.layoutDirection ?? systemDirection)
        .onOpenURL { systemRouter.open($0) }
        .onChange(of: systemRouter.pending, initial: true) {
            guard let route = systemRouter.take() else { return }
            switch route {
            case .today: tab = .today
            case .qibla: tab = .qibla
            case .quran:
                tab = .quran
                systemRouter.opensQuranReader = true
            case let .azkar(session): openReading(session, day: nil)
            }
        }
        .onChange(of: todayNavigation.sessionRequest) { _, request in
            guard let request else { return }
            todayNavigation.sessionRequest = nil
            openReading(request.session, day: request.day)
        }
        .task { await app.run() }
        .task { await SystemServices.shared.run(app) }
        #if DEBUG
        // `-AzkarRoute azkar://azkar/morning` follows a link the way a widget or notification would.
        .task {
            guard let raw = UserDefaults.standard.string(forKey: "AzkarRoute"), let url = URL(string: raw) else { return }
            try? await Task.sleep(for: .seconds(1.5))
            systemRouter.open(url)
        }
        #endif
    }

    private func label(_ title: String.LocalizationValue, systemImage: String) -> some View {
        Label { Text(LocalizedStringResource(title, table: "App")) } icon: { Image(systemName: systemImage) }
    }

    private func openReading(_ session: AzkarSession, day: DayKey?) {
        tab = .azkar
        ReadingRouter.shared.open(session, day: day)
    }

    /// DEBUG builds open at `-AzkarTab <today|azkar|quran|qibla|tracker>`, for screenshots.
    private static var launchTab: AppTab {
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: "AzkarTab"), let tab = AppTab(rawValue: raw) { return tab }
        #endif
        return .today
    }
}

private extension AppSettings.Language {
    /// Nil for "System", which follows the phone's (per-app) language.
    var locale: Locale? {
        switch self {
        case .system: nil
        case .en: Locale(identifier: "en")
        case .ar: Locale(identifier: "ar")
        }
    }

    var layoutDirection: LayoutDirection? {
        switch self {
        case .system: nil
        case .en: .leftToRight
        case .ar: .rightToLeft
        }
    }
}
