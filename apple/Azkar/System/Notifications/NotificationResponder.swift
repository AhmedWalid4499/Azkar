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

    // The completion-handler forms, not the `async` ones: the system's handler updates UIKit's
    // snapshot, which must happen on the main thread, and an `async` delegate method returns
    // on a thread of the pool, which crashes the app.

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = ReminderInfo(response.notification.request.content.userInfo)
        let action = response.actionIdentifier
        nonisolated(unsafe) let done = completionHandler
        Task { @MainActor in
            if let info { await SystemServices.shared.handle(Response(info: info, action: action)) }
            done()
        }
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
            } else if let page = info.quranPage {
                SystemRouter.shared.go(.quranPage(page))
            } else {
                SystemRouter.shared.go(.today)
            }
        }
    }
}
