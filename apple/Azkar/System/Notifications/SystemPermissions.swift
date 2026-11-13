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

    /// The adhan alarm needs AlarmKit (iOS 26.1). Before it, the app leaves the adhan out.
    static var alarmsAvailable: Bool {
        if #available(iOS 26.1, *) { true } else { false }
    }

    /// Reads both again (after the app comes back from the Settings app, say).
    func refresh() async {
        notifications = Self.state(await UNUserNotificationCenter.current().notificationSettings().authorizationStatus)
        if #available(iOS 26.1, *) { alarms = Self.state(AlarmManager.shared.authorizationState) }
    }

    /// Asks for notifications if not asked before. `allowed`: whether they are allowed now;
    /// `justAllowed`: whether the user allowed them in answer to this question.
    func requestNotifications() async -> (allowed: Bool, justAllowed: Bool) {
        await refresh()
        guard notifications == .notDetermined else { return (notifications == .allowed, false) }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        await refresh()
        return (notifications == .allowed, notifications == .allowed)
    }

    /// Asks for alarms (the adhan) if not asked before. Returns whether they are allowed.
    @discardableResult
    func requestAlarms() async -> Bool {
        guard #available(iOS 26.1, *) else { return false }
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
        guard #available(iOS 26.1, *) else { return }
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

    @available(iOS 26.1, *)
    private static func state(_ status: AlarmManager.AuthorizationState) -> State {
        switch status {
        case .notDetermined: .notDetermined
        case .denied: .denied
        case .authorized: .allowed
        @unknown default: .denied
        }
    }
}
