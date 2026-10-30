import SwiftUI

/// The Watch app: today's prayers to tick off, and a tasbih to count on. Everything goes to the
/// iPhone, which keeps the records; this holds a copy to work from while the two are apart.
@main
struct AzkarWatchApp: App {
    @State private var store = WatchStore.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WatchRootView(store: store)
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        store.refresh()
                    } else {
                        store.flushTasbih()
                    }
                }
        }
    }
}
