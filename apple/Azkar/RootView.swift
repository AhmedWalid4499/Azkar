import SwiftUI

/// The app's five sections. Each tab's screen is built in its own folder.
struct RootView: View {
    var body: some View {
        TabView {
            Tab("Today", systemImage: "sunrise") { Text("Today") }
            Tab("Azkar", systemImage: "book") { Text("Azkar") }
            Tab("Qibla", systemImage: "location.north.circle") { Text("Qibla") }
            Tab("Tracker", systemImage: "calendar") { Text("Tracker") }
            Tab("Settings", systemImage: "gearshape") { Text("Settings") }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}
