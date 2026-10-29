import AzkarKit
import SwiftUI

@main
struct AzkarApp: App {
    @UIApplicationDelegateAdaptor(SystemAppDelegate.self) private var systemDelegate
    @State private var startup = Startup()

    var body: some Scene {
        WindowGroup {
            switch startup.result {
            case let .success(app):
                RootView().environment(app)
            case let .failure(error):
                StartupFailureView(error: error)
            }
        }
    }
}

/// Opens the shared environment once. Opening the record store can fail (no space, a damaged
/// file); the app then says so rather than crashing.
@MainActor
@Observable
final class Startup {
    let result: Result<AppEnvironment, Error>

    init() {
        result = Result { try AppEnvironment() }
    }
}

struct StartupFailureView: View {
    let error: Error

    var body: some View {
        ContentUnavailableView {
            Label("Azkar couldn’t open your records", systemImage: "exclamationmark.triangle")
        } description: {
            Text(error.localizedDescription)
        }
    }
}
