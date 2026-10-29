#if DEBUG
import AzkarKit
import SwiftUI

/// Hosts a tracker view in previews over an in-memory store, empty or with the sample history.
struct TrackerPreview<Content: View>: View {
    var seeded = true
    @ViewBuilder var content: Content
    @State private var app: AppEnvironment? = {
        let defaults = UserDefaults(suiteName: "tracker-preview-\(UUID().uuidString)")!
        return try? AppEnvironment(location: .inMemory, settingsStore: SettingsStore(defaults: defaults, postsNotifications: false))
    }()

    var body: some View {
        if let app {
            content
                .environment(app)
                .task {
                    guard seeded else { return }
                    let settings = app.settings.settings
                    let snapshot = TrackerSeed.sample(today: DayKey(.now, in: settings.timeZone), now: .now, zone: settings.timeZone,
                                                      dataset: app.dataset, hijriOffset: settings.app.hijriOffset)
                    try? await app.store.merge(snapshot)
                    await app.records.reload()
                }
        }
    }
}
#endif
