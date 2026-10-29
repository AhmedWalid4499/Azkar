import AzkarKit
import SwiftUI

/// The app's five sections. Each tab's screen lives in its own folder.
struct RootView: View {
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        let appSettings = app.settings.settings.app
        TabView {
            Tab("Today", systemImage: "sunrise") { TodayScreen() }
            Tab("Azkar", systemImage: "book.closed") { ReadingScreen() }
            Tab("Qibla", systemImage: "location.north.line") { QiblaScreen() }
            Tab("Tracker", systemImage: "calendar") { TrackerScreen() }
            Tab("Settings", systemImage: "gearshape") { SettingsScreen() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .preferredColorScheme(appSettings.theme.colorScheme)
        .modifier(AppLanguage(language: appSettings.language))
        .task { await app.run() }
        .task { await SystemServices.shared.run(app) }
    }
}

/// Applies the in-app language choice: "System" follows the phone's (per-app) language.
private struct AppLanguage: ViewModifier {
    let language: AppSettings.Language

    func body(content: Content) -> some View {
        switch language {
        case .system:
            content
        case .en:
            content.environment(\.locale, Locale(identifier: "en")).environment(\.layoutDirection, .leftToRight)
        case .ar:
            content.environment(\.locale, Locale(identifier: "ar")).environment(\.layoutDirection, .rightToLeft)
        }
    }
}
