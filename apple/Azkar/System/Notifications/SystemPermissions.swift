import AlarmKit
import Foundation
import Observation
import UserNotifications

/// Whether the app may notify and sound alarms, for Settings to show (and explain when it is off).
/// `SystemServices` asks when a reminder switch or an adhan is first turned on.
@MainActor
@Observable
final class SystemPermissions {
    enum State: Equatable, Sendable {
        case notDetermined
        case allowed
        /// Turned off in the Settings app: only the user can turn it back on there.
        case denied
    }

    private(set) var notifications: State = .notDetermined
    private(set) var alarms: State = .notDetermined

    /// Reads both again (after the app comes back from the Settings app, say).
    func refresh() async {
        notifications = Self.state(await UNUserNotificationCenter.current().notificationSettings().authorizationStatus)
        alarms = Self.state(AlarmManager.shared.authorizationState)
    }

    /// Asks for notifications if not asked before. Returns whether they are allowed.
    @discardableResult
    func requestNotifications() async -> Bool {
        await refresh()
        if notifications == .notDetermined {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            await refresh()
        }
        return notifications == .allowed
    }

    /// Asks for alarms (the adhan) if not asked before. Returns whether they are allowed.
    @discardableResult
    func requestAlarms() async -> Bool {
        await refresh()
        if alarms == .notDetermined {
            do {
                _ = try await AlarmManager.shared.requestAuthorization()
            } catch {
                print("Azkar: asking for alarm permission failed: \(error)")
            }
            await refresh()
        }
        return alarms == .allowed
    }

    /// Follows changes made in the Settings app while running.
    func followAlarms() async {
        for await state in AlarmManager.shared.authorizationUpdates {
            alarms = Self.state(state)
        }
    }

    private static func state(_ status: UNAuthorizationStatus) -> State {
        switch status {
        case .notDetermined: .notDetermined
        case .denied: .denied
        default: .allowed
        }
    }

    private static func state(_ status: AlarmManager.AuthorizationState) -> State {
        switch status {
        case .notDetermined: .notDetermined
        case .denied: .denied
        case .authorized: .allowed
        @unknown default: .denied
        }
    }
}
