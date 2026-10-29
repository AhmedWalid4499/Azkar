import AzkarKit
import Foundation

/// The parts of the app that run with the system: notifications, adhan alarms, background
/// refresh, the Live Activity and widget reloads. PLACEHOLDER: the real implementation
/// replaces the body, keeping `run(_:)`, which the root view calls once at launch.
@MainActor
final class SystemServices {
    static let shared = SystemServices()

    /// Starts everything and keeps it in step with the user's records and settings for as long as the app runs.
    func run(_ app: AppEnvironment) async {}
}
