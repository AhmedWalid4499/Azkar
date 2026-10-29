import AzkarKit
import Foundation
import UserNotifications

/// Answers the reminders: shows them while the app is open, logs a prayer from "Prayed ✓"
/// without opening the app, and opens the right place on a tap or "Open".
final class NotificationResponder: NSObject, UNUserNotificationCenterDelegate {
    /// What a response asks for, read out of the system's objects before leaving their thread.
    struct Response: Sendable {
        var info: ReminderInfo
        var action: String
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let info = ReminderInfo(response.notification.request.content.userInfo) else { return }
        let request = Response(info: info, action: response.actionIdentifier)
        await SystemServices.shared.handle(request)
    }
}

extension SystemServices {
    /// A tap on a reminder or one of its actions.
    func handle(_ response: NotificationResponder.Response) async {
        let info = response.info
        switch response.action {
        case NotificationCategories.prayedAction:
            guard let prayer = info.prayer else { return }
            do {
                try await PrayerLogging.tick(prayer, on: info.day)
            } catch {
                print("Azkar: logging \(prayer) from a reminder failed: \(error)")
            }
            await refresh(reason: "prayed from a reminder")
        case UNNotificationDismissActionIdentifier:
            break
        default:
            // The notification itself, or "Open".
            if info.kind == .azkar, let session = info.session {
                SystemRouter.shared.go(.azkar(session))
            } else {
                SystemRouter.shared.go(.today)
            }
        }
    }
}
