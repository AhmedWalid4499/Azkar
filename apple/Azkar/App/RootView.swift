import AzkarKit
import SwiftUI

/// The app's five sections. Each tab's screen lives in its own folder.
struct RootView: View {
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        TabView {
            Tab("Today", systemImage: "sunrise") { TodayScreen() }
            Tab("Azkar", systemImage: "book.closed") { ReadingScreen() }
            Tab("Qibla", systemImage: "location.north.line") { QiblaScreen() }
            Tab("Tracker", systemImage: "calendar") { TrackerScreen() }
            Tab("Settings", systemImage: "gearshape") { SettingsScreen() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .preferredColorScheme(app.settings.settings.app.theme.colorScheme)
        .task { await app.run() }
    }
}
